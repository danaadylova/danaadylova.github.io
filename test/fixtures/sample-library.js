// Offline sample data for `BOOKS_FIXTURE=1 npm run serve` (no Goodreads access needed).
import { parseFeed } from "../../lib/books/goodreads.js";
import { item, page } from "./goodreads.js";

const titles = [
  ["The Salt Orchard", "Mireille Oyelaran", 5], ["A Cartography of Small Hours", "Tomas Vey", 4],
  ["Wool & Weather", "Ines Halvorsen", 4], ["Nine Lanterns for the Drowned King (The Lantern Cycle, #1)", "R. J. Castellan", 5],
  ["Letters from the Loom", "Priya Anand-Walsh", 3], ["The Quiet Engine", "Oskar Lindqvist", 4],
  ["Moth Season", "Adaeze Nwosu", 4], ["Undertow", "Mara Ellison", 3], ["The Bone Harp", "Idris Calder", 4],
  ["The Iron Botanist", "Cyrus Adebayo", 5], ["The Knitted Map", "Rosalind Pye", 4], ["Harbor Lights", "Clara Beaumont", 3],
];
const date = (y, m) => new Date(Date.UTC(y, m, 12, 17)).toUTCString().replace("GMT", "+0000");

export function fixtureFeeds() {
  const read = titles.map(([t, a, r], i) =>
    item({ id: String(1000 + i), title: t, author: a, rating: r, readAt: date(i < 5 ? 2026 : 2025, 11 - (i % 12)), pages: String(180 + i * 45), image: "" }),
  );
  read.push(item({ id: "1099", title: "Never Dated", rating: 4, readAt: "", image: "" }));
  return {
    read: parseFeed(page(read)),
    dnf: [parseFeed(page([item({ id: "2001", title: "The Glass Apiary", author: "Keziah Moore", addedAt: date(2026, 6), image: "" })], "dnf"))],
    reading: parseFeed(page([item({ id: "3001", title: "Starling Hours", author: "Ottilie Grace", addedAt: date(2026, 8), image: "" })], "currently-reading")),
  };
}
