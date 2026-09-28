// Summarize what the build pulled from Goodreads. Used by .github/workflows/books-data-check.yml:
// writes a Markdown summary to $GITHUB_STEP_SUMMARY and a few ::notice annotations.
import fs from "node:fs/promises";
import path from "node:path";
import config from "../lib/books/config.js";

const snap = JSON.parse(await fs.readFile(path.join(config.cacheDir, "snapshot.json"), "utf8"));
const metaDir = path.join(config.cacheDir, "covers", "meta");
const metas = await fs.readdir(metaDir).catch(() => []);
let withCover = 0;
for (const f of metas) if (JSON.parse(await fs.readFile(path.join(metaDir, f), "utf8")).cover) withCover++;

const fc = snap.feedCounts || {};
const years = snap.years.map((y) => `${y.year}: ${y.books.length}${y.dnfCount ? ` (${y.dnfCount} dnf)` : ""}`).join(" · ");
const dnfFeeds = Object.entries(fc.dnf || {}).map(([s, n]) => `${s}=${n}`).join(", ");
const sample = snap.years.flatMap((y) => y.books).slice(0, 5)
  .map((b) => `${b.title} — ${b.author} · ${b.dnf ? "dnf" : "★".repeat(b.rating) || "unrated"} · ${String(b.when).slice(0, 10)}`);

const notices = [
  ["Feeds", `read=${fc.read} · currently-reading=${fc.reading} · ${dnfFeeds} · snapshot taken ${snap.fetchedAt} (${Math.round((Date.now() - Date.parse(snap.fetchedAt)) / 60000)} min ago; old = Goodreads failed and the cache was used)`],
  ["Library", `${snap.total} books in ${snap.years.length} years · ${snap.lovedTotal} loved · ${snap.dnfTotal} unfinished · ${snap.reading.length} currently reading`],
  ["Per year", years],
  ["Covers", `${withCover} of ${metas.length} books have a cover image`],
  ["Skipped (no read date)", `${snap.skippedUndated.length}${snap.skippedUndated.length ? ": " + snap.skippedUndated.slice(0, 8).map((s) => s.title).join("; ") : ""}`],
  ["Newest reads", sample.join(" | ")],
  ["Currently reading", snap.reading.map((b) => `${b.title} — ${b.author}`).join(" | ") || "none"],
];
for (const [title, msg] of notices) console.log(`::notice title=${title}::${msg.replace(/\r?\n/g, " ")}`);

const md = ["## /books data check", "", "| | |", "|---|---|", ...notices.map(([t, m]) => `| ${t} | ${m.replace(/\|/g, "\\|")} |`), ""].join("\n");
if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, md);
else console.log(md);
