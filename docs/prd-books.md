# PRD — `/books`: a bookshelf of everything I've read

| | |
|---|---|
| **Owner** | Dana Adylova |
| **Status** | Draft |
| **Created** | 2026-09-28 |
| **Site** | https://danaadylova.com (Eleventy 3 → GitHub Pages via `.github/workflows/deploy.yml`) |
| **Data source** | Goodreads profile [135558742](https://www.goodreads.com/user/show/135558742), shelf `read` |

---

## 1. Summary

Add a new top-level section, **`/books`**, to the site header next to `/blog /projects /resume /now`. The page shows every book on my Goodreads **read** shelf, grouped by **year read**, drawn as **physical books standing on shelves** (spines facing out). Hovering a book makes it hop up slightly. Clicking a book pulls it off the shelf and turns it to show its **front cover** with a few details, and it can be put back.

The book list is pulled from Goodreads automatically, so I never maintain it by hand.

## 2. Goals

1. **No manual upkeep.** Finishing a book on Goodreads makes it show up on the site within about a day, with nothing to commit.
2. **Delight.** The shelf should feel tactile and look good: smooth 60 fps motion, physically believable, not gimmicky.
3. **On-brand.** It should match the digital-garden look (paper `#fbfaf4` dot grid, Space Mono + Inter, terra/teal accents, 3px offset card shadows) and the `~/dana $` terminal voice.
4. **Fast and accessible.** Full keyboard and screen-reader support, respect for `prefers-reduced-motion`, and good behavior on phones.

### Non-goals (v1)

- Showing `currently-reading` / `to-read` shelves (possible v2, see §11).
- Writing reviews on the site, or comments.
- Search and filter UI beyond grouping by year.
- Two-way sync, or any Goodreads login/OAuth.

## 3. Users & stories

- **Visitor:** "I want to browse what Dana has read, year by year, and pick up any book that catches my eye to see what it is."
- **Visitor on a phone:** "I want to swipe along a shelf and tap a book to see its cover."
- **Keyboard / screen-reader visitor:** "I want to tab through books, hear the title, author and year, and open or close a book with Enter/Esc."
- **Dana:** "I mark a book as read on Goodreads and forget about it; the site catches up on its own."

## 4. Data

### 4.1 Source: Goodreads RSS

Goodreads retired its public developer API in Dec 2020 and no longer issues keys. The supported, public, unauthenticated source is the per-shelf **RSS feed**:

```
https://www.goodreads.com/review/list_rss/135558742?shelf=read&page={n}
```

Each `<item>` includes, among other fields:

| RSS field | Use |
|---|---|
| `book_id` | stable key, deep links, Goodreads URL |
| `title` | spine and cover label |
| `author_name` | spine and cover label |
| `book_large_image_url` (fallbacks `book_medium_image_url`, `book_image_url`) | front cover |
| `user_read_at` | **year grouping** and sort order |
| `user_date_added` | fallback date when `user_read_at` is empty |
| `user_rating` (0–5) | shown on the pulled-out card |
| `book/num_pages` | spine **thickness** |
| `book_published` | shown on card (optional) |
| `link` | "view on Goodreads" link |

**Requirements / assumptions to verify during implementation:**
- The Goodreads profile and the `read` shelf must be **public**, otherwise the feed is empty.
- The feed is **paginated**. Fetch `page=1,2,3…` until a page returns zero items. Hard cap at 50 pages as a safety stop.
- Goodreads' `robots.txt` disallows crawlers on this path. A once-a-day build-time fetch of **my own** shelf is low-volume personal use. Still, send an honest `User-Agent` (e.g. `danaadylova.com-books/1.0`) and never fetch from visitors' browsers.
- Titles contain series suffixes (e.g. `The Fifth Season (The Broken Earth, #1)`). Split these into `title` + `series` for cleaner spines.
- Goodreads placeholder covers (URLs containing `nophoto`) mean "no cover" and trigger the generated-cover fallback (§6.5).

### 4.2 Fetch at build time, not in the browser

- Add an Eleventy global data file **`src/_data/books.js`** that runs during `npm run build`. It fetches and parses the RSS (a lightweight XML parser such as `fast-xml-parser` as a devDependency, or a small regex parser, since the feed is flat) and returns normalized data.
- Output shape:

```js
{
  updatedAt: "2026-09-28T17:00:00Z",
  total: 214,
  years: [
    { year: 2026, books: [ /* newest read first */ ] },
    { year: 2025, books: [ ... ] },
    ...
    { year: null, label: "undated", books: [ ... ] }   // no read/added date
  ]
}
// book:
{ id, title, series, author, cover, rating, pages, readAt, published, url,
  spine: { color, textColor, width, height } }
```

- **Group by year** of `user_read_at` in the Pacific time zone, falling back to `user_date_added`. Years run newest first; books within a year run by read date, newest first (left to right). Books with neither date go in an **"undated"** shelf at the bottom.
- **Resilience:** after a successful fetch, write a snapshot to `src/_data/books.cache.json`, and commit it (see 4.3). If Goodreads fails or returns something malformed at build time, **use the cache and don't fail the build**. Log a warning in the Action output.

### 4.3 Keeping it fresh

- Add a `schedule:` trigger to `.github/workflows/deploy.yml` (e.g. daily at `17 13 * * *` UTC, about 6 am PT) so the site rebuilds and picks up new books without a commit. The existing `workflow_dispatch` covers "refresh now".
- Optional: a small separate workflow that refreshes `books.cache.json` and commits it only when it changes. That keeps the fallback current and gives a readable history of reading in git.

### 4.4 Cover images

- v1: **hotlink** Goodreads CDN cover URLs (`i.gr-assets.com` / `images-na.ssl-images-amazon.com`), with `loading="lazy"` and explicit `width`/`height`.
- Covers are only needed when a book is opened, so **preload the cover on hover/focus**. The flip then never shows a blank cover.
- v1.1 (if hotlinking proves flaky): download covers at build time into `_site/img/books/{id}.jpg` and resize them to about 400px wide.

## 5. Information architecture & navigation

- New route: **`/books/`**, source `src/books.njk` using `base.njk`.
- Header nav in `src/_includes/base.njk`: add `<a href="/books/">/books</a>` with the same `here` active-state logic as the others. Order: `/blog /projects /books /resume /now`. *(Open question in §12.)*
- Home page `ls` output (`src/index.njk`): add `books/`.
- Page heading: `<h1 data-typed>books</h1>`, reusing the existing typed-heading effect. Below it, a mono subtitle such as `214 books · updated 28 Sep 2026 · via goodreads`.
- Each year is its own shelf, labeled like the rest of the site, e.g. `## 2026` with a muted count `(23)`.
- **Deep links:** `/books/#b-{book_id}` opens that book on load. Opening a book updates the hash with `history.replaceState`, so it can be shared without filling up history.

## 6. Experience design

### 6.1 The shelf

- Each year is a **shelf**: a row of books standing upright on a plank. The plank should be restrained and on-brand, not skeuomorphic wood. For example, a 10–12px bar in `--card` with a `--card-border` top edge, a 3px offset shadow like `.card`, and a soft contact shadow under the books.
- **Books are 3D CSS objects.** Each is a `transform-style: preserve-3d` box made of **spine**, **front cover**, **back cover** and a page-edge face, seen from the front with a slight perspective (`perspective: ~1200px` on the shelf). At rest only the spine is visible.
- **Spine sizing varies**, so the row reads as real books and not a bar chart:
  - Width (thickness): from `num_pages`, clamped to about **18–46px**. If page count is missing, use a stable pseudo-random value seeded by `book_id`.
  - Height: seeded from `book_id` so it's stable between builds, within about **150–190px**. Keep a consistent baseline.
- **Spine look:**
  - Background color: the **dominant color of the cover**, computed at build time. If that's unavailable, pick from a curated palette of muted, site-friendly tones (terra, teal, ink, ochre, sage, plum, dusty blue, cream), seeded by `book_id`.
  - Text: title set vertically (`writing-mode: vertical-rl`) in Space Mono, author abbreviated at the foot. Auto-pick ink or cream text for WCAG AA contrast. Truncate long titles with an ellipsis.
  - Subtle detail: a thin band near the top and bottom, and a very faint vertical gradient for roundness. No image textures.
- **Layout / overflow:** the site column is `46rem` wide, so a year with many books **wraps onto more shelf planks** (a bookcase with several rows) rather than scrolling sideways on desktop. Rows are justified left, with a small gap between books.
- **Entrance:** when a shelf scrolls into view (IntersectionObserver), books drop in with a short staggered settle (about 20ms stagger, capped at 400ms total per shelf). This runs once per shelf.

### 6.2 Hover: "the hop"

- On `pointerenter` / `:focus-visible`, the book **lifts about 10–14px** and tilts back very slightly (`rotateX(-2deg)`). The contact shadow under it softens and spreads.
- Motion: spring-like ease out with a hint of overshoot, e.g. `transition: transform 260ms cubic-bezier(.34,1.56,.64,1)`. It settles back in about 200ms on leave.
- Only the hovered book moves. Neighbors stay still.
- Show a small tooltip-style label above the lifted book (mono, `--muted`): `title — author`. This helps when spines are truncated.
- If the typing-sound toggle is on, play a very soft "tick" on hover. It reuses the existing sound engine in `garden.js` and is off by default like the rest of the site.

### 6.3 Click: "pull it out and turn it"

This is the centerpiece. It's a choreographed sequence of about **700–900ms total**:

1. **Pull (0–250ms):** the book slides **toward the viewer** (`translateZ` +60–80px) and up slightly, as if pulled off the shelf by the spine.
2. **Lift and travel (150–600ms, overlapping):** the book moves from its shelf slot to the **center of the viewport**, using FLIP measurements, and scales up so the cover is about **240–300px wide** on desktop.
3. **Turn (250–750ms):** during the travel it **rotates about the Y axis −90°**, so the spine turns away and the **front cover** faces the viewer. Ease with a slight settle at the end.
4. **Reveal details (600–900ms):** a card fades and slides in next to the cover (below it on mobile), styled like the site's `.card`:
   - Title (Space Mono, ink), series, author
   - `read: Mar 2025` · `pages: 384` · rating as `★★★★☆` (hidden if unrated)
   - `view on goodreads →` link (terra)
5. **Backdrop:** the rest of the page dims with a `--paper` overlay at about 85% opacity, plus a light backdrop blur where supported. The empty slot on the shelf stays visible through it as a gap.

**Putting it back:** Esc, the close button (`×`, mono), a click on the backdrop, or the browser back action if hash nav is used. This plays the sequence **in reverse** and the book slides back into its gap. Only one book can be open at a time. Clicking another book while one is open returns the first, then opens the second (chained, or overlapping by about 150ms).

**Implementation guidance:**
- Animate **only `transform` and `opacity`**. Use the Web Animations API (`element.animate`) for the choreography, so it can be interrupted and reversed cleanly (e.g. a close mid-open reverses from the current point).
- Keep the real `<button>` in place and animate a **clone in a fixed-position layer** (portal). The shelf layout never reflows.
- Add `will-change: transform` only while animating.
- No animation libraries. Vanilla JS, in keeping with `garden.js`, in a new `src/js/books.js` loaded only on `/books/`. Budget: **≤ 8 KB gzipped JS, ≤ 6 KB gzipped CSS** (`src/css/books.css`).

### 6.4 Reduced motion

With `prefers-reduced-motion: reduce`:
- No entrance drop and no hop. Hover and focus show only an outline and the label.
- Opening a book becomes a **~150ms crossfade** to the centered cover and card. There's no 3D travel or rotation.

### 6.5 Missing covers

When there's no cover, or the image fails to load, generate a **typographic cover**: spine color background, title in Space Mono, author in Inter, and a small `~/dana $` colophon. It uses the same dimensions, so the turn still works.

### 6.6 Mobile and touch

- No hover state. **Tap opens.** The label shows in the opened card instead.
- Below about 480px wide, spines scale down about 15% so more fit per row. Rows keep wrapping; there's no horizontal scroll trap.
- The opened book centers in the top half of the viewport and the details card sits below it. **Swipe down** on the opened book (or tap the backdrop) puts it back.
- Tap targets are at least 24px wide. Very thin spines get a larger invisible hit area.

### 6.7 Empty and error states

- Zero books, e.g. if the shelf is private and there's no cache: show a single empty shelf with the line `~/dana $ ls books/  →  (nothing here yet)`.
- The last-updated date is always shown, so stale data is visible.

## 7. Accessibility

- Each book is a `<button>` inside a `<ul>` per shelf (`<section aria-labelledby>` per year). Its accessible name is `"{title} by {author}, read {Month YYYY}"`.
- Arrow keys move focus along a shelf and across rows (roving `tabindex`). Tab moves between shelves. Enter/Space opens.
- The opened book is a **modal dialog** (`role="dialog"`, `aria-modal="true"`, labelled by the title). Focus moves into it, is trapped, and **returns to the originating spine** on close.
- Spine text meets **WCAG AA** contrast against its background. This is checked at build time; if it fails, switch to the other text color.
- Everything works with JS disabled: a **no-JS fallback** renders the same data as a plain year-grouped list (`title — author`), consistent with the site's `.js` class convention.

## 8. Performance

- Page is statically rendered. All book data is in the HTML at build time, with no client fetch.
- Spines are pure CSS/DOM, with no images until a book is hovered or opened. The initial page load stays small even with hundreds of books.
- Targets on a mid-range phone: **LCP < 1.5s**, **CLS ≈ 0**, **60 fps** hop and flip (no layout or paint in animation frames, verified in the Performance panel).
- If the shelf grows past about 500 books, consider `content-visibility: auto` on off-screen shelves.

## 9. Technical plan (files)

| File | Change |
|---|---|
| `src/_data/books.js` | **new**: fetch Goodreads RSS pages, normalize, group by year, compute spine sizes and colors, fall back to cache |
| `src/_data/books.cache.json` | **new**: last good snapshot, committed |
| `src/books.njk` | **new**: `/books/` page, shelves, no-JS list, dialog template |
| `src/css/books.css` | **new**: shelf, 3D book, hop, dialog, reduced-motion styles |
| `src/js/books.js` | **new**: hover label, open/close choreography (WAAPI + FLIP), keyboard nav, hash deep links, cover preloading |
| `src/_includes/base.njk` | add `/books` to nav; allow per-page extra CSS/JS via front-matter (e.g. `extraCss`, `extraJs`) |
| `src/index.njk` | add `books/` to `ls` output |
| `eleventy.config.js` | passthrough is already set for `css`/`js`; no change expected. If covers are self-hosted (v1.1), add an image step. |
| `.github/workflows/deploy.yml` | add daily `schedule:` trigger |
| `package.json` | add `fast-xml-parser` (and optionally `sharp`/`node-vibrant` for cover colors) as devDependencies |

## 10. Acceptance criteria

1. `/books` appears in the header on every page and is highlighted when active. `books/` appears in the home `ls`.
2. `/books/` lists **every** book on the Goodreads `read` shelf, with the count matching Goodreads, grouped into year shelves newest first, plus "undated" if needed.
3. Marking a new book read on Goodreads makes it appear on the site after the next scheduled build (within 24h) or a manual workflow run, with no code change.
4. If Goodreads is unreachable during a build, the build still succeeds from `books.cache.json`.
5. Hovering (or keyboard-focusing) a book lifts it about 12px with a springy ease. Other books don't move.
6. Clicking a book pulls it toward the viewer, carries it to center, rotates it to show the front cover, and shows title, author, date read, rating and a Goodreads link. Esc, backdrop click, or `×` reverses the animation back into the same slot, and focus returns to that spine.
7. Animations hold 60 fps on a 2022-era mid-range phone and a MacBook, and only animate `transform`/`opacity`.
8. With reduced motion on, no 3D movement happens and opening uses a crossfade.
9. Fully usable with keyboard only and VoiceOver. axe-core reports no serious or critical issues.
10. Works in the latest Safari (macOS and iOS), Chrome and Firefox.
11. `/books/#b-{id}` opens directly to that book.

## 11. Future ideas (v2+)

- A "currently reading" book lying flat on top of the newest shelf, or leaning at the end of it.
- Stats line per year: books, pages, average rating. A small "reading streak" in the terminal voice (`~/dana $ wc -l books/2025`).
- Filter by rating, or a "favorites" glow for 5★.
- Wikilink support in notes, e.g. `[[book:12345]]`, that opens the book on the shelf.
- Self-hosted, resized covers (v1.1) and cover-derived spine colors if they weren't done in v1.

## 12. Open questions

1. **Nav position.** Where should `/books` sit: `/blog /projects /books /resume /now` (proposed), or at the end?
2. **Ratings.** Show my star ratings publicly, or hide them?
3. **Undated books.** Books added to "read" with no date (e.g. an old backlog import): an "undated" shelf, or group them under the year they were added?
4. **Re-reads.** RSS only exposes the latest read date. Is it OK for a re-read book to appear only in its latest year?
5. **Spine color.** Take it from the cover (more realistic, adds a build-time image dependency) or use a curated site palette (more cohesive, zero dependencies)?
6. **Is the Goodreads read shelf public?** It needs to be for the RSS feed to work.
