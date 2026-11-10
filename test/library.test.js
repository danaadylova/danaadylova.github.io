import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeWidget, pacificNoon, serializeLibrary, sameLibrary, libraryFromSnapshot, MAX_REMOVALS } from "../lib/books/library.js";
import { groupLibrary } from "../lib/books/goodreads.js";

const day = (d) => new Date(`${d}T20:00:00Z`).toISOString();
const book = (id, readAt, extra = {}) => ({ id, title: `Book ${id}`, series: null, seriesNumber: null, author: "A", rating: 3, pages: 300, readAt: readAt && day(readAt), addedAt: null, shelves: ["read"], covers: [`https://c/${id}.jpg`], url: `https://www.goodreads.com/book/show/${id}`, dnf: false, ...extra });
const entry = (id, rating = 3, title = `Book ${id}`) => ({ id, rawTitle: title, author: "A", rating, cover: `https://i.gr-assets.com/x/books/1l/${id}._SY75_.jpg` });
const NOW = new Date("2026-11-10T18:00:00Z"); // 10am Pacific

// library: 10 dated books, newest first 10 (Oct 25) … 1 (Oct 16), one DNF, one undated, one being read
const base = () => ({
  books: [...Array(10)].map((_, i) => book(String(i + 1), `2026-10-${16 + i}`)).concat(book("50", null, { dnf: true, addedAt: day("2026-10-12"), shelves: ["did-not-finish"] })),
  undated: [{ id: "60", title: "Undated", author: "U", covers: [] }],
  reading: [book("70", null, { addedAt: day("2026-09-29"), shelves: ["currently-reading"], pages: 671 })],
  checkedAt: null,
});
const readShelf = (...front) => [...front, ...[...Array(10)].map((_, i) => entry(String(10 - i)))];
const merge = (w, lib = base(), now = NOW) => mergeWidget(lib, { read: null, reading: null, dnf: [], ...w }, { now });

test("pacificNoon is the Pacific calendar day, in and out of daylight time", () => {
  assert.equal(pacificNoon(new Date("2026-11-10T06:30:00Z")).toISOString(), "2026-11-09T20:00:00.000Z"); // 10:30pm Nov 9 PST
  assert.equal(pacificNoon(new Date("2026-07-04T18:00:00Z")).toISOString(), "2026-07-04T19:00:00.000Z"); // PDT
});

test("nothing new: no changes, same file", () => {
  const { library, changes } = merge({ read: readShelf() });
  assert.deepEqual(changes.added, []);
  assert.ok(sameLibrary(base(), library));
});

test("a newly read book is dated the day it's first seen, and keeps that date afterwards", () => {
  const r1 = merge({ read: readShelf(entry("99", 4.5, "New One (Saga, #2)")) });
  const b = r1.library.books.find((x) => x.id === "99");
  assert.equal(b.readAt, pacificNoon(NOW).toISOString());
  assert.equal(b.dateSource, "first-seen");
  assert.equal(b.rating, 4.5);
  assert.equal(b.title, "New One");
  assert.equal(b.series, "Saga");
  assert.deepEqual(b.covers, ["https://i.gr-assets.com/x/books/1l/99.jpg", "https://i.gr-assets.com/x/books/1l/99._SX318_.jpg", "https://i.gr-assets.com/x/books/1l/99._SY75_.jpg"]);
  // a week later it's still on top of the shelf: nothing changes, the date stays
  const r2 = merge({ read: readShelf(entry("99", 4.5, "New One (Saga, #2)")) }, r1.library, new Date("2026-11-17T18:00:00Z"));
  assert.deepEqual(r2.changes.added, []);
  assert.ok(sameLibrary(r1.library, r2.library));
});

test("a date Dana fixed by hand is kept", () => {
  const r1 = merge({ read: readShelf(entry("99")) });
  r1.library.books.find((x) => x.id === "99").readAt = day("2026-11-01");
  const r2 = merge({ read: readShelf(entry("99")) }, r1.library, new Date("2026-11-12T18:00:00Z"));
  assert.equal(r2.library.books.find((x) => x.id === "99").readAt, day("2026-11-01"));
});

