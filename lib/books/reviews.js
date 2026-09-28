// My own reviews: src/reviews/<anything>.md with front matter `book_id` (the Goodreads id) and optional `date`.
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import markdownIt from "markdown-it";

const md = markdownIt({ html: true, typographer: true, linkify: true });

/** @returns {Promise<Map<string, {html: string, date: string|null}>>} */
export async function loadReviews(dir, log = console) {
  const out = new Map();
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md");
  } catch {
    return out; // no reviews folder yet
  }
  for (const f of files) {
    const { data, content } = matter(await fs.readFile(path.join(dir, f), "utf8"));
    if (!data.book_id) {
      log.warn?.(`review ${f} has no book_id in its front matter; skipped`);
      continue;
    }
    out.set(String(data.book_id), {
      html: md.render(content.trim()),
      date: data.date ? new Date(data.date).toISOString().slice(0, 10) : null,
    });
  }
  return out;
}
