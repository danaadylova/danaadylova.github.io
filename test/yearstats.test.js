import { test } from "node:test";
import assert from "node:assert/strict";
import { yearCard, cardYears } from "../lib/books/yearstats.js";

const b = (id, o) => ({ id, title: `Book ${id}`, author: "A", rating: 3, pages: 300, month: 1, when: `2025-0${o.month || 1}-${String(o.day || 1).padStart(2, "0")}`, ...o });

test("only finished years get a reading card (Pacific time)", () => {
  const years = [{ year: 2026 }, { year: 2025 }, { year: 2024 }];
  assert.deepEqual(cardYears(years, new Date("2026-09-29T12:00:00Z")), [2025, 2024]);
  // 3am UTC on Jan 1 is still Dec 31 in California: 2025 is not finished yet
  assert.deepEqual(cardYears([{ year: 2025 }, { year: 2024 }], new Date("2026-01-01T03:00:00Z")), [2024]);
});

test("totals leave out unfinished books; biggest month is by pages", () => {
  const c = yearCard(2025, [
    b("1", { pages: 1344, rating: 4, month: 1 }),
    b("2", { pages: 76, rating: 3, month: 2 }),
    b("3", { pages: 200, rating: 5, month: 2 }),
    b("4", { pages: 900, dnf: true, month: 3 }),
    b("5", { pages: 0, rating: 0, month: 2 }),
  ]);
  assert.equal(c.count, 4);
  assert.equal(c.pages, 1620);
  assert.equal(c.pagesPerDay, 4);
  assert.equal(c.avgRating, 4); // the unrated book doesn't count as 0★
  assert.equal(c.fiveStar, 1);
  assert.equal(c.fourStar, 1);
  assert.deepEqual(c.busiestMonth, { name: "January", pages: 1344 });
  assert.equal(c.biggest.id, "1");
  assert.equal(c.smallest.id, "2"); // books with no page count are ignored
  assert.equal(c.months[2].count, 0); // March only had the DNF
});

test("each month's top 3: highest rated first, ties go to the book finished first; chart puts loved books at the bottom", () => {
  const c = yearCard(2025, [
    b("a", { rating: 5, day: 20 }), b("b", { rating: 5, day: 3 }), b("c", { rating: 2, day: 1 }),
    b("d", { rating: 5, day: 10 }), b("e", { rating: 4, day: 2, pages: 50 }),
  ]);
  assert.deepEqual(c.months[0].top.map((x) => x.id), ["b", "d", "a"]);
  assert.deepEqual(c.months[0].blocks.map((x) => x.loved), [true, true, true, true, false]);
  assert.equal(c.maxMonthPages, 1250);
});

test("authors: most read and highest rated (2+ books) as two lists, merged when they are the same people", () => {
  const two = yearCard(2025, [
    b("1", { author: "Anna  Lee Huber", rating: 2 }), b("2", { author: "Anna Lee Huber", rating: 3 }), b("3", { author: "Anna Lee Huber", rating: 3 }),
    b("4", { author: "Olivia Atwater", rating: 4 }), b("5", { author: "Olivia Atwater", rating: 4 }),
    b("6", { author: "Solo", rating: 5 }),
  ]);
  assert.deepEqual(two.authors.mostRead.map((a) => a.name), ["Anna Lee Huber", "Olivia Atwater", "Solo"]);
  assert.deepEqual(two.authors.highestRated.map((a) => a.name), ["Olivia Atwater", "Anna Lee Huber"]); // Solo has 1 book
  assert.deepEqual(two.authors.inBoth.sort(), ["Anna Lee Huber", "Olivia Atwater"]);

  const same = yearCard(2025, [
    b("1", { author: "X", rating: 5 }), b("2", { author: "X", rating: 5 }), b("3", { author: "Y", rating: 4 }), b("4", { author: "Y", rating: 4 }),
  ]);
  assert.deepEqual(same.authors.together.map((a) => a.name), ["X", "Y"]);
});
