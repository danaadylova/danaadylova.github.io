// One-off probe: what genre data do Open Library and Google Books give for Dana's 2025 books?
import { readFileSync } from "node:fs";
const books = JSON.parse(readFileSync(new URL("./books2025.json", import.meta.url)));
const UA = { "User-Agent": "danaadylova.com genre probe (danaadylova@gmail.com)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const note = (t, m) => console.log(`::notice title=${t}::${String(m).replace(/\n/g, " ").slice(0, 900)}`);
let ol = 0, gb = 0;
const rows = [];
for (const b of books) {
  const q = new URLSearchParams({ title: b.t.split(/[:(]/)[0].trim(), author: b.a, fields: "subject,title", limit: "1" });
  let subj = [], cats = [];
  try { const r = await fetch(`https://openlibrary.org/search.json?${q}`, { headers: UA }); const j = await r.json(); subj = j.docs?.[0]?.subject || []; } catch (e) { subj = ["ERR " + e.message]; }
  try { const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:${b.t.split(/[:(]/)[0].trim()} inauthor:${b.a.split(" ").pop()}`)}&maxResults=1`); const j = await r.json(); cats = j.items?.[0]?.volumeInfo?.categories || []; } catch (e) { cats = ["ERR"]; }
  if (subj.length) ol++; if (cats.length) gb++;
  rows.push(`${b.t.slice(0, 40)} | OL: ${subj.slice(0, 12).join("; ")} | GB: ${cats.join("; ")}`);
  await sleep(400);
}
note("coverage", `${books.length} books · Open Library subjects for ${ol} · Google Books categories for ${gb}`);
for (let i = 0; i < rows.length; i += 3) note(`books ${i + 1}-${i + 3}`, rows.slice(i, i + 3).join("  ||  "));
