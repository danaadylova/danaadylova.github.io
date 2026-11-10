// The /books library since Goodreads retired shelf RSS (2026-10-28).
//
//   data/books/library.json (committed)  +  today's Goodreads widget  →  updated library.json  →  the page
//
// library.json started as the last RSS snapshot (data/books/goodreads-archive-2026-10-27.json) and is the
// source of truth: every build merges the widget into it and CI commits it back when something changed.
// The widget only shows the newest 100 books per shelf with no dates and no page counts, so:
//   - a newly read book is dated the (Pacific) day a build first sees it, marked `dateSource: "first-seen"`.
//     Dana can correct `readAt` by hand in library.json; later builds keep her date.
//   - a book that jumps to the top of the read shelf above books read after it was re-read: same rule.
//   - a dated book newer than the oldest one the widget shows, but missing from it, left the read shelf.
//   - ratings, titles and DNF status come from the widget for the books it shows.
// Pure functions; the network and files are handled in src/_data/books.js.
import { splitSeries } from "./goodreads.js";
import { widgetCovers } from "./widget.js";

const DAY = 864e5;
/** Removing more books than this in one build looks like a bad response, not Dana's shelving: skip removals. */
export const MAX_REMOVALS = 5;

/** Noon in Los Angeles on the Pacific calendar day of `now`, so the day never shifts across time zones. */
export function pacificNoon(now = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const guess = new Date(`${ymd}T20:00:00Z`); // 12:00 PST
  const hour = +new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }).format(guess);
  return new Date(guess.getTime() - (hour - 12) * 3600 * 1000); // 19:00Z during daylight time
}

const iso = (d) => (d == null ? null : new Date(d).toISOString());
const time = (v) => (v ? Date.parse(v) : null);
const KEEP = ["id", "title", "series", "seriesNumber", "author", "rating", "pages", "published", "isbn", "readAt", "addedAt", "shelves", "covers", "url", "dnf", "dateSource"];
const clean = (b) => Object.fromEntries(KEEP.filter((k) => b[k] !== undefined).map((k) => [k, b[k] instanceof Date ? b[k].toISOString() : b[k]]));

/** An RSS-era snapshot (grouped by year) → the flat library.json shape. */
export function libraryFromSnapshot(snap) {
  return {
    books: snap.years.flatMap((y) => y.books).map(clean),
    undated: (snap.skippedUndated || []).map((b) => ({ id: b.id, title: b.title, author: b.author, covers: b.covers || [] })),
    reading: (snap.reading || []).map(clean),
    checkedAt: iso(snap.fetchedAt),
  };
}

/** Stable, one-book-per-line JSON so daily commits have readable diffs. */
export function serializeLibrary(lib) {
  const when = (b) => time(b.readAt) ?? time(b.addedAt) ?? 0;
  const books = lib.books.slice().sort((a, b) => when(b) - when(a) || a.id.localeCompare(b.id));
  const undated = lib.undated.slice().sort((a, b) => a.id.localeCompare(b.id));
  const list = (xs) => (xs.length ? `[\n${xs.map((x) => "    " + JSON.stringify(clean(x))).join(",\n")}\n  ]` : "[]");
  return (
    `{\n  "about": "The /books library. Built daily from Goodreads' shelf widget (lib/books/library.js). Fix a date by editing readAt (DNF: addedAt); dateSource first-seen marks dates the build guessed.",\n` +
    `  "checkedAt": ${JSON.stringify(lib.checkedAt ?? null)},\n` +
    `  "reading": ${list(lib.reading)},\n  "books": ${list(books)},\n  "undated": ${list(undated)}\n}\n`
  );
}

/** Same library, ignoring when it was last checked: decides whether there's anything to commit. */
export const sameLibrary = (a, b) => serializeLibrary({ ...a, checkedAt: null }) === serializeLibrary({ ...b, checkedAt: null });

/**
 * Merge one day's widget into the library.
 * @param {object} prev  library.json contents
 * @param {object} w     { read: entry[] | null, reading: entry[] | null, dnf: (entry[] | null)[] } — null = that shelf failed
 * @returns {{ library: object, changes: object, warnings: string[] }}
 */
