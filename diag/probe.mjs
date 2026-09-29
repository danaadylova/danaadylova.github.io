// One-off probe: do Goodreads book pages expose genres we can read at build time?
import { readFileSync } from "node:fs";
const books = JSON.parse(readFileSync(new URL("./books2025.json", import.meta.url)));
const UA = { "User-Agent": "Mozilla/5.0 (compatible; danaadylova.com bookshelf build; +https://danaadylova.com/books/)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const note = (t, m) => console.log(`::notice title=${t}::${String(m).replace(/\n/g, " ").slice(0, 900)}`);
let ok = 0, status = {};
const rows = [];
for (const b of books) {
  let g = [];
  try {
    const r = await fetch(`https://www.goodreads.com/book/show/${b.id}`, { headers: UA });
    status[r.status] = (status[r.status] || 0) + 1;
    const html = await r.text();
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (m) {
      const s = m[1];
      const re = /"genre":\{"__typename":"Genre","name":"([^"]+)"/g; let x;
      while ((x = re.exec(s))) if (!g.includes(x[1])) g.push(x[1]);
    }
    if (!g.length) { const re2 = /\/genres\/[a-z0-9-]+"[^>]*>(?:<span[^>]*>)?([^<]+)</g; let y; while ((y = re2.exec(html))) if (!g.includes(y[1])) g.push(y[1]); }
  } catch (e) { g = ["ERR " + e.message]; }
  if (g.length) ok++;
  rows.push(`${b.t.slice(0, 34)}: ${g.slice(0, 6).join(", ")}`);
  await sleep(1500);
}
note("coverage", `${books.length} books · genres found for ${ok} · http ${JSON.stringify(status)}`);
for (let i = 0; i < rows.length; i += 6) note(`books ${i + 1}-${i + 6}`, rows.slice(i, i + 6).join("  ||  "));
