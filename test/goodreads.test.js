import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeed, splitSeries, normalizeItem, buildLibrary, coverCandidates, pacificYearMonth, spineGeometry } from "../lib/books/goodreads.js";
import { spineColors, contrast, INK, PAPER } from "../lib/books/color.js";
import { item, page } from "./fixtures/goodreads.js";

const cfg = { dnfShelves: ["did-not-finish", "dnf"] };

test("parses a Goodreads RSS page, including CDATA, entities and the <book id> wrapper", () => {
  const items = parseFeed(page([item({ id: "19161852", title: "The Fifth Season (The Broken Earth, #1)", author: "N.K. Jemisin", rating: 5, readAt: "Tue, 16 Sep 2025 00:00:00 -0700", pages: "468" })]));
  assert.equal(items.length, 1);
  const b = normalizeItem(items[0]);
  assert.equal(b.id, "19161852");
  assert.equal(b.title, "The Fifth Season");
  assert.equal(b.series, "The Broken Earth");
  assert.equal(b.seriesNumber, "1");
  assert.equal(b.author, "N.K. Jemisin");
  assert.equal(b.rating, 5);
  assert.equal(b.pages, 468);
  assert.equal(b.url, "https://www.goodreads.com/book/show/19161852");
});

test("a page with a single item still yields an array", () => {
  assert.equal(parseFeed(page([item({ id: "1", title: "Solo" })])).length, 1);
});

test("an empty shelf yields no items; non-RSS markup is an error", () => {
  assert.deepEqual(parseFeed(page([])), []);
  assert.throws(() => parseFeed("<html><body>Sign in</body></html>"), /not an RSS feed/);
  assert.throws(() => parseFeed(""), /empty/);
});

test("titles: series suffix variants, and titles with parentheses that aren't series", () => {
  assert.deepEqual(splitSeries("Piranesi"), { title: "Piranesi", series: null, seriesNumber: null });
  assert.equal(splitSeries("Assassin's Apprentice (Farseer Trilogy #1)").series, "Farseer Trilogy");
  assert.equal(splitSeries("The Way of Kings (The Stormlight Archive, #1)").title, "The Way of Kings");
  assert.equal(splitSeries("Oathbringer (The Stormlight Archive, #3.5)").seriesNumber, "3.5");
  assert.equal(splitSeries("Collected Stories (Vintage Classics)").title, "Collected Stories (Vintage Classics)");
  assert.equal(normalizeItem(parseFeed(page([item({ id: "2", title: "Salt & Honey" })]))[0]).title, "Salt & Honey");
});

test("covers: prefers the full-size original, skips Goodreads 'nophoto' placeholders", () => {
  const [it] = parseFeed(page([item({ id: "7", title: "X" })]));
  const c = coverCandidates(it);
  assert.equal(c[0], "https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1600000000i/7.jpg");
  assert.ok(c.includes("https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1600000000i/7._SY475_.jpg"));
  const [np] = parseFeed(page([item({ id: "8", title: "Y", image: "https://s.gr-assets.com/assets/nophoto/book/111x148-bcc042a9c91a29c1d680899eff700a03.png" })]));
  assert.deepEqual(coverCandidates(np), []);
});

test("years use Pacific time: a book finished late on Dec 31 in LA belongs to that year", () => {
  assert.deepEqual(pacificYearMonth(new Date("2026-01-01T06:30:00Z")), { year: 2025, month: 12 });
  assert.deepEqual(pacificYearMonth(new Date("Tue, 16 Sep 2025 00:00:00 -0700")), { year: 2025, month: 9 });
});

