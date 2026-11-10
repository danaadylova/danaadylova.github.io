import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { processCover } from "../lib/books/covers.js";
import { contrast } from "../lib/books/color.js";

const quiet = { warn() {}, info() {} };
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => body, arrayBuffer: async () => body });

test("cover: downloads, resizes to webp+jpg, derives an AA-safe spine color, and reuses the result next build", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "covers-"));
  const png = await sharp({ create: { width: 600, height: 900, channels: 3, background: "#7a2e2e" } }).png().toBuffer();
  let calls = 0;
  const fetchImpl = async (url) => (calls++, url.includes("bad") ? res(404, "") : res(200, png));
  const book = { id: "77", title: "Red Book", covers: ["https://x/bad.jpg", "https://x/good.jpg"] };

  const r = await processCover(book, { dir, fetchImpl, log: quiet });
  assert.equal(r.cover, "/img/books/77");
  assert.equal(r.width, 400);
  assert.ok(contrast(r.color, r.text) >= 4.5);
  const out = await sharp(path.join(dir, "out", "77.webp")).metadata();
  assert.equal(out.width, 400);
  await fs.access(path.join(dir, "out", "77.jpg"));

  const before = calls;
  const again = await processCover(book, { dir, fetchImpl, log: quiet });
  assert.deepEqual(again, r);
  assert.equal(calls, before, "second build must not download again");
});

test("cover: HTML error page or no candidates → generated-cover fallback colors", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "covers-"));
  const html = Buffer.from("<html>blocked</html>");
  const r1 = await processCover({ id: "5", title: "X", covers: ["https://x/a.jpg"] }, { dir, fetchImpl: async () => res(200, html), log: quiet });
  assert.equal(r1.cover, null);
  assert.ok(contrast(r1.color, r1.text) >= 4.5);
  const r2 = await processCover({ id: "6", title: "Y", covers: [] }, { dir, fetchImpl: async () => assert.fail("no fetch"), log: quiet });
  assert.equal(r2.cover, null);
});

test("cover: a book with no cover yet is tried again on a later build, at most once a day", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "covers-"));
  const png = await sharp({ create: { width: 600, height: 900, channels: 3, background: "#2e4a7a" } }).png().toBuffer();
  const day1 = Date.UTC(2026, 9, 6, 13), book = { id: "53123770", title: "Wait and Hope", covers: [] };   // added before Goodreads had a cover
  const r1 = await processCover(book, { dir, fetchImpl: async () => assert.fail("no fetch"), log: quiet, now: day1 });
  assert.equal(r1.cover, null);

  let calls = 0;
  const withCover = { ...book, covers: ["https://x/53123770.jpg"] };
  const later = await processCover(withCover, { dir, fetchImpl: async () => (calls++, res(200, png)), log: quiet, now: day1 + 3600e3 });
  assert.equal(later.cover, null, "checked an hour ago: not again yet");
  assert.equal(calls, 0);

  const nextDay = await processCover(withCover, { dir, fetchImpl: async () => (calls++, res(200, png)), log: quiet, now: day1 + 24 * 3600e3 });
  assert.equal(nextDay.cover, "/img/books/53123770");
  assert.equal(calls, 1);
  await fs.access(path.join(dir, "out", "53123770.webp"));
});
