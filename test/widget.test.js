import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWidget, fetchWidget, widgetUrl, bookIdFromCover, widgetCovers, decodeEntities } from "../lib/books/widget.js";
import { widget } from "./fixtures/widget.js";

const quiet = { warn() {}, info() {} };
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => body });

test("parses the widget: book id from the cover, full title, author, half-star ratings, in order", () => {
  const books = parseWidget(
    widget([
      { id: "221115921", title: "Murder on Sex Island (Luella van Horn #1)", author: "Jo Firestone", rating: 2.5 },
      { id: "220599155", title: "A Case of Mice and Murder (The Trials of Gabriel Ward, #1)", author: "Sally     Smith", rating: 3.5 },
      { id: "7126", title: "The Count of Monte Cristo", author: "Alexandre Dumas", rating: 5 },
      { id: "5", title: "Unrated", rating: 0 },
    ]),
    "read",
  );
  assert.deepEqual(books.map((b) => [b.id, b.rating]), [["221115921", 2.5], ["220599155", 3.5], ["7126", 5], ["5", 0]]);
  assert.equal(books[0].rawTitle, "Murder on Sex Island (Luella van Horn #1)");
  assert.equal(books[1].author, "Sally Smith");
  assert.equal(books[0].reviewId, String(9000000000 + 221115921));
  assert.match(books[0].cover, /^https:\/\/i\.gr-assets\.com\/.*221115921\._SY75_\.jpg$/);
});

test("titles with entities and Goodreads' stray space before 's", () => {
  const [b] = parseWidget(widget([{ id: "1", title: "Salt &amp; Honey: Dana&#39;s Story", author: "O&#39;Brien" }]), "read");
  assert.equal(b.rawTitle, "Salt & Honey: Dana's Story");
  assert.equal(b.author, "O'Brien");
  assert.equal(decodeEntities("Dana &#39;s &#x2014; x"), "Dana 's — x");
});

test("an empty shelf is an empty list; a sign-in page, an unknown user or another shelf is an error", () => {
  assert.deepEqual(parseWidget(widget([], { shelf: "dnf" }), "dnf"), []);
  assert.throws(() => parseWidget("<html>Sign in</html>", "read"), /not a Goodreads widget/);
  assert.throws(() => parseWidget("document.write('This Goodreads widget is not correct')", "read"), /not correct/);
  assert.throws(() => parseWidget(widget([{ id: "1", title: "A" }], { shelf: "currently-reading" }), "read"), /another shelf/);
  assert.throws(() => parseWidget("", "read"), /empty/);
});

test("a book whose cover has no id is skipped, not guessed", () => {
  const books = parseWidget(widget([{ id: "1", title: "A" }, { id: "2", title: "B", cover: "https:\\/\\/s.gr-assets.com\\/assets\\/nophoto\\/book\\/50x75.png" }]), "read");
  assert.deepEqual(books.map((b) => b.id), ["1"]);
});

test("cover helpers", () => {
  assert.equal(bookIdFromCover("https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1732113920l/221115921._SY75_.jpg"), "221115921");
  assert.equal(bookIdFromCover("https://i.gr-assets.com/x/books/1l/91477.jpg"), "91477");
  assert.equal(bookIdFromCover("https://s.gr-assets.com/assets/nophoto/book/50x75-a91bf249278a81aabab721ef782c4a74.png"), null);
  assert.deepEqual(widgetCovers("https://x/books/1l/9._SY75_.jpg"), ["https://x/books/1l/9.jpg", "https://x/books/1l/9._SX318_.jpg", "https://x/books/1l/9._SY75_.jpg"]);
  assert.deepEqual(widgetCovers("https://s.gr-assets.com/nophoto/x.png"), []);
});

test("URL asks for 100 books newest first with a fresh widget id; fetch retries a 503 and stops on a 404", async () => {
  const u = new URL(widgetUrl("135558742", "did-not-finish", { sort: "date_added", widgetId: "site1" }));
  assert.equal(u.pathname, "/review/custom_widget/135558742");
  assert.equal(u.searchParams.get("shelf"), "did-not-finish");
  assert.equal(u.searchParams.get("num_books"), "100");
  assert.equal(u.searchParams.get("order"), "d");
  assert.equal(u.searchParams.get("widget_id"), "site1");

  let n = 0;
  const ok = await fetchWidget("u", "read", { fetchImpl: async () => (n++ ? res(200, widget([{ id: "1", title: "A" }])) : res(503, "busy")), log: quiet });
  assert.equal(ok.length, 1);
  n = 0;
  await assert.rejects(fetchWidget("u", "read", { fetchImpl: async () => (n++, res(404, "")), log: quiet }), /widget for "read": HTTP 404/);
  assert.equal(n, 1);
});