test("a book that finished earlier and was logged late is dated no later than the book listed above it", () => {
  const read = readShelf();
  read.splice(3, 0, entry("98")); // between book 8 (Oct 23) and book 7 (Oct 22)
  const b = merge({ read }).library.books.find((x) => x.id === "98");
  assert.equal(b.readAt, day("2026-10-23"));
});

test("a re-read jumps to the top and gets a new date; an undated book that's now dated joins the shelf", () => {
  const read = [entry("3"), entry("60"), ...readShelf().filter((e) => e.id !== "3")];
  const { library, changes } = merge({ read });
  assert.equal(library.books.find((x) => x.id === "3").readAt, pacificNoon(NOW).toISOString());
  assert.equal(changes.reread.length, 1);
  assert.equal(library.books.find((x) => x.id === "60").readAt, pacificNoon(NOW).toISOString());
  assert.equal(library.undated.length, 0);
});

test("ratings and titles follow Goodreads for books the widget shows", () => {
  const read = readShelf().map((e) => (e.id === "9" ? entry("9", 3.5, "Retitled (Series, #4)") : e));
  const { library, changes } = merge({ read });
  const b = library.books.find((x) => x.id === "9");
  assert.equal(b.rating, 3.5);
  assert.equal(b.title, "Retitled");
  assert.equal(b.pages, 300); // what the widget lacks is kept
  assert.equal(changes.rating.length, 1);
});

test("a book taken off the read shelf goes, but only inside the widget's window and only a few at a time", () => {
  const { library, changes } = merge({ read: readShelf().filter((e) => e.id !== "7") });
  assert.ok(!library.books.some((x) => x.id === "7"));
  assert.deepEqual(changes.removed, ["Book 7"]);
  // older than everything the widget shows: kept (it's simply past the newest 100)
  const lib = base();
  lib.books.push(book("0", "2020-01-01"));
  assert.ok(merge({ read: readShelf() }, lib).library.books.some((x) => x.id === "0"));
  // a response that has lost most books removes nothing and warns
  const many = base();
  for (let i = 0; i < MAX_REMOVALS + 1; i++) many.books.push(book(`x${i}`, "2026-10-20"));
  const r = merge({ read: readShelf() }, many);
  assert.equal(r.changes.removed.length, 0);
  assert.match(r.warnings[0], /none were removed/);
});

test("DNF: a book moved from read keeps its date; a new one is dated the day it's seen; a DNF tag on a read book stays put", () => {
  const read = readShelf().filter((e) => e.id !== "8");
  const { library, changes } = merge({ read: [entry("50"), ...read], dnf: [[entry("8"), entry("51")], null] });
  assert.equal(library.books.find((x) => x.id === "8").dnf, true);
  assert.equal(library.books.find((x) => x.id === "8").readAt, day("2026-10-23"));
  const n = library.books.find((x) => x.id === "51");
  assert.equal(n.dnf, true);
  assert.equal(n.addedAt, pacificNoon(NOW).toISOString());
  assert.equal(library.books.find((x) => x.id === "50").readAt, null); // DNF tag on a read-shelf book: not a new read
  assert.equal(changes.added.length, 0);
  assert.equal(changes.removed.length, 0);
});

test("currently reading is replaced, keeping known start dates and pages", () => {
  const { library, changes } = merge({ reading: [entry("70"), entry("71")] });
  assert.equal(library.reading[0].addedAt, day("2026-09-29"));
  assert.equal(library.reading[0].pages, 671);
  assert.equal(library.reading[1].addedAt, pacificNoon(NOW).toISOString());
  assert.match(changes.reading, /Book 70 → Book 70, Book 71/);
  assert.deepEqual(merge({ reading: null }).library.reading, base().reading); // the widget failed: keep
});

test("round trip: snapshot → library.json → page model", () => {
  const snap = { fetchedAt: "2026-10-27T18:41:18.261Z", reading: [], skippedUndated: [{ id: "60", title: "U", author: "A", covers: [] }],
    years: [{ year: 2026, books: [{ ...book("1", "2026-10-16"), when: day("2026-10-16"), year: 2026, month: 10 }] }] };
  const lib = JSON.parse(serializeLibrary(libraryFromSnapshot(snap)));
  assert.equal(lib.books[0].when, undefined);
  const page = groupLibrary(lib);
  assert.equal(page.total, 1);
  assert.equal(page.years[0].books[0].month, 10);
  assert.equal(page.skippedUndated.length, 1);
});
