// Download each cover once, keep a resized copy for the site, and read its dominant color.
// Everything lives under .cache/covers (restored between CI runs), so daily builds only fetch new books.
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { spineColors, fallbackColors } from "./color.js";
import { hash } from "./goodreads.js";

const UA = "danaadylova.com-books/1.0 (+https://danaadylova.com/books/)";

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function download(urls, dest, fetchImpl) {
  for (const url of urls) {
    try {
      const res = await fetchImpl(url, { headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(buf).metadata(); // rejects HTML error pages and broken files
      if (!meta.width || meta.width < 40) continue; // 1px trackers / tiny placeholders
      await fs.writeFile(dest, buf);
      return true;
    } catch {
      /* try the next candidate URL */
    }
  }
  return false;
}

/**
 * @returns {Promise<{cover: string|null, width?: number, height?: number, color: string, text: string}>}
 */
export async function processCover(book, { dir, fetchImpl = fetch, log = console }) {
  const srcDir = path.join(dir, "src"), outDir = path.join(dir, "out"), metaFile = path.join(dir, "meta", `${book.id}.json`);
  await Promise.all([srcDir, outDir, path.dirname(metaFile)].map((d) => fs.mkdir(d, { recursive: true })));

  // Reuse previous work when the output files are still there.
  if (await exists(metaFile)) {
    const meta = JSON.parse(await fs.readFile(metaFile, "utf8"));
    if (!meta.cover || (await exists(path.join(outDir, `${book.id}.webp`)))) return meta;
  }

  const src = path.join(srcDir, `${book.id}.img`);
  const ok = (await exists(src)) || (book.covers.length && (await download(book.covers, src, fetchImpl)));
  let result;
  if (!ok) {
    result = { cover: null, ...fallbackColors(hash(book.id)) };
  } else {
    try {
      const img = sharp(src).rotate().resize({ width: 400, withoutEnlargement: true });
      const [webp] = await Promise.all([
        img.clone().webp({ quality: 80 }).toFile(path.join(outDir, `${book.id}.webp`)),
        img.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(outDir, `${book.id}.jpg`)),
      ]);
      const { dominant } = await sharp(src).stats();
      result = {
        cover: `/img/books/${book.id}`, // + .webp / .jpg
        width: webp.width,
        height: webp.height,
        ...spineColors([dominant.r, dominant.g, dominant.b]),
      };
    } catch (err) {
      log.warn?.(`[books] cover for "${book.title}" (${book.id}) unreadable: ${err.message}`);
      result = { cover: null, ...fallbackColors(hash(book.id)) };
    }
  }
  await fs.writeFile(metaFile, JSON.stringify(result));
  return result;
}

/** Run processCover over many books with a small concurrency limit. */
export async function processCovers(books, opts, concurrency = 6) {
  const out = new Map();
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, books.length) }, async () => {
      while (i < books.length) {
        const b = books[i++];
        out.set(b.id, await processCover(b, opts));
      }
    }),
  );
  return out;
}
