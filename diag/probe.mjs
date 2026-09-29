// One-off probe: Open Library subjects → simple genres, for every book on the shelf.
import { readFileSync } from "node:fs";
const books = JSON.parse(readFileSync(new URL("./books2025.json", import.meta.url)));
const UA = { "User-Agent": "danaadylova.com bookshelf (danaadylova@gmail.com)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RULES = [["fantasy", /fantas|romantasy|magic|faerie|\bfae\b|witch|dragon|fairy tale/], ["romance", /romance|love stor/],
  ["mystery", /myster|detective|crime|police|murder|whodunit/], ["thriller", /thriller|suspense|horror/],
  ["sci-fi", /science fiction|space opera|dystop/], ["historical fiction", /historical fiction|fiction, historical/],
  ["nonfiction", /nonfiction|non-fiction|biograph|memoir|travel|essays|history(?! fiction)|popular science/]];
const genres = (subj) => { const s = subj.join(" | ").toLowerCase(); const out = RULES.filter(([, rx]) => rx.test(s)).map(([g]) => g);
  if (out.includes("nonfiction") && /(^|[^n-])fiction/.test(s.replace(/nonfiction|non-fiction/g, "")) && !/biograph|memoir|nonfiction/.test(s)) out.splice(out.indexOf("nonfiction"), 1); return out; };
async function subjects(b) {
  const title = b.t.split(/[:(]/)[0].trim();
  for (const url of [`https://openlibrary.org/search.json?${new URLSearchParams({ title, author: b.a, fields: "subject", limit: "3" })}`,
                     `https://openlibrary.org/search.json?${new URLSearchParams({ q: `${title} ${b.a.split(" ").pop()}`, fields: "subject", limit: "3" })}`,
                     b.isbn && `https://openlibrary.org/search.json?${new URLSearchParams({ isbn: b.isbn, fields: "subject", limit: "1" })}`].filter(Boolean)) {
    try { const j = await (await fetch(url, { headers: UA })).json(); const s = (j.docs || []).flatMap((d) => d.subject || []); if (s.length) return s; } catch {}
    await sleep(350);
  }
  return [];
}
const out = {}; let found = 0, mapped = 0;
for (const b of books) { const s = await subjects(b); const g = genres(s); if (s.length) found++; if (g.length) mapped++; out[b.id] = g; await sleep(350); }
const byYear = {}; for (const b of books) { (byYear[b.y] ||= [0, 0]); byYear[b.y][0]++; if (out[b.id].length) byYear[b.y][1]++; }
console.log(`::notice title=coverage::${books.length} books · subjects ${found} · mapped to a genre ${mapped} · by year ${JSON.stringify(byYear)}`);
const short = { fantasy: "F", romance: "R", mystery: "M", thriller: "T", "sci-fi": "S", "historical fiction": "H", nonfiction: "N" };
const enc = Object.entries(out).map(([id, g]) => `${id}:${g.map((x) => short[x]).join("")}`).join(",");
for (let i = 0, k = 1; i < enc.length; i += 3800, k++) console.log(`::notice title=g${k}::${enc.slice(i, i + 3800)}`);
