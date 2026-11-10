// Goodreads' public bookshelf widget, the only anonymous way to read a shelf since Goodreads retired
// shelf RSS on 2026-10-28 (every /review/list_rss/ URL answers 404).
//
// One request per shelf returns at most the 100 newest books (by the `sort` asked for) as a JavaScript
// file that writes HTML. Per book it has: the book id (from the cover's file name), the full title
// (with the series), the author, Dana's own rating (half stars possible) and a cover. It has NO dates
// and NO page counts; lib/books/library.js works around that.
//
// Pure parsing here; the network call is fetchWidget() at the bottom.

const UA = "danaadylova.com-books/1.0 (+https://danaadylova.com/books/)";

export function widgetUrl(userId, shelf, { sort = "date_read", widgetId = "site" } = {}) {
  const q = new URLSearchParams({
    shelf,
    sort,
    order: "d",
    num_books: "100",
    show_title: "1",
    show_author: "1",
    show_cover: "1",
    show_rating: "1",
    cover_size: "small",
    // Goodreads caches the rendered widget per user + widget_id whatever the shelf, so every request needs its own id.
    widget_id: widgetId,
  });
  return `https://www.goodreads.com/review/custom_widget/${userId}?${q}`;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** The widget is `var widget_code = '<html…>'` with JS string escapes; undo them. */
function unescapeJs(s) {
  return s.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (m, e) => {
    if (e[0] === "u" && e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16));
    if (e[0] === "x" && e.length === 3) return String.fromCharCode(parseInt(e.slice(1), 16));
    return { n: "\n", t: "\t", r: "" }[e] ?? e;
  });
}

const tidy = (s) => decodeEntities(s).replace(/\s+/g, " ").replace(/ (?='s\b)/g, "").trim();

/** Covers are "…/books/1732113920l/221115921._SY75_.jpg": the file name is the book id. */
export function bookIdFromCover(url) {
  const m = /\/(\d+)(?:\.[^/]*)?\.(?:jpe?g|png|gif|webp)$/i.exec(url || "");
  return m ? m[1] : null;
}

/**
 * Parse one widget response into books, newest first, in the widget's order.
 * Throws if it isn't a widget for the asked shelf (unknown user, a sign-in page, a cached other shelf…).
 */
export function parseWidget(js, shelf) {
  if (typeof js !== "string" || !js.trim()) throw new Error("empty widget body");
  const m = /widget_code\s*=\s*'([\s\S]*?)'\s*\n\s*var widget_div/.exec(js);
  if (!m) {
    if (/widget is not correct/i.test(js)) throw new Error("Goodreads says the widget is not correct (wrong user id?)");
    throw new Error("not a Goodreads widget (no widget_code); is the profile still public?");
  }
  const html = unescapeJs(m[1]);
  if (!/gr_custom_container_/.test(html)) throw new Error("widget has no book container");
  // The header links to the shelf it shows; a mismatch means a cached widget for another shelf.
  const head = /gr_custom_header_[^>]*>\s*<a[^>]*href="([^"]+)"/.exec(html);
  if (shelf && head && !new RegExp(`[?&]shelf=${shelf.replace(/[-]/g, "\\-")}(?:&|$)`).test(decodeEntities(head[1]))) {
    throw new Error(`widget shows another shelf (${decodeEntities(head[1])}), not "${shelf}"`);
  }
  const books = [];
  for (const block of html.split(/<div class="gr_custom_each_container_[^"]*">/).slice(1)) {
    const cover = /<img[^>]*\bsrc="([^"]+)"/.exec(block)?.[1] || "";
    const id = bookIdFromCover(cover);
    if (!id) continue; // no usable id: skip rather than guess
    const titleAttr = /<a title="([^"]*)"/.exec(block)?.[1];
    const titleText = /gr_custom_title_[^>]*>\s*<a[^>]*>([^<]*)</.exec(block)?.[1];
    const author = /href="[^"]*\/author\/show\/[^"]*">([^<]*)</.exec(block)?.[1] || "";
    const reviewId = /review\/show\/(\d+)/.exec(block)?.[1] || null;
    // Five star images: active = 1, 50pct = ½, inactive = 0. Dana's own rating, not the book's average.
    const rating = (/gr_custom_rating_[\s\S]*?<\/span>/.exec(block)?.[0].match(/star_(active|50pct|inactive)/g) || [])
      .reduce((n, s) => n + (s.endsWith("active") && !s.endsWith("inactive") ? 1 : s.endsWith("50pct") ? 0.5 : 0), 0);
    books.push({
      id,
      reviewId,
      rawTitle: tidy(titleAttr || titleText || ""),
      author: tidy(author),
      rating,
      cover: decodeEntities(cover),
    });
  }
  return books;
}

/** Goodreads cover URL → candidates, the original size first (same idea as coverCandidates for RSS). */
export function widgetCovers(url) {
  if (!url || /nophoto/i.test(url)) return [];
  const full = url.replace(/\._S[XY]\d+(?:_S[XY]\d+)?_(?=\.\w+$)/, "");
  return full === url ? [url] : [full, url.replace(/\._S[XY]\d+_(?=\.\w+$)/, "._SX318_"), url];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchWidget(userId, shelf, { sort, fetchImpl = fetch, retries = 3, log = console, stamp = Date.now() } = {}) {
  const url = widgetUrl(userId, shelf, { sort, widgetId: `site${stamp}_${shelf.replace(/\W/g, "")}` });
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(url, { headers: { "User-Agent": UA, Accept: "text/javascript, */*;q=0.5" } });
      if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { fatal: true });
      return parseWidget(await res.text(), shelf);
    } catch (err) {
      lastErr = err;
      if (err.fatal || attempt === retries) break;
      log.warn?.(`[books] widget "${shelf}" failed (${err.message}); retrying`);
      await sleep(800 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`could not read the Goodreads widget for "${shelf}": ${lastErr?.message}`);
}
