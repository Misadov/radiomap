// Tiny client for the radio-browser.info API, used at play time:
//  - counts a "click" for the station (the directory asks apps to do this)
//  - returns the station's current stream url, in case ours went stale.

const HOSTS = ['de1.api.radio-browser.info', 'de2.api.radio-browser.info', 'fi1.api.radio-browser.info'];

interface UrlResponse {
  ok: boolean;
  url?: string;
}

export async function clickStation(uuid: string): Promise<string | null> {
  for (const host of [...HOSTS].sort(() => Math.random() - 0.5)) {
    try {
      const res = await fetch(`https://${host}/json/url/${encodeURIComponent(uuid)}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as UrlResponse;
      return data.ok && data.url ? data.url : null;
    } catch {
      /* try the next mirror */
    }
  }
  return null;
}

export async function stationHomepage(uuid: string): Promise<string | null> {
  for (const host of HOSTS) {
    try {
      const res = await fetch(`https://${host}/json/stations/byuuid/${encodeURIComponent(uuid)}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const [station] = (await res.json()) as { homepage?: string }[];
      return station?.homepage && /^https?:\/\//.test(station.homepage) ? station.homepage : null;
    } catch {
      /* try the next mirror */
    }
  }
  return null;
}
