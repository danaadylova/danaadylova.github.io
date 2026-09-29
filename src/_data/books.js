// Global data `books` for the /books page, built from Goodreads at build time.
//
//   live Goodreads RSS  →  .cache/books/snapshot.json (last good copy)  →  build fails loudly
//
// Local development without network: BOOKS_FIXTURE=1 npm run serve  (uses test fixtures).
import fs from "node:fs/promises";
import path from "node:path";
import config from "../../lib/books/config.js";
import { fetchShelf } from "../../lib/books/fetch.js";
import { buildLibrary, spineGeometry } from "../../lib/books/goodreads.js";
import { processCovers } from "../../lib/books/covers.js";
import { loadReviews } from "../../lib/books/reviews.js";
import { cardYears, yearCard } from "../../lib/books/yearstats.js";

async function loadNotes() {
  try {
    return JSON.parse(await fs.readFile(config.notesFile, "utf8")).books || {};
  } catch {
    return {}; // no export yet
  }
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const log = {
  info: (m) => console.log(`[books] ${m}`),
  warn: (m) => console.warn(`[books] ⚠ ${m.replace(/^\[books\] /, "")}`),
};

async function fetchFeeds() {
  if (process.env.BOOKS_FIXTURE) {
    const { fixtureFeeds } = await import("../../test/fixtures/sample-library.js");
    return fixtureFeeds();
  }
  const uid = config.goodreadsUserId, opts = { log };
  const [read, reading, ...dnf] = await Promise.all([
    fetchShelf(uid, config.readShelf, opts),
    fetchShelf(uid, config.readingShelf, opts).catch((e) => (log.warn(`currently-reading: ${e.message}`), [])),
    // A missing tag/shelf shouldn't sink the build; the user_shelves check in buildLibrary still catches DNFs.
    ...config.dnfShelves.map((s) => fetchShelf(uid, s, opts).catch((e) => (log.warn(`${s}: ${e.message}`), []))),
  ]);
  config.dnfShelves.forEach((s, i) => log.info(`shelf "${s}": ${dnf[i].length} books`));
  log.info(`shelf "read": ${read.length} books · "currently-reading": ${reading.length}`);
  const feedCounts = { read: read.length, reading: reading.length, dnf: Object.fromEntries(config.dnfShelves.map((s, i) => [s, dnf[i].length])) };
  return { read, dnf, reading, feedCounts };
}

const serialize = (lib) => JSON.stringify(lib, (k, v) => (v instanceof Date ? v.toISOString() : v), 0);
const revive = (json) => JSON.parse(json, (k, v) => (["readAt", "addedAt", "when"].includes(k) && v ? new Date(v) : v));

async function loadLibrary() {
  const snapshot = path.join(config.cacheDir, "snapshot.json");
  try {
    const feeds = await fetchFeeds();
    if (!feeds.read.length) throw new Error(`the "read" shelf came back empty — is the Goodreads profile public?`);
    const lib = { ...buildLibrary(feeds, config), feedCounts: feeds.feedCounts || null };
    await fs.mkdir(config.cacheDir, { recursive: true });
    await fs.writeFile(snapshot, serialize({ ...lib, fetchedAt: new Date() }));
    return { ...lib, fetchedAt: new Date(), source: process.env.BOOKS_FIXTURE ? "fixture" : "goodreads" };
  } catch (err) {
    log.warn(`live fetch failed: ${err.message}`);
    try {
      const cached = revive(await fs.readFile(snapshot, "utf8"));
      log.warn(`using the cached snapshot from ${cached.fetchedAt.toISOString?.() ?? cached.fetchedAt}`);
      return { ...cached, source: "cache" };
    } catch {
      throw new Error(
        `[books] No Goodreads data and no cached snapshot. Check that https://www.goodreads.com/review/list_rss/${config.goodreadsUserId}?shelf=read ` +
          `shows books in a logged-out browser (profile must be public). Original error: ${err.message}`,
      );
    }
  }
}

async function decorate(lib) {
  const all = [...lib.reading, ...lib.years.flatMap((y) => y.books)];
  // Undated books stay off the shelf (decision #3), but posts can still show their covers (the {% favorite %} shortcode).
  const undatedWithCovers = (lib.skippedUndated || []).filter((b) => b.covers?.length);
  const covers = await processCovers([...all, ...undatedWithCovers], { dir: path.join(config.cacheDir, "covers"), log });
  const undated = (lib.skippedUndated || []).map((b) => ({ id: b.id, title: b.title, author: b.author, cover: covers.get(b.id)?.cover ?? null }));
  const withLook = (b) => {
    const c = covers.get(b.id) || {};
    const when = b.when ? new Date(b.when) : null;
    return {
      ...b,
      ...spineGeometry(b),
      cover: c.cover ?? null,
      coverWidth: c.width ?? null,
      coverHeight: c.height ?? null,
      color: c.color,
      textColor: c.text,
      whenLabel: when ? `${MONTHS[b.month - 1]} ${b.year}` : "",
      whenISO: when ? when.toISOString().slice(0, 10) : "",
    };
  };
  const reviews = await loadReviews("src/reviews", log);
  const withReview = (b) => (reviews.has(b.id) ? { ...b, review: reviews.get(b.id) } : b);
  const years = lib.years.map((y) => ({ ...y, books: y.books.map(withLook).map(withReview) }));
  const reading = lib.reading.map(withLook).map(withReview);
  const noCover = all.filter((b) => !covers.get(b.id)?.cover).length;
  log.info(
    `${lib.total} books in ${years.length} years (${lib.dnfTotal} unfinished, ${lib.lovedTotal} loved), ` +
      `${reading.length} currently reading, ${lib.skippedUndated.length} skipped (no read date), ${noCover} without a cover · source: ${lib.source}`,
  );
  // Compact JSON for src/js/books.js (short keys keep ~400 books around 100 KB).
  const notes = await loadNotes();
  const compact = (b) => ({
    id: b.id, t: b.title, s: b.series ? `${b.series}${b.seriesNumber ? ` #${b.seriesNumber}` : ""}` : undefined, a: b.author,
    r: b.rating || undefined, p: b.pages || undefined, d: b.dnf ? 1 : undefined, y: b.year, m: b.month,
    c: b.color, tc: b.textColor, w: b.width, h: b.height, f: b.font, v: b.variant,
    cv: b.cover || undefined, ar: b.cover && b.coverHeight ? +(b.coverWidth / b.coverHeight).toFixed(3) : undefined,
    u: b.url, rv: b.review?.html,
    nn: notes[b.id]?.length ? notes[b.id] : undefined,
    nc: notes[b.id]?.filter((n) => !n.is_author).length || undefined,
    dn: notes[b.id]?.some((n) => n.is_author) ? 1 : undefined,
  });
  // Reading cards (/books/<year>/) for finished years, newest first, with links to the neighbouring cards.
  const cardList = cardYears(years);
  const cards = cardList.map((year, i) => ({
    ...yearCard(year, years.find((y) => y.year === year).books),
    newer: cardList[i - 1] ?? null,
    older: cardList[i + 1] ?? null,
  }));
  const payload = JSON.stringify({
    lovedTotal: lib.lovedTotal, dnfTotal: lib.dnfTotal, foldRows: config.foldRows, notesApi: config.notesApi || null, cards: cardList,
    reading: reading.map(compact), years: years.map((y) => ({ year: y.year, books: y.books.map(compact) })),
  }).replace(/</g, "\\u003c"); // safe inside <script>
  return { ...lib, years, reading, undated, noCover, foldRows: config.foldRows, cards, cardYears: cardList, payload };
}

let memo; // `eleventy --serve` re-runs data files on every change; don't hit Goodreads each time.
export default async function () {
  if (memo && Date.now() - memo.at < 10 * 60 * 1000) return memo.data;
  const data = await decorate(await loadLibrary());
  memo = { at: Date.now(), data };
  return data;
}
