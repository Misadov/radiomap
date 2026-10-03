// Fetches the full station list from the radio-browser.info community API.
// https://api.radio-browser.info — please be nice: one full sync per build.

const USER_AGENT = 'RadioMap/2.0 (+https://github.com/misadov/radiomap)';
const FALLBACK_MIRRORS = [
  'de1.api.radio-browser.info',
  'de2.api.radio-browser.info',
  'fi1.api.radio-browser.info',
  'nl1.api.radio-browser.info',
  'at1.api.radio-browser.info',
];
const PAGE = 10_000;

async function getJSON(url, timeoutMs = 120_000) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function discoverMirrors() {
  try {
    const servers = await getJSON('https://all.api.radio-browser.info/json/servers', 15_000);
    const names = [...new Set(servers.map((s) => s.name).filter(Boolean))];
    if (names.length) return [...names.sort(() => Math.random() - 0.5), ...FALLBACK_MIRRORS];
  } catch (err) {
    console.warn(`  ! mirror discovery failed (${err.message}), using fallbacks`);
  }
  return FALLBACK_MIRRORS;
}

async function getFromAnyMirror(mirrors, path) {
  let lastError;
  for (const host of [...new Set(mirrors)]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await getJSON(`https://${host}${path}`);
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export async function fetchAllStations(log = console.log) {
  const mirrors = await discoverMirrors();
  const stations = [];
  for (let offset = 0; ; offset += PAGE) {
    const batch = await getFromAnyMirror(
      mirrors,
      `/json/stations?hidebroken=true&order=stationuuid&limit=${PAGE}&offset=${offset}`,
    );
    stations.push(...batch);
    log(`  · ${stations.length.toLocaleString('en')} stations`);
    if (batch.length < PAGE) break;
  }
  return stations;
}
