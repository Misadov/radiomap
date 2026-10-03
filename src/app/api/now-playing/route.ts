// GET /api/now-playing?url=<stream url>
//
// Browsers can't read the "Artist - Title" that Icecast/SHOUTcast servers interleave
// with the audio (ICY metadata), so we fetch the first metadata block server-side.
// We speak raw HTTP over a socket because SHOUTcast v1 answers "ICY 200 OK", which
// standard HTTP clients reject. Responses are CDN-cached per stream for 15 seconds.

import { lookup } from 'node:dns/promises';
import { isIP, Socket, connect as netConnect } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 10;

const TIMEOUT_MS = 6000;
const MAX_BYTES = 192 * 1024;
const MAX_REDIRECTS = 3;

interface Result {
  title: string | null;
  supported: boolean;
}

const UNSUPPORTED: Result = { title: null, supported: false };

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

function decodeTitle(bytes: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // Legacy servers: Cyrillic stations mostly use windows-1251, the rest latin-1.
    let high = 0;
    let cyrillicRange = 0;
    for (const b of bytes) {
      if (b >= 0x80) high++;
      if (b >= 0xc0) cyrillicRange++;
    }
    const enc = high && cyrillicRange / high > 0.6 ? 'windows-1251' : 'windows-1252';
    return new TextDecoder(enc).decode(bytes);
  }
}

function parseMetadata(block: Buffer): string | null {
  const text = decodeTitle(block.subarray(0, block.indexOf(0) >= 0 ? block.indexOf(0) : block.length));
  const match = /StreamTitle='(.*?)';/s.exec(text) ?? /StreamTitle='(.*)'/s.exec(text);
  const title = match?.[1]?.replace(/\s+/g, ' ').trim();
  if (!title || /^[-–—\s.]*$/.test(title)) return null;
  return title.length > 200 ? `${title.slice(0, 200)}…` : title;
}

async function readIcy(url: URL, redirects = 0): Promise<Result> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return UNSUPPORTED;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const { address } = isIP(host) ? { address: host } : await lookup(host);
  if (isPrivateAddress(address)) return UNSUPPORTED;
  const secure = url.protocol === 'https:';
  const port = url.port ? Number(url.port) : secure ? 443 : 80;

  return new Promise<Result>((resolve) => {
    let settled = false;
    const finish = (result: Result | Promise<Result>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };
    const timer = setTimeout(() => finish(UNSUPPORTED), TIMEOUT_MS);

    const request =
      `GET ${url.pathname || '/'}${url.search} HTTP/1.0\r\n` +
      `Host: ${url.host}\r\n` +
      'Icy-MetaData: 1\r\n' +
      'User-Agent: RadioMap/2.0 (+https://github.com/misadov/radiomap)\r\n' +
      'Accept: */*\r\n' +
      'Connection: close\r\n\r\n';

    const socket: Socket = secure
      ? tlsConnect({ host: address, port, servername: isIP(host) ? undefined : host, ALPNProtocols: ['http/1.1'] }, () => socket.write(request))
      : netConnect({ host: address, port }, () => socket.write(request));

    let buffer = Buffer.alloc(0);
    let metaint = 0;
    let cursor = -1; // start of the next audio block, once headers are parsed

    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > MAX_BYTES) return finish({ title: null, supported: metaint > 0 });

      if (cursor < 0) {
        const end = buffer.indexOf('\r\n\r\n');
        if (end < 0) {
          if (buffer.length > 16 * 1024) finish(UNSUPPORTED);
          return;
        }
        const [statusLine, ...lines] = buffer.subarray(0, end).toString('latin1').split('\r\n');
        const status = Number(/^(?:HTTP\/\d(?:\.\d)?|ICY)\s+(\d{3})/i.exec(statusLine)?.[1] ?? 0);
        const headers = new Map(
          lines.map((l) => {
            const i = l.indexOf(':');
            return [l.slice(0, i).trim().toLowerCase(), l.slice(i + 1).trim()] as const;
          }),
        );
        const location = headers.get('location');
        if (status >= 300 && status < 400 && location && redirects < MAX_REDIRECTS) {
          return finish(readIcy(new URL(location, url), redirects + 1).catch(() => UNSUPPORTED));
        }
        metaint = Number(headers.get('icy-metaint') ?? 0);
        if (status !== 200 || !metaint || /chunked/i.test(headers.get('transfer-encoding') ?? '')) return finish(UNSUPPORTED);
        cursor = end + 4;
      }

      // Walk audio/metadata blocks until one carries a title.
      while (buffer.length > cursor + metaint) {
        const length = buffer[cursor + metaint] * 16;
        const metaStart = cursor + metaint + 1;
        if (buffer.length < metaStart + length) return;
        if (length > 0) return finish({ title: parseMetadata(buffer.subarray(metaStart, metaStart + length)), supported: true });
        cursor = metaStart;
      }
    });
    socket.on('error', () => finish(UNSUPPORTED));
    socket.on('end', () => finish({ title: null, supported: metaint > 0 }));
  });
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url') ?? '';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'bad url' }, { status: 400 });
  }
  if (raw.length > 2048 || !/^https?:$/.test(url.protocol)) {
    return NextResponse.json({ error: 'bad url' }, { status: 400 });
  }

  let result: Result;
  try {
    result = await readIcy(url);
  } catch {
    result = UNSUPPORTED;
  }
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, max-age=10, s-maxage=15, stale-while-revalidate=30' },
  });
}
