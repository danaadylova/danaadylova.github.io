// Pure functions for turning Goodreads data into the /books page model. The RSS parts (parseFeed, normalizeItem,
// buildLibrary) date from before Goodreads retired shelf RSS (2026-10-28) and now only serve the offline fixtures.
// No network or file access here, so everything is testable with fixtures.
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false, // keep ids, ratings, isbns as strings
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name, jpath) => jpath === "rss.channel.item",
});

/** Parse one RSS page into raw item objects. Throws on markup that isn't a Goodreads RSS feed. */
export function parseFeed(xml) {
  if (typeof xml !== "string" || !xml.trim()) throw new Error("empty feed body");
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel;
  if (!channel) throw new Error("not an RSS feed (no rss.channel) — is the shelf private or the URL wrong?");
  return channel.item || [];
}

const str = (v) => (v == null ? "" : typeof v === "object" ? String(v["#text"] ?? "") : String(v)).trim();
const int = (v) => {
  const n = parseInt(str(v), 10);
  return Number.isFinite(n) ? n : null;
};

/** "The Fifth Season (The Broken Earth, #1)" → { title: "The Fifth Season", series: "The Broken Earth", seriesNumber: "1" } */
export function splitSeries(raw) {
  const m = /^(.*\S)\s*\(([^()]+?)[,\s]*#\s*([\d.]+(?:-[\d.]+)?)\)\s*$/.exec(raw);
  if (!m) return { title: raw, series: null, seriesNumber: null };
  return { title: m[1], series: m[2].trim(), seriesNumber: m[3] };
}

/** Parse a Goodreads date ("Tue, 16 Sep 2025 00:00:00 -0700"); empty → null. */
export function parseDate(v) {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const tzParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "numeric" });
/** Calendar year + month (1-12) as seen in Pacific time. */
export function pacificYearMonth(date) {
  const parts = Object.fromEntries(tzParts.formatToParts(date).map((p) => [p.type, p.value]));
  return { year: +parts.year, month: +parts.month };
}

const NOPHOTO = /nophoto/i;
/** Goodreads serves resized covers like "…/12345._SY475_.jpg"; dropping the size token gives the original. */
export function coverCandidates(item) {
  const urls = [str(item.book_large_image_url), str(item.book_medium_image_url), str(item.book_image_url)]
    .filter((u) => u && !NOPHOTO.test(u));
  const out = [];
  for (const u of urls) {
    const full = u.replace(/\._S[XY]\d+(?:_S[XY]\d+)?_(?=\.\w+$)/, "");
    for (const c of [full, u]) if (!out.includes(c)) out.push(c);
  }
  return out;
}

/** One RSS item → a normalized book (still without year grouping or spine styling). */
export function normalizeItem(item) {
  const id = str(item.book_id) || str(item.book?.["@_id"]);
  if (!id) return null;
  const { title, series, seriesNumber } = splitSeries(str(item.title));
  const shelves = str(item.user_shelves)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return {
    id,
    title,
    series,
    seriesNumber,
    author: str(item.author_name),
    rating: int(item.user_rating) || 0,
    pages: int(item.book?.num_pages) || null,
    published: int(item.book_published),
    isbn: str(item.isbn) || null,
    readAt: parseDate(item.user_read_at),
    addedAt: parseDate(item.user_date_added),
    shelves,
    covers: coverCandidates(item),
    url: `https://www.goodreads.com/book/show/${id}`,
  };
}

/**
 * Merge the shelves into the page model.
 * @param {object} feeds { read: item[], dnf: item[][] (one list per DNF shelf/tag), reading: item[] }
 * @param {object} cfg   { dnfShelves: string[] }
 */
export function buildLibrary(feeds, cfg) {
  const dnfNames = new Set(cfg.dnfShelves.map((s) => s.toLowerCase()));
  const byId = new Map();
  const add = (item, patch) => {
    const b = normalizeItem(item);
    if (!b) return;
    const prev = byId.get(b.id);
    byId.set(b.id, prev ? { ...prev, ...patch, dnf: prev.dnf || patch.dnf } : { ...b, ...patch });
  };
  for (const it of feeds.read || []) add(it, { dnf: false });
  for (const list of feeds.dnf || []) for (const it of list) add(it, { dnf: true });
  // Second check: a DNF tag listed on a book that only came through the read feed.
  for (const b of byId.values()) if (b.shelves.some((s) => dnfNames.has(s))) b.dnf = true;
  const reading = (feeds.reading || []).map(normalizeItem).filter(Boolean);
  return groupLibrary({ books: [...byId.values()], reading });
}

/**
 * Normalized books → the page model: dated books grouped into Pacific-time years, undated ones set aside.
 * Shared by the RSS fixtures (buildLibrary) and the committed library + widget (lib/books/library.js).
 * @param {{books: object[], reading?: object[], undated?: object[]}} lib  dates may be Date objects or ISO strings
 */
export function groupLibrary({ books, reading = [], undated = [] }) {
  const asDate = (v) => (v ? (v instanceof Date ? v : new Date(v)) : null);
  const years = new Map();
  const skipped = undated.map((b) => ({ id: b.id, title: b.title, author: b.author, covers: b.covers || [] }));
  for (const raw of books) {
    const b = { ...raw, readAt: asDate(raw.readAt), addedAt: asDate(raw.addedAt) };
    // DNF books have no read date; when they were put down ≈ when they were shelved.
    const when = b.readAt || (b.dnf ? b.addedAt : null);
    if (!when) {
      // kept (with cover candidates) so posts can still show their covers; they stay off the shelf
      skipped.push({ id: b.id, title: b.title, author: b.author, covers: b.covers || [] });
      continue;
    }
    const { year, month } = pacificYearMonth(when);
    const book = { ...b, when, year, month };
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(book);
  }
  const yearList = [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, books]) => ({
      year,
      books: books.sort((a, b) => b.when - a.when),
      dnfCount: books.filter((b) => b.dnf).length,
    }));

  const readingList = reading
    .map((raw) => {
      const started = asDate(raw.addedAt);
      const ym = started ? pacificYearMonth(started) : null;
      return { ...raw, addedAt: started, readAt: asDate(raw.readAt), reading: true, dnf: false, when: started, year: ym?.year ?? null, month: ym?.month ?? null };
    })
    .sort((a, b) => (b.when || 0) - (a.when || 0));

  const total = yearList.reduce((n, y) => n + y.books.length, 0);
  return {
    total,
    dnfTotal: yearList.reduce((n, y) => n + y.dnfCount, 0),
    lovedTotal: yearList.reduce((n, y) => n + y.books.filter((b) => !b.dnf && b.rating >= 4).length, 0),
    reading: readingList,
    years: yearList,
    skippedUndated: skipped,
  };
}

/* ── spine sizing: stable per book, like the prototype ── */

export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const FONTS = ["serif", "mono", "grot"];
export function spineGeometry(book) {
  const h = hash(book.id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const width = book.pages
    ? Math.round(clamp(18 + ((book.pages - 180) / (720 - 180)) * 28, 18, 46))
    : 18 + (h % 29);
  return {
    width,
    height: 150 + ((h >>> 5) % 41),
    font: FONTS[(h >>> 3) % 3],
    variant: h % 3, // generated-cover layout when there's no real cover
  };
}
