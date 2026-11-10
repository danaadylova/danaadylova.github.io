// Global data `books` for the /books page, built at build time.
//
//   data/books/library.json (committed)  +  Goodreads' public shelf widget  →  updated library.json  →  page
//
// Goodreads retired shelf RSS on 2026-10-28; see lib/books/library.js for how the widget's gaps
// (no dates, no page counts, newest 100 only) are handled. If the widget fails, the committed library is
// used as is and the build says so loudly (and CI fails the run after deploying, which emails Dana).
//
// Local development without network: BOOKS_FIXTURE=1 npm run serve  (uses test fixtures).
import fs from "node:fs/promises";
import path from "node:path";
import config from "../../lib/books/config.js";
import { buildLibrary, groupLibrary, spineGeometry } from "../../lib/books/goodreads.js";
import { fetchWidget } from "../../lib/books/widget.js";
import { mergeWidget, describeChanges, serializeLibrary, sameLibrary } from "../../lib/books/library.js";
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

const inCI = !!process.env.GITHUB_ACTIONS;
const annotate = (level, title, msg) => inCI && console.log(`::${level} title=${title}::${msg.replace(/\r?\n/g, " ")}`);

async function fixtureLibrary() {
  const { fixtureFeeds } = await import("../../test/fixtures/sample-library.js");
  return { ...buildLibrary(fixtureFeeds(), config), fetchedAt: new Date(), source: "fixture", feedCounts: null };
}

/** Today's widget for every shelf. A shelf that fails is null (the merge then leaves that part alone). */
async function fetchWidgets() {
  const uid = config.goodreadsUserId, stamp = Date.now(), opts = { log, stamp };
  // BOOKS_WIDGET_DIR=dir: read saved widget responses (<shelf>.js) instead of Goodreads, for sandboxes that can't reach it.
  if (process.env.BOOKS_WIDGET_DIR) {
    opts.fetchImpl = async (url) => {
      const shelf = new URL(url).searchParams.get("shelf");
      const body = await fs.readFile(path.join(process.env.BOOKS_WIDGET_DIR, `${shelf}.js`), "utf8").catch(() => null);
      return { ok: !!body, status: body ? 200 : 404, text: async () => body };
    };
  }
  const soft = (p, what) => p.catch((e) => (log.warn(`${what}: ${e.message}`), null));
  const [read, reading, ...dnf] = await Promise.all([
    fetchWidget(uid, config.readShelf, { ...opts, sort: "date_read" }),
    soft(fetchWidget(uid, config.readingShelf, { ...opts, sort: "date_added" }), config.readingShelf),
    ...config.dnfShelves.map((s) => soft(fetchWidget(uid, s, { ...opts, sort: "date_added" }), s)),
  ]);
  if (!read.length) throw new Error(`the "read" widget came back empty; is the Goodreads profile still public?`);
  const feedCounts = { read: read.length, reading: reading?.length ?? null, dnf: Object.fromEntries(config.dnfShelves.map((s, i) => [s, dnf[i]?.length ?? null])) };
  log.info(`widget: read ${read.length} (newest 100 max) · currently-reading ${feedCounts.reading ?? "failed"} · ${config.dnfShelves.map((s, i) => `${s} ${dnf[i]?.length ?? "failed"}`).join(" · ")}`);
  return { read, reading, dnf, feedCounts };
}

async function loadLibrary() {
  if (process.env.BOOKS_FIXTURE) return fixtureLibrary();
  let prev;
  try {
    prev = JSON.parse(await fs.readFile(config.libraryFile, "utf8"));
  } catch (err) {
    throw new Error(`[books] can't read ${config.libraryFile} (${err.message}). It's committed to the repo; restore it from git.`);
  }
  const status = { ok: false, error: null, changes: [], warnings: [], checkedAt: prev.checkedAt };
  let library = prev, feedCounts = null;
  try {
    const w = await fetchWidgets();
    feedCounts = w.feedCounts;
    const merged = mergeWidget(prev, w);
    const now = new Date().toISOString();
    library = { ...merged.library, checkedAt: now };
    status.ok = true;
    status.checkedAt = now;
    status.changes = describeChanges(merged.changes);
    status.warnings = merged.warnings;
    for (const c of status.changes) (log.info(`changed · ${c}`), annotate("notice", "Books changed", c));
    for (const m of merged.warnings) (log.warn(m), annotate("warning", "Books", m));
    if (!status.changes.length) log.info("no changes on Goodreads since the last build");
    // Only touch the committed file when the books changed, so daily runs don't make empty commits.
    if (!sameLibrary(prev, library)) await fs.writeFile(config.libraryFile, serializeLibrary(library));
  } catch (err) {
    status.error = err.message;
    log.warn(`Goodreads widget failed, showing the committed library from ${prev.checkedAt}: ${err.message}`);
    annotate("error", "Books not updated", `Goodreads widget failed; /books shows the library as of ${prev.checkedAt}. ${err.message}`);
  }
  const lib = { ...groupLibrary(library), fetchedAt: new Date(status.checkedAt || Date.now()), source: status.ok ? "goodreads widget" : "committed library (widget failed)", feedCounts };
  await fs.mkdir(config.cacheDir, { recursive: true });
  await fs.writeFile(path.join(config.cacheDir, "status.json"), JSON.stringify(status, null, 2));
  await fs.writeFile(path.join(config.cacheDir, "snapshot.json"), serialize(lib)); // read by scripts/books-report.mjs
  return lib;
}

const serialize = (lib) => JSON.stringify(lib, (k, v) => (v instanceof Date ? v.toISOString() : v), 0);

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
