import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { fetchShelf, shelfUrl } from "../lib/books/fetch.js";
import { processCover } from "../lib/books/covers.js";
import { contrast } from "../lib/books/color.js";
import { item, page } from "./fixtures/goodreads.js";

const quiet = { warn() {}, info() {} };
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => body, arrayBuffer: async () => body });

test("shelf URL", () => {
  assert.equal(shelfUrl("135558742", "did-not-finish", 2), "https://www.goodreads.com/review/list_rss/135558742?shelf=did-not-finish&page=2");
});

test("follows pages until an empty one", async () => {
  const pages = { 1: [item({ id: "1", title: "A" }), item({ id: "2", title: "B" })], 2: [item({ id: "3", title: "C" })], 3: [] };
  const calls = [];
  const fetchImpl = async (url) => {
    const n = +new URL(url).searchParams.get("page");
    calls.push(n);
    return res(200, page(pages[n] || []));
  };
  const items = await fetchShelf("u", "read", { fetchImpl, log: quiet });
  assert.deepEqual(items.map((i) => i.book_id), ["1", "2", "3"]);
  assert.deepEqual(calls, [1, 2, 3]);
});

test("stops if Goodreads ignores ?page and repeats the first page", async () => {
  let calls = 0;
  const fetchImpl = async () => (calls++, res(200, page([item({ id: "1", title: "A" })])));
  const items = await fetchShelf("u", "read", { fetchImpl, log: quiet });
  assert.equal(items.length, 1);
  assert.equal(calls, 2);
});

test("retries a 503, then succeeds", async () => {
  let n = 0;
  const fetchImpl = async (url) => {
    n++;
    if (n === 1) return res(503, "busy");
    return res(200, page(url.includes("page=1") ? [item({ id: "1", title: "A" })] : []));
  };
  const items = await fetchShelf("u", "read", { fetchImpl, log: quiet });
  assert.equal(items.length, 1);
});

test("a 404 fails immediately with a clear message", async () => {
  let n = 0;
  const fetchImpl = async () => (n++, res(404, "nope"));
  await assert.rejects(fetchShelf("u", "nope", { fetchImpl, log: quiet }), /could not fetch .*HTTP 404/);
  assert.equal(n, 1);
});

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
