# PRD — `/books`: a bookshelf of everything I've read

| | |
|---|---|
| **Owner** | Dana Adylova |
| **Status** | Draft v3 (all open questions resolved) |
| **Created** | 2026-09-28 · **Updated** 2026-09-28 |
| **Site** | https://danaadylova.com (Eleventy 3 → GitHub Pages via `.github/workflows/deploy.yml`) |
| **Data source** | Goodreads profile [135558742](https://www.goodreads.com/user/show/135558742), shelf `read` + shelf [`did-not-finish`](https://www.goodreads.com/review/list/135558742?shelf=did-not-finish) (feed confirmed public) |
| **Comments backend** | existing unraveled.makes FastAPI + Postgres service (see §7) |

---

## 1. Summary

Add a new top-level section, **`/books`**, to the site header between `/projects` and `/resume`. The page shows every book on my Goodreads **read** shelf, grouped by **year read**, drawn as **physical books standing on shelves** (spines facing out). Hovering a book makes it hop up slightly. Clicking a book pulls it off the shelf and turns it to show its **front cover**. A cozy **side panel** slides in next to it with my rating (or a DNF mark), my own review if I've written one, and a thread of notes that visitors can leave.

The book list comes from Goodreads automatically. **Reviews are written on my site, not on Goodreads.**

## 2. Goals

1. **No manual upkeep of the list.** Finishing a book on Goodreads makes it show up on the site within about a day, with nothing to commit.
2. **My own reviews, my own place.** I can write reviews that live on my site, in Markdown, independent of Goodreads.
3. **Conversation.** Visitors can leave notes on a book and reply to each other with no account needed. Nothing appears publicly until I approve it.
4. **Delight.** The shelf should feel tactile and look good: smooth 60 fps motion, physically believable, and the comment panel should feel warm and cozy.
5. **On-brand.** It should match the digital-garden look (paper `#fbfaf4` dot grid, Space Mono + Inter, terra/teal accents, 3px offset card shadows) and the `~/dana $` terminal voice.
6. **Fast and accessible.** Full keyboard and screen-reader support, respect for `prefers-reduced-motion`, and good behavior on phones.

### Non-goals (v1)

- Showing `currently-reading` / `to-read` shelves (possible v2).
- Syncing my site reviews back to Goodreads, or importing Goodreads review text.
- Visitor accounts, likes/reactions, or deeply nested reply trees (replies are one level deep, see §7.2).
- Search and filter UI beyond grouping by year.

## 3. Users & stories

- **Visitor:** "I want to browse what Dana has read, year by year, pick up a book, and see what she thought of it."
- **Visitor with an opinion:** "I want to leave a short note on a book, like 'this one wrecked me too', or reply to someone else's note, without making an account."
- **Visitor on a phone:** "I want to tap a book to see its cover and read the notes in a sheet that slides up."
- **Keyboard / screen-reader visitor:** "I want to tab through books, hear the title, author, year and whether it was finished, open a book, and read or post comments."
- **Dana (reading):** "I mark a book read or DNF on Goodreads and forget about it; the site catches up on its own."
- **Dana (reviewing):** "I write a review as a Markdown file, maybe drafted in Obsidian. It shows up pinned at the top of that book's panel."
- **Dana (moderating):** "I get an email when someone comments, and approve or reject it with one click. Nothing goes live without me."

## 4. Data

### 4.1 Source: Goodreads RSS

Goodreads retired its public developer API in Dec 2020. The supported, public, unauthenticated source is the per-shelf **RSS feed**:

```
https://www.goodreads.com/review/list_rss/135558742?shelf=read&page={n}
```

Fields used per `<item>`:

| RSS field | Use |
|---|---|
| `book_id` | stable key for deep links, reviews and comments |
| `title` | spine and cover label (series suffix split off, e.g. `(The Broken Earth, #1)`) |
| `author_name` | spine and cover label |
| `book_large_image_url` (fallbacks `book_medium_image_url`, `book_image_url`) | front cover, downloaded at build time (§4.4) |
| `user_read_at` | **year grouping** and sort order |
| `user_rating` (0–5) | stars on the card (hidden if 0 / unrated) |
| `user_shelves` | **DNF detection** (see below) |
| `book/num_pages` | spine **thickness** |
| `link` | "view on goodreads" link |

**Decisions**

- **Undated books are excluded.** A book with no `user_read_at` is skipped. There's no "undated" shelf and no fallback to `user_date_added`. The build log reports how many were skipped, so they can be fixed on Goodreads if wanted.
- **Re-reads:** RSS exposes only the latest read date, so a re-read appears once, in its latest year. This is accepted.
- **DNF books:** my DNF shelf is **`did-not-finish`**. The fetcher always pulls `?shelf=did-not-finish` as well as `?shelf=read` and merges the two by `book_id`, with `dnf: true` on anything from the DNF shelf. This works whether `did-not-finish` is an exclusive shelf or a tag on books that are also in `read`. As a second check, any `read` item whose `user_shelves` includes `did-not-finish` is also marked DNF. The shelf name lives in `src/_data/books.config.js`. DNF books still need a date to be shown. They use `user_read_at`, or for an exclusive DNF shelf, `user_date_added` as the "stopped" date. That is the only case where the added date is used.
- **Pagination:** fetch `page=1,2,3…` until a page returns zero items, with a hard cap of 50 pages.
- **Politeness:** the fetch runs only at build time, about once a day, with an honest `User-Agent` (`danaadylova.com-books/1.0`). The site never fetches from visitors' browsers.

**Feed access: confirmed public** (checked 2026-09-28 in a logged-out window). If the profile ever goes private, the build fails loudly when the feed returns zero items and there's no cache, and otherwise falls back to the cache.

### 4.2 Fetch at build time

- An Eleventy global data file, **`src/_data/books.js`**, runs during `npm run build`. It fetches and parses the RSS with `fast-xml-parser` (devDependency), normalizes it, downloads covers, and computes spine colors.
- Output shape:

```js
{
  updatedAt: "2026-09-28T17:00:00Z",
  total: 214,
  skippedUndated: 3,
  years: [
    { year: 2026, books: [ /* newest read first */ ] },
    { year: 2025, books: [ ... ] }
  ]
}
// book:
{ id, title, series, author, cover: "/img/books/12345.jpg", rating, dnf,
  pages, readAt, url, hasReview,
  spine: { color, textColor, width, height } }
```

- **Grouping:** by the year of `user_read_at` in the America/Los_Angeles time zone. Years run newest first. Within a year, books run by read date, newest first, left to right.
- **Resilience:** after a successful fetch, write the normalized list (without images) to `src/_data/books.cache.json`. If Goodreads fails at build time, use the cache and still build, with a warning in the Action log.

### 4.3 Keeping it fresh

- Add a `schedule:` trigger to `.github/workflows/deploy.yml`, daily at `17 13 * * *` UTC (about 6 am PT). The existing `workflow_dispatch` covers "refresh now".
- Optional: a small workflow that commits `books.cache.json` only when it changes, which gives a readable git history of my reading.

### 4.4 Covers and spine color (from the cover)

**Decision: spine color comes from each book's cover.**

- At build time, download each cover once into a cache folder (`.cache/covers/{id}.jpg`, cached across CI runs with `actions/cache`), then:
  - resize it to 400px wide as WebP + JPEG with `sharp`, and emit it to `_site/img/books/{id}.{webp,jpg}`. **Covers are self-hosted**, with no hotlinking to Goodreads.
  - extract the **dominant color** with `sharp`'s `stats().dominant` (or `node-vibrant` if that looks muddy in practice), then:
    - nudge it toward the site's warmth: clamp saturation to about 25–60% and lightness to about 25–70%, so neon covers don't break the palette;
    - choose ink `#2b211a` or cream `#fbfaf4` spine text, whichever passes **WCAG AA** (4.5:1) against it;
    - derive a slightly darker shade for the spine bands and page edges.
- Goodreads "no photo" placeholders (URLs containing `nophoto`) and failed downloads fall back to a curated palette color seeded by `book_id`, plus a generated typographic cover (§6.5).
- New dependencies (devDependencies only, nothing shipped to the browser): `fast-xml-parser`, `sharp`. Covers are cached, so a daily build only downloads new books.

## 5. Information architecture & navigation

- New route: **`/books/`**, source `src/books.njk` using `base.njk`.
- Header nav (`src/_includes/base.njk`): **`/blog /projects /books /resume /now`**, with the same `here` active-state logic as the others.
- Home page `ls` output (`src/index.njk`): add `books/` in the same position.
- Page heading: `<h1 data-typed>books</h1>`, with a mono subtitle such as `214 books · 6 dnf · updated 28 Sep 2026 · via goodreads`.
- Each year is its own shelf with a `## 2026` heading and a muted count `(23)`.
- **Deep links:** `/books/#b-{book_id}` opens that book, and its panel, on load. Opening a book updates the hash with `history.replaceState`.

## 6. Experience design: the shelf

### 6.1 The shelf

- Each year is a **shelf**: a row of books standing upright on a plank. The plank should be restrained and on-brand, not skeuomorphic wood: a 10–12px bar in `--card` with a `--card-border` top edge, a 3px offset shadow like `.card`, and a soft contact shadow under the books.
- **Books are 3D CSS objects.** Each is a `transform-style: preserve-3d` box made of **spine**, **front cover** (the real cover image), **back cover** and a page-edge face, with `perspective: ~1200px` on the shelf. At rest only the spine is visible.
- **Spine sizing:** width from `num_pages`, clamped to **18–46px** (seeded random if unknown). Height seeded from `book_id`, **150–190px**, on a shared baseline.
- **Spine look:** background is the cover-derived color (§4.4). The title is set vertically (`writing-mode: vertical-rl`) in Space Mono, with the author abbreviated at the foot. There are thin darker bands near the top and bottom, and a faint vertical gradient for roundness.
- **Spine markers (small, quiet):**
  - **Reviewed by me:** a thin **terra ribbon bookmark** hangs from the top of the spine.
  - **Has visitor notes:** a tiny cream **paper slip** peeks out of the top edge. Counts load after page load (§7.3), so this appears with a soft fade.
  - **DNF:** the book **leans** against its neighbor (`rotate(-4deg)` from the base corner), and a short folded bookmark sticks out halfway down the fore-edge, as if "left off here". The spine label stays readable.
- **Layout:** the site column is `46rem` wide, so a year with many books wraps onto more planks (a bookcase), with no horizontal scroll on desktop.
- **Entrance:** when a shelf enters the viewport (IntersectionObserver), its books drop in with a staggered settle (about 20ms stagger, 400ms cap). This runs once.

### 6.2 Hover: "the hop"

- On `pointerenter` / `:focus-visible`, the book **lifts about 12px** and tilts back slightly (`rotateX(-2deg)`). Its contact shadow softens and spreads.
- Easing: `transform 260ms cubic-bezier(.34,1.56,.64,1)`, which gives a small springy overshoot, then a 200ms settle on leave. Only the hovered book moves.
- A small mono label floats above the lifted book: `title — author` (+ ` · dnf`).
- Hovering starts preloading that book's cover and its comments (§7.3), so the flip and the panel are instant.
- If the site's existing sound toggle is on, play a soft "tick". It's off by default.

### 6.3 Click: "pull it out and turn it"

This is a choreographed sequence of about **700–900ms**:

1. **Pull (0–250ms):** the book slides toward the viewer (`translateZ` +60–80px) and up slightly.
2. **Travel (150–600ms):** the book moves (FLIP) from its slot to the **left-center** of the viewport, leaving room for the panel, and scales up to a cover width of about **240–280px**.
3. **Turn (250–750ms):** it rotates about the Y axis, −90°, so the **front cover** faces the viewer, with a slight settle at the end.
4. **Panel (550–900ms):** the **reading-notes panel** (§7.4) slides in from the right, with a very slight rotation that settles flat, like a sheet of paper being set down.
5. **Backdrop:** the page dims with a `--paper` overlay at about 85% opacity, plus a light blur where supported. The empty gap on the shelf stays visible.

**Putting it back:** Esc, the `×` button, or a backdrop click plays the sequence in reverse. The panel slides out first, then the book turns and returns to its gap. Only one book can be open at a time. Opening another book returns the current one first (chained, or overlapping by about 150ms).

**Implementation:** animate only `transform`/`opacity`, using the Web Animations API, so the sequence can be reversed when interrupted. Animate a **clone in a fixed layer**, never the in-flow element. No animation libraries: vanilla JS in `src/js/books.js`, loaded only on `/books/`. Budget: **≤ 12 KB gzipped JS** (including comments), **≤ 8 KB gzipped CSS**.

### 6.4 Reduced motion

With `prefers-reduced-motion: reduce`: no entrance drop, hop, lean animation or 3D travel. Opening is a **~150ms crossfade** to the cover and panel.

### 6.5 Missing covers

The fallback is a **typographic cover**: a palette color background, the title in Space Mono, the author in Inter, and a small `~/dana $` colophon. It uses the same dimensions, so the turn still works.

### 6.6 Mobile and touch

- Tap opens. There's no hover state.
- Below about 480px, spines shrink about 15%. Very thin spines get an enlarged invisible hit area, at least 24px.
- The opened book sits in the upper third of the screen. The panel becomes a **bottom sheet** that rises to about 60% height and can be dragged to full height. Swipe the sheet down to close.

### 6.7 Empty and error states

- No books (feed private and no cache): the build fails on first run (§4.1). In any later failure the cache is used, and the "updated" date shows how stale it is.

## 7. Reviews & comments

### 7.1 Two kinds of writing, kept distinct

| | **My review** | **Visitor notes** |
|---|---|---|
| Written by | Dana only | anyone, no account |
| Stored in | Markdown file in this repo | Postgres, via a small API |
| Rendered | at **build time**, static HTML | fetched **client-side** when a book opens |
| Editing | edit the file, push | post only; Dana can hide |
| Shown as | pinned "index card" at the top of the panel | a thread of notes below it |

**My reviews:** one file per book, `src/reviews/{book_id}.md`:

```markdown
---
book_id: 12345
date: 2026-09-20
---
The first 100 pages are a slog and then it absolutely **wrecks** you…
```

- Full Markdown is allowed, including the site's `[[wikilinks]]` to notes and projects.
- Files can be drafted in Obsidian (the `danaadylova-obsidian` vault) and copied or synced into `src/reviews/`.
- A review whose `book_id` isn't on the shelf triggers a build warning, not an error.
- `hasReview` goes into the book data, which drives the ribbon marker (§6.1).

### 7.2 Visitor notes: backend

**Recommendation: add a small comments API to the existing unraveled.makes FastAPI app.** It already has hosting, Postgres (`asyncpg`), and outgoing email (`send_email`, `NOTIFY_EMAIL`), so there's no new infrastructure or third-party service, and I get full control over how it looks.

*Alternatives considered*

- **giscus** (GitHub Discussions): no backend, but commenters must sign in with GitHub, and it's an iframe with limited styling. That doesn't feel cozy, and most readers aren't on GitHub.
- **Cusdis / Remark42 / Commento**: anonymous, but either another hosted service or another thing to self-host, and styling is still constrained.
- **Supabase / Firebase**: a new vendor and keys for one table.

*Data model* (new table in the existing Postgres):

```sql
CREATE TABLE book_comments (
  id          BIGSERIAL PRIMARY KEY,
  book_id     TEXT        NOT NULL,                 -- Goodreads book_id
  parent_id   BIGINT      REFERENCES book_comments(id),  -- set on replies; always a top-level note
  name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  body        TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  is_author   BOOLEAN     NOT NULL DEFAULT FALSE,   -- Dana replying in-thread
  status      TEXT        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','rejected')),
  reply_to_name TEXT,                               -- "@name" when replying to a reply
  approved_at TIMESTAMPTZ,
  ip_hash     TEXT        NOT NULL,                 -- salted SHA-256, for rate limiting only
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON book_comments (book_id, created_at) WHERE status = 'approved';
CREATE INDEX ON book_comments (status, created_at) WHERE status = 'pending';
```

*Endpoints* (host e.g. `https://unraveled.danaadylova.com`, path prefix `/site/`):

| Method & path | Purpose |
|---|---|
| `GET /site/books/comments/counts` | `{ book_id: count }` of **approved** notes, for spine markers. Cached 5 min. |
| `GET /site/books/{book_id}/comments` | **approved** notes only, oldest first, replies nested under their top-level note |
| `POST /site/books/{book_id}/comments` | `{ name, body, parent_id?, website }` (where `website` is a honeypot) → `202 { id, status: "pending" }` |
| `GET /site/books/comments/{id}/moderate?action=approve\|reject&token=…` | one-click **approve** / **reject** from the notification email (HMAC-signed, single-use token). It shows a small confirmation page and uses POST on confirm, so email link scanners can't trigger it. |
| `GET /site/books/comments/pending` + `Authorization: Bearer <DANA_TOKEN>` | queue of pending notes (backs an optional `/books/moderate` page) |
| `POST /site/books/comments/{id}/(approve\|reject\|hide)` + Bearer | moderate from the queue; `hide` removes an already approved note |
| `POST /site/books/{book_id}/comments` + `Authorization: Bearer <DANA_TOKEN>` | posts as Dana, with `is_author = true`, an "author" badge, and **auto-approved** |

*Abuse & safety*

- **CORS** is locked to `https://danaadylova.com` for the `/site/*` routes. The current app allows `*`, so these routes get their own policy.
- **Honeypot field** + **minimum time-to-submit** (form open for at least 3s) + **rate limit**: 3 posts per 10 min and 20 per day per `ip_hash`.
- **Plain text only.** Escaped on render, line breaks preserved, URLs auto-linked with `rel="nofollow ugc noopener"`. No HTML or Markdown from visitors.
- **Moderation: hold for approval.** Every visitor note is saved as `pending` and is **not public** until approved. Each new note emails Dana (reusing `send_email`) with the book title, the note being replied to (if any), name, text, and **Approve** / **Reject** links. Pending notes older than 30 days are auto-rejected, with a digest line in the next email. Cloudflare Turnstile is the next step if spam still gets through the honeypot and rate limit.
- **Replies:** anyone can reply to a note. The thread is **one level deep**: a reply to a reply attaches to the same top-level note, with `reply_to_name` shown as `↳ @name`. That keeps the narrow panel readable. Replies go through the same approval queue, and Dana's own replies are auto-approved.
- **Privacy:** no email addresses are collected. The raw IP is never stored, only a salted hash. The form includes a one-line note saying notes are public.
- `book_id` must match a book on the shelf. The API loads the list of valid IDs from the site's published `/books/ids.json`, refreshed hourly, so random IDs are rejected. `parent_id` must belong to the same book and be approved.

### 7.3 Loading behavior

- Comment counts load once, after the page is idle (`requestIdleCallback`).
- A book's thread is fetched **on hover/focus** (prefetch) and cached in memory, so it's usually ready when the panel opens. Otherwise the panel shows a skeleton of three faint lines for up to about 300ms.
- If the API is down, my review still shows because it's static. The notes area shows a gentle `couldn't reach the notes right now — try again in a bit` with a retry link.

### 7.4 The reading-notes panel: "cozy"

The panel is the warm counterpart to the shelf's crisp motion. It should feel like the **inside cover of a well-loved library book**: paper, ink, a little handwriting, nothing glossy.

- **Container:** about 380px wide on desktop, full-height beside the cover. The background is `--card` `#fffef9` with the site's **dot-grid** faintly visible, a 1px `--card-border`, the signature **3px offset shadow**, and a slightly rounded 8px radius. There's a thin **terra "stitched" dashed border** inset 6px, a quiet nod to yarn.
- **Header:** book title (Space Mono, ink), author (Inter, muted), then a metadata row:
  - `★★★★☆` in terra, **or** a **`dnf` pill** (`--pill-bg` / `--pill-ink`). For a DNF book the stars are replaced, not combined.
  - `read mar 2025` (or `put down mar 2025` for DNF) · `384 pages` · `goodreads →`
- **My review ("dana's notes"):** styled as a **lined index card**:
  - Faint horizontal rules in `--dot` at the body line-height, a pale red margin line on the left, and a piece of **washi tape** (a translucent terra strip rotated −3°) "holding" it to the panel.
  - The label `dana's notes` is set in a handwriting accent font (**Caveat**, loaded only on `/books/`), then the review body in Inter, then the date in mono.
  - If there's no review, the card is omitted, with no empty placeholder.
- **Visitor notes ("margin notes"):**
  - The section label reads `margin notes (4)` in Caveat.
  - Each note is a small paper slip: name in Space Mono, relative date (`3 days ago`, with the full date on hover), then the body. Slips alternate a tiny rotation (±0.4°) so the stack feels hand-placed, not gridded.
  - Each commenter gets a small **yarn-ball avatar**: a 20px circle with two curved strokes, colored from a hash of their name within the site palette. There are no uploaded images.
  - **Replies** sit indented under their note, joined by a thin dashed "thread" line (a yarn strand). A reply to a reply shows `↳ @name`. Each note has a small `reply` link that opens the compose form inline under that note.
  - **Dana's in-thread replies** get a terra left border and an `author` tag.
  - The empty state reads *"no margin notes yet — be the first to scribble something."*
- **Compose form, at the bottom of the panel and sticky on desktop:**
  - A single textarea with placeholder `leave a note in the margin…`, a `name` field (remembered in `localStorage`), and a character counter that appears near the limit.
  - The button reads `pin it` (terra, mono). On submit, the new note **slides in and gets "pinned"**: a tiny drop with an overshoot, then a settle. It's shown **only to the author**, slightly faded, with a Caveat tag reading *"waiting for dana to read it ✎"*. It's kept in `localStorage` by id, so it survives a reload until approved or rejected. It isn't visible to anyone else.
  - The fine print says *notes are public once approved · be kind*.
  - Errors are shown inline in the same voice, e.g. *"slow down a sec — try again in a few minutes"* for a rate limit.
- **Scroll:** the panel scrolls on its own. The page behind it is scroll-locked while a book is open.
- **Accessibility:** the panel is part of the book dialog. Headings are real `<h2>/<h3>`. Notes are a `<ol>` of `<article>`. The form has visible labels. A newly posted note is announced via `aria-live="polite"`.

## 8. Accessibility (whole page)

- Each book is a `<button>` in a per-shelf `<ul>` (`<section aria-labelledby>` per year). Its accessible name is `"{title} by {author}, read {Month YYYY}"`, plus `", did not finish"`, `", reviewed"` and `", {n} notes"` where they apply.
- Arrow keys move focus along and across shelves (roving `tabindex`). Tab moves between shelves. Enter/Space opens.
- The opened book + panel is a **modal dialog** (`role="dialog"`, `aria-modal="true"`). Focus goes to the title, is trapped, and **returns to the originating spine** on close.
- Spine text meets AA contrast, enforced at build time (§4.4).
- **No-JS fallback:** a year-grouped list (`title — author · ★★★★ / dnf`), with my reviews rendered inline under their books. Visitor notes need JS.

## 9. Performance

- The shelf, my reviews and cover URLs are static HTML. The only client fetches are comment counts (one request, after idle) and per-book threads (on demand).
- Spines are pure CSS/DOM. Covers load only on hover or open.
- Targets on a mid-range phone: **LCP < 1.5s**, **CLS ≈ 0**, **60 fps** hop, flip and panel slide.
- Past about 500 books, use `content-visibility: auto` on off-screen shelves.

## 10. Technical plan (files)

**Site repo (`danaadylova.github.io`)**

| File | Change |
|---|---|
| `src/_data/books.js` | **new**: fetch read + DNF shelves, normalize, drop undated, group by year, download/resize covers, extract spine colors, check contrast, attach `hasReview`, fall back to cache |
| `src/_data/books.config.js` | **new**: user id, DNF shelf name, comments API base URL |
| `src/_data/books.cache.json` | **new**: last good snapshot |
| `src/reviews/*.md` | **new**: my reviews, one per book (`permalink: false`, not their own pages) |
| `src/books.njk` | **new**: `/books/` page, shelves, dialog + panel template, no-JS list |
| `src/books-ids.njk` | **new**: emits `/books/ids.json` for comment validation |
| `src/css/books.css` | **new**: shelf, 3D books, hop, lean, panel, index card, notes, form, reduced motion |
| `src/js/books.js` | **new**: hover/preload, open/close choreography (WAAPI + FLIP), keyboard nav, hash deep links, comments fetch/post/render |
| `src/_includes/base.njk` | add `/books` to nav; per-page `extraCss` / `extraJs` / `extraFonts` front-matter hooks |
| `src/index.njk` | add `books/` to the `ls` output |
| `.github/workflows/deploy.yml` | daily `schedule:`; `actions/cache` for `.cache/covers` |
| `package.json` | devDependencies `fast-xml-parser`, `sharp` |
| `.gitignore` | add `.cache/` |

**API repo (`ravelry-gauge-matcher` / unraveled.makes)**

| File | Change |
|---|---|
| `app/site_comments.py` | **new**: `APIRouter` with the `/site/books/...` endpoints, rate limiting, honeypot, approve/reject tokens, pending queue, 30-day auto-reject |
| `app/db.py` | `book_comments` table creation + queries |
| `app/main.py` | `include_router`, scoped CORS for `/site/*` |
| env vars | `DANA_COMMENT_TOKEN`, `COMMENT_HMAC_SECRET`, `IP_HASH_SALT` |

## 11. Acceptance criteria

1. `/books` appears in the header as `/blog /projects /books /resume /now` and is highlighted when active. `books/` appears in the home `ls`.
2. `/books/` shows every **dated** book on the Goodreads `read` shelf, plus DNF books, grouped into year shelves newest first. Undated books are absent, and the build log reports the count skipped.
3. A newly finished book appears within 24h (scheduled build) or immediately on a manual workflow run, with no code change.
4. If Goodreads is unreachable, the build still succeeds from cache. If the feed is empty and there's no cache, the build fails with a clear "is your shelf public?" message.
5. Spine colors come from each cover, stay within the site's saturation/lightness range, and all spine text passes AA contrast.
6. Rated books show stars. DNF books show a `dnf` pill instead of stars, lean on the shelf, and have a fore-edge bookmark.
7. Hover/focus lifts a book about 12px with a springy ease. Other books don't move.
8. Clicking a book pulls it out, carries it to center-left, and turns it to the front cover. Then the panel slides in with metadata, my review (if any) and visitor notes. Closing reverses the animation and returns focus to the spine.
9. A visitor can post a note or a reply with just a name and text. They see it with the "pinned" animation and a *waiting for approval* tag. It's **not visible to anyone else** until Dana approves it from the email (one click + confirm). Rejected notes never appear, and the author's local pending copy clears on their next visit.
9a. Replies to replies attach to the same top-level note with an `↳ @name` prefix. Dana's own posts and replies are auto-approved and badged `author`.
10. Posting more than 3 notes in 10 minutes from one IP is rejected with a friendly message. Filling the honeypot or submitting in under 3s is silently dropped, and no email is sent.
11. Adding `src/reviews/{book_id}.md` and pushing shows the review as the pinned index card and adds a ribbon marker to that spine.
12. If the comments API is down, the shelf, flip and my reviews all still work, and the notes area shows a friendly retry message.
13. Animations hold 60 fps on a mid-range phone and a MacBook, and only animate `transform`/`opacity`. Reduced motion gives crossfades only.
14. Fully usable with keyboard only and VoiceOver, including posting a note. axe-core reports no serious or critical issues.
15. Works in the latest Safari (macOS and iOS), Chrome and Firefox. `/books/#b-{id}` opens that book directly.

## 12. Rollout

1. ~~Check that the feed is public~~ ✅ confirmed 2026-09-28.
2. Build the data pipeline + static shelf, with no animation yet. Verify counts against Goodreads.
3. Add the hop, the flip and reduced motion.
4. Add my reviews (static) and the panel design.
5. Ship the comments API on unraveled.makes, then wire it into the panel.
6. Launch: add the nav item, write two or three reviews so the shelf has ribbons from day one.

## 13. Decisions log

| # | Question | Decision |
|---|---|---|
| 1 | Nav position | `/blog /projects /books /resume /now` |
| 2 | Show ratings? | Yes, show stars. Also show **DNF** status (replaces stars), from the `did-not-finish` shelf. |
| 3 | Undated books | **Excluded** from the page |
| 4 | Re-reads | Appear once, in the latest read year |
| 5 | Spine color | **From the cover** (build-time `sharp`), clamped to the site palette |
| 6 | Is the read shelf public? | **Yes**, confirmed 2026-09-28 |
| 7 | Reviews | Written on my site as Markdown in `src/reviews/`, independent of Goodreads |
| 8 | Comments | Anyone can comment, no account. Custom API on the unraveled.makes backend (approved). |
| 9 | DNF shelf name | `did-not-finish` |
| 10 | Moderation | **Hold for approval.** Nothing public until Dana approves. |
| 11 | Replies | Yes: visitors can reply to each other, one level deep, with `@name` for replies to replies |

## 14. Open questions

None. All questions are resolved (see §13).