export function mergeWidget(prev, w, { now = new Date() } = {}) {
  const today = pacificNoon(now).getTime();
  const books = new Map(prev.books.map((b) => [b.id, { ...b }]));
  const undated = new Map(prev.undated.map((b) => [b.id, { ...b }]));
  // What we already know about a book (pages, covers, isbn…) wherever it was, for books the widget re-introduces.
  const known = new Map();
  for (const b of [...prev.undated, ...prev.reading, ...prev.books]) known.set(b.id, { ...known.get(b.id), ...b });
  const changes = { added: [], reread: [], removed: [], nowDnf: [], rating: [], reading: null };
  const warnings = [];

  const fromWidget = (e) => {
    const k = known.get(e.id) || {};
    const { title, series, seriesNumber } = e.rawTitle ? splitSeries(e.rawTitle) : k;
    return {
      id: e.id,
      title: title || k.title || "",
      series: series ?? null,
      seriesNumber: seriesNumber ?? null,
      author: e.author || k.author || "",
      rating: e.rating,
      pages: k.pages ?? null,
      published: k.published ?? null,
      isbn: k.isbn ?? null,
      readAt: null,
      addedAt: null,
      shelves: [],
      covers: k.covers?.length ? k.covers : widgetCovers(e.cover),
      url: `https://www.goodreads.com/book/show/${e.id}`,
      dnf: false,
    };
  };
  const refresh = (b, e) => {
    if (b.rating !== e.rating) changes.rating.push(`${b.title}: ${b.rating || "unrated"} → ${e.rating || "unrated"}`);
    b.rating = e.rating;
    if (e.author) b.author = e.author;
    if (e.rawTitle) Object.assign(b, splitSeries(e.rawTitle));
  };

  // ── read shelf: newest first by date read ──
  const inRead = new Set();
  let readWindow = null;
  if (w.read) {
    const list = w.read;
    const dateOf = (e) => {
      const b = books.get(e.id);
      return b && !b.dnf ? time(b.readAt) : null;
    };
    // floor[i] = newest known read date among books listed after i (i.e. read before it)
    const floor = new Array(list.length).fill(null);
    for (let i = list.length - 1, mx = null; i >= 0; i--) {
      floor[i] = mx;
      const d = dateOf(list[i]);
      if (d != null) mx = mx == null ? d : Math.max(mx, d);
    }
    let above = null; // date of the book listed just above
    let oldestInPlace = null;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      inRead.add(e.id);
      const existing = books.get(e.id);
      if (existing?.dnf) {
        refresh(existing, e); // a DNF tag on a read-shelf book: it stays where its DNF date put it
        continue;
      }
      const d = dateOf(e);
      const reread = d != null && floor[i] != null && floor[i] - d > DAY;
      if (d != null && !reread) {
        refresh(books.get(e.id), e);
        above = d;
        oldestInPlace = d;
        continue;
      }
      if (d == null && floor[i] == null) continue; // nothing dated below it: older than anything we can place
      const date = above != null ? Math.min(today, above) : today;
      const nb = books.has(e.id) ? books.get(e.id) : { ...fromWidget(e), shelves: ["read"] };
      refresh(nb, e);
      Object.assign(nb, { readAt: new Date(date).toISOString(), dateSource: "first-seen", dnf: false });
      books.set(e.id, nb);
      undated.delete(e.id);
      (reread ? changes.reread : changes.added).push(`${nb.title} (${new Date(date).toISOString().slice(0, 10)})`);
      above = date;
    }
    readWindow = oldestInPlace;
  }

  // ── did-not-finish shelf + dnf tag ──
  const inDnf = new Set();
  for (const list of w.dnf || []) {
    if (!list) continue;
    for (const e of list) {
      inDnf.add(e.id);
      const b = books.get(e.id);
      if (b) {
        if (!b.dnf) {
          b.dnf = true;
          changes.nowDnf.push(b.title);
        }
        refresh(b, e);
        continue;
      }
      const nb = { ...fromWidget(e), shelves: ["did-not-finish"], dnf: true, addedAt: new Date(today).toISOString(), dateSource: "first-seen" };
      books.set(e.id, nb);
      undated.delete(e.id);
      changes.nowDnf.push(`${nb.title} (${new Date(today).toISOString().slice(0, 10)})`);
    }
  }

  // ── left the read shelf: dated, not DNF, newer than the oldest book the widget showed, yet not in it ──
  if (w.read && readWindow != null && w.read.length >= 5) {
    const gone = [...books.values()].filter((b) => !b.dnf && !inRead.has(b.id) && !inDnf.has(b.id) && time(b.readAt) > readWindow);
    if (gone.length > MAX_REMOVALS) {
      warnings.push(`${gone.length} books look removed from the read shelf; that's more than ${MAX_REMOVALS}, so none were removed (${gone.slice(0, 5).map((b) => b.title).join("; ")}…)`);
    } else {
      for (const b of gone) {
        books.delete(b.id);
        changes.removed.push(b.title);
      }
    }
  }

  // ── currently reading: replaced by the widget, keeping the start date we first saw ──
  let reading = prev.reading;
  if (w.reading) {
    const before = new Map(prev.reading.map((b) => [b.id, b]));
    reading = w.reading.map((e) => {
      const old = before.get(e.id);
      const b = old ? { ...old } : { ...fromWidget(e), shelves: ["currently-reading"], addedAt: new Date(today).toISOString(), dateSource: "first-seen" };
      refresh(b, e);
      return b;
    });
    const names = (xs) => xs.map((b) => b.title).join(", ");
    if (names(reading) !== names(prev.reading)) changes.reading = `${names(prev.reading) || "nothing"} → ${names(reading) || "nothing"}`;
  }

  return {
    library: { books: [...books.values()], undated: [...undated.values()], reading, checkedAt: prev.checkedAt },
    changes,
    warnings,
  };
}

/** One line per kind of change, for the build log. */
export function describeChanges(c) {
  const out = [];
  if (c.added.length) out.push(`newly read: ${c.added.join("; ")}`);
  if (c.reread.length) out.push(`re-read: ${c.reread.join("; ")}`);
  if (c.nowDnf.length) out.push(`didn't finish: ${c.nowDnf.join("; ")}`);
  if (c.removed.length) out.push(`left the read shelf: ${c.removed.join("; ")}`);
  if (c.rating.length) out.push(`ratings: ${c.rating.join("; ")}`);
  if (c.reading) out.push(`currently reading: ${c.reading}`);
  return out;
}