test("library: groups by year newest first, drops undated reads, merges both DNF sources without duplicates", () => {
  const read = parseFeed(page([
    item({ id: "1", title: "Newest", rating: 4, readAt: "Sat, 20 Sep 2026 00:00:00 -0700" }),
    item({ id: "2", title: "Older", rating: 5, readAt: "Sat, 01 Mar 2025 00:00:00 -0800" }),
    item({ id: "3", title: "No date", rating: 3, readAt: "" }),
    item({ id: "4", title: "Tagged DNF in read", readAt: "Fri, 01 Aug 2025 00:00:00 -0700", shelves: "dnf, favorites" }),
    item({ id: "5", title: "Mid 2026", rating: 3, readAt: "Wed, 01 Apr 2026 00:00:00 -0700" }),
  ]));
  const didNotFinish = parseFeed(page([item({ id: "6", title: "Abandoned", addedAt: "Thu, 10 Jul 2025 09:00:00 -0700", shelves: "did-not-finish" })], "did-not-finish"));
  const dnfTag = parseFeed(page([
    item({ id: "6", title: "Abandoned", addedAt: "Thu, 10 Jul 2025 09:00:00 -0700", shelves: "did-not-finish, dnf" }),
    item({ id: "4", title: "Tagged DNF in read", readAt: "Fri, 01 Aug 2025 00:00:00 -0700", shelves: "dnf, favorites" }),
  ], "dnf"));
  const reading = parseFeed(page([item({ id: "9", title: "On my nightstand", addedAt: "Mon, 21 Sep 2026 20:00:00 -0700", shelves: "currently-reading" })], "currently-reading"));

  const lib = buildLibrary({ read, dnf: [didNotFinish, dnfTag], reading }, cfg);
  assert.deepEqual(lib.years.map((y) => y.year), [2026, 2025]);
  assert.deepEqual(lib.years[0].books.map((b) => b.id), ["1", "5"]);
  assert.deepEqual(lib.years[1].books.map((b) => b.id), ["4", "6", "2"]); // Aug, Jul, Mar
  assert.equal(lib.total, 5);
  assert.equal(lib.dnfTotal, 2);
  assert.equal(lib.years[1].dnfCount, 2);
  assert.equal(lib.lovedTotal, 2); // ids 1 (4★) and 2 (5★); DNFs never count as loved
  assert.deepEqual(lib.skippedUndated.map(({ id, title }) => ({ id, title })), [{ id: "3", title: "No date" }]);
  assert.ok(Array.isArray(lib.skippedUndated[0].covers)); // kept so posts can show the cover
  assert.equal(lib.reading.length, 1);
  assert.equal(lib.reading[0].title, "On my nightstand");
  assert.equal(lib.reading[0].month, 9);
});

test("a DNF book with no read date uses the date it was shelved", () => {
  const dnf = parseFeed(page([item({ id: "6", title: "Abandoned", readAt: "", addedAt: "Thu, 10 Jul 2025 09:00:00 -0700" })], "dnf"));
  const lib = buildLibrary({ read: [], dnf: [dnf], reading: [] }, cfg);
  assert.equal(lib.years[0].year, 2025);
  assert.equal(lib.years[0].books[0].month, 7);
  assert.equal(lib.skippedUndated.length, 0);
});

test("spine geometry is stable per book and scales with page count", () => {
  const a = spineGeometry({ id: "42", pages: 180 }), b = spineGeometry({ id: "42", pages: 720 });
  assert.equal(a.width, 18);
  assert.equal(b.width, 46);
  assert.deepEqual(spineGeometry({ id: "42", pages: 300 }), spineGeometry({ id: "42", pages: 300 }));
  const g = spineGeometry({ id: "999", pages: null });
  assert.ok(g.width >= 18 && g.width <= 46 && g.height >= 150 && g.height <= 190);
});

test("spine colors: every result passes AA against its text color, including neon and mid-grey covers", () => {
  for (const rgb of [[255, 0, 255], [0, 255, 0], [128, 128, 128], [250, 250, 250], [5, 5, 5], [120, 100, 90], [200, 60, 40]]) {
    const { color, text } = spineColors(rgb);
    assert.ok([INK, PAPER].includes(text));
    assert.ok(contrast(color, text) >= 4.5, `${rgb} → ${color} on ${text} = ${contrast(color, text).toFixed(2)}`);
  }
});
