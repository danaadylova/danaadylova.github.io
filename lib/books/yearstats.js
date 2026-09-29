// Stats for the per-year "reading card" pages (/books/<year>/). Design: docs/prd-books.md §6.8.
// Input: one year's decorated books (see src/_data/books.js). Unfinished (DNF) books are left out of everything.
import { pacificYearMonth } from "./goodreads.js";

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const authorName = (b) => String(b.author || "").replace(/\s+/g, " ").trim();
const shortTitle = (t) => String(t || "").split(":")[0].trim();
const time = (b) => (b.when ? new Date(b.when).getTime() : 0);
const avgRating = (books) => {
  const r = books.filter((b) => b.rating).map((b) => b.rating);
  return r.length ? r.reduce((a, x) => a + x, 0) / r.length : 0;
};
const book = (b) => ({
  id: b.id, title: shortTitle(b.title), author: authorName(b), rating: b.rating || 0, pages: b.pages || 0,
  cover: b.cover || null, loved: (b.rating || 0) >= 4,
});

/** Finished calendar years only: the year in progress (Pacific time) never gets a card. */
export function cardYears(years, now = new Date()) {
  const { year: current } = pacificYearMonth(now);
  return years.map((y) => y.year).filter((y) => y < current).sort((a, b) => b - a);
}

export function yearCard(year, books, { topAuthors = 3, minBooksForRating = 2 } = {}) {
  const done = books.filter((b) => !b.dnf);
  const rated = done.filter((b) => b.rating);
  const pages = done.reduce((a, b) => a + (b.pages || 0), 0);
  const withPages = done.filter((b) => b.pages);

  const months = MONTH_NAMES.map((name, i) => {
    const list = done.filter((b) => b.month === i + 1);
    return {
      month: i + 1, name, short: name.slice(0, 3).toLowerCase(),
      count: list.length,
      pages: list.reduce((a, b) => a + (b.pages || 0), 0),
      // highest rated first; ties go to the book finished first
      top: list.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0) || time(a) - time(b)).slice(0, 3).map(book),
      // chart blocks: loved books at the bottom, then longest first
      blocks: list.slice().sort((a, b) => ((b.rating || 0) >= 4) - ((a.rating || 0) >= 4) || (b.pages || 0) - (a.pages || 0)).map(book),
    };
  });
  const busiest = months.reduce((m, x) => (x.pages > m.pages ? x : m), months[0]);
  const maxMonthPages = Math.max(1, ...months.map((m) => m.pages));

  const byAuthor = new Map();
  for (const b of done) {
    const a = authorName(b);
    if (!byAuthor.has(a)) byAuthor.set(a, []);
    byAuthor.get(a).push(b);
  }
  const authors = [...byAuthor].map(([name, list]) => ({
    name, count: list.length, avg: avgRating(list),
    books: list.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0) || time(a) - time(b)).map(book),
  }));
  const mostRead = authors.slice().sort((a, b) => b.count - a.count || b.avg - a.avg || a.name.localeCompare(b.name)).slice(0, topAuthors);
  const highestRated = authors.filter((a) => a.count >= minBooksForRating && a.avg > 0)
    .sort((a, b) => b.avg - a.avg || b.count - a.count || a.name.localeCompare(b.name)).slice(0, topAuthors);
  const names = (l) => l.map((a) => a.name).sort().join("|");
  const sameAuthors = highestRated.length > 0 && names(mostRead) === names(highestRated);
  const inBoth = new Set(mostRead.map((a) => a.name).filter((n) => highestRated.some((a) => a.name === n)));

  return {
    year,
    count: done.length,
    pages,
    pagesPerDay: Math.round(pages / (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365)),
    avgRating: avgRating(rated),
    fiveStar: done.filter((b) => b.rating === 5).length,
    fourStar: done.filter((b) => b.rating === 4).length,
    busiestMonth: busiest.pages ? { name: busiest.name, pages: busiest.pages } : null,
    biggest: withPages.length ? book(withPages.reduce((m, b) => (b.pages > m.pages ? b : m))) : null,
    smallest: withPages.length > 1 ? book(withPages.reduce((m, b) => (b.pages < m.pages ? b : m))) : null,
    authors: sameAuthors ? { together: mostRead } : { mostRead, highestRated, inBoth: [...inBoth] },
    months,
    maxMonthPages,
  };
}
