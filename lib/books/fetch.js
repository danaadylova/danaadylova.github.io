// Fetch every page of a Goodreads shelf RSS feed. Build-time only; never runs in visitors' browsers.
import { parseFeed } from "./goodreads.js";

const UA = "danaadylova.com-books/1.0 (+https://danaadylova.com/books/)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function shelfUrl(userId, shelf, page) {
  return `https://www.goodreads.com/review/list_rss/${userId}?shelf=${encodeURIComponent(shelf)}&page=${page}`;
}

async function getText(url, { fetchImpl = fetch, retries = 3, log = console } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml;q=0.9" } });
      if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { fatal: true });
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (err.fatal || attempt === retries) break;
      log.warn?.(`[books] ${url} failed (${err.message}); retrying`);
      await sleep(800 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`could not fetch ${url}: ${lastErr?.message}`);
}

/**
 * All items on a shelf, following ?page= until an empty page, or a page with nothing new
 * (in case Goodreads ignores the page parameter and repeats page 1).
 */
export async function fetchShelf(userId, shelf, { maxPages = 50, ...opts } = {}) {
  const all = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const items = parseFeed(await getText(shelfUrl(userId, shelf, page), opts));
    const fresh = items.filter((it) => {
      const id = String(it.book_id ?? "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    if (!fresh.length) break;
    all.push(...fresh);
  }
  return all;
}
