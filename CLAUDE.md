# danaadylova.com: context for Claude sessions

Dana Adylova's personal site / digital garden. **Eleventy 3** (Nunjucks + Markdown) → **GitHub Pages** at https://danaadylova.com.
Everything is committed to `main`; a push to `main` deploys (`.github/workflows/deploy.yml`, ~1 min).

Related repo: **danaadylova/ravelry-gauge-matcher**, the *unraveled.makes* FastAPI app on **Railway** at
https://unraveled.danaadylova.com. It also hosts the **margin-notes (comments) API** for `/books` under `/site/*`.
See its `CLAUDE.md`.

## Layout

| Path | What |
|---|---|
| `src/` | Eleventy input. `_includes/base.njk` (layout, header nav, footer), `index.njk` (home with `ls` list), `blog.njk`, `projects/`, `posts/`, `now.md`, `resume.njk` |
| `src/css/garden.css`, `src/js/garden.js` | Site-wide styles (paper `#fbfaf4` dot grid, Space Mono + Inter, terra `#a9603a` / teal `#0f6e56`, retro mode) and the typed-heading / typing-sound / retro-mode switches |
| `src/js/keyboard.js`, `src/js/typewriter.js` | The home page's 3D keyboard and, in retro mode, the typewriter (three.js r128 in `src/js/vendor/`) |
| `src/books.njk`, `src/css/books.css`, `src/js/books.js` | **/books** bookshelf page (see below) |
| `src/books-ids.njk` | `/books/ids.json`: `{goodreadsId: "Title — Author"}`, read by the notes API to validate book ids |
| `src/_data/books.js` | Global data `books`: Goodreads → shelves, covers, spine colors; also builds the compact JSON the page script reads |
| `lib/books/` | Pipeline code: `goodreads.js` (RSS parse/normalize/merge), `fetch.js` (paginated fetch), `covers.js` + `color.js` (download/resize covers, cover-derived spine colors with AA contrast), `reviews.js` (Markdown reviews), `config.js` (**settings: Goodreads user id, shelves, fold rows, notes API URL**) |
| `src/reviews/*.md` | Dana's own reviews (front matter `book_id`). Not output as pages (`reviews.json` → `permalink: false`) |
| `notes/notes.json` | Nightly backup of all approved margin notes (written by `notes-export.yml`); also rendered into the page as a fallback |
| `test/` | `node --test` suites (`npm test`, 21 tests). Fixtures mimic Goodreads RSS exactly |
| `docs/prd-books.md` | **The /books PRD**: design, decisions log, mockups (`docs/prd-books/*.jpg`), rejected directions, implementation status. Read it before changing /books |
| `scripts/books-report.mjs` | Summarizes a build's Goodreads data (used by CI) |

`base.njk` supports per-page front matter: `pageClass`, `extraCss`, `extraJs`, `extraFonts`.

**Look (Sep 2026 refresh):** page and post titles (`h1`) are **IM Fell English** (Sep 30 2026, replaced Instrument Serif; loaded site-wide in `base.njk`, `--serif` in garden.css, `--display` in books.css); section headings (`h2`) stay Space Mono with the `## ` prefix; body is Inter. `--muted` is `#7a6b52` (≈5:1 on paper; don't lighten it). The current nav item gets `class="here"` + `aria-current`.
- **Evening mode everywhere:** `garden.css` redefines the color tokens under `@media screen and (prefers-color-scheme: dark)` with the /books charcoal palette (screen only, so printing stays light). Use tokens, never literal colors, in new CSS. `books.css` keeps its own richer palette on `html.page-books`.
- **/now** (`src/now.md`, Liquid): keep the "as of Month Year" line current; the currently-reading book is filled in live from `books.reading`.
- Resume skills (`.pill`) are terra outlines.
- **Home keyboard** (`src/js/keyboard.js`, three.js r128 vendored at `src/js/vendor/`, home page only): a 3D olive + butter-yellow keyboard between the intro and the prompt. `garden.js` waits for `kb:ready` (max 2.5 s), sends a `garden:key` event per character of `~/dana $ ls -l`, then presses enter before the listing fades in. Keys also press on click (raycast hits meshes only; outlines are lines and would steal clicks) and on real typing. The yarn ball on escape reads `--terra`; the listing links use `--olive` (the case as it renders). Evening mode: the same colors muted, with a warm glow under the keys. The render loop only runs while a key moves; `window.gardenKeyboard.step/pressed/screenPos` are test hooks.
- **Retro mode** (Sep 30 2026): a visitor switch that makes the **whole site** dark (`html.retro` in garden.css: tokens, and a warm charcoal `#1d1b19` (cards `#262320`) with no dot grid, painted on html *and* body since a host that gives body a background would otherwise cover it; screen only, so the resume prints light). On the home page a warm lamp glow sits behind the typewriter (`.tw::before`): it breathes, and every 5–16 s typewriter.js adds `.flicker` and dims the 3D lamp and desk pool in step. Switches: two `role="switch"` buttons at the top of the home page ("retro mode", "typing sounds"; `retroSwitch: true` in its front matter drops the footer toggles there) and "retro mode: off · typing sounds: off" in every other footer. The logic lives in `garden.js` (remembered in `localStorage` `garden-retro`; `base.njk` applies it in `<head>` before paint; fires `garden:retro`). /books uses its evening palette under retro (`html.page-books.retro`, PRD decision #29). In retro the listing links' `--olive` is rust `#cf6f3c`. **Switching** plays the lamp (`.lamp-veil` in garden.css): the room light flickers out, the class flips in the dark, the lamp warms up from where the typewriter sits (an `@property --lamp-r` mask); going back, daylight sweeps down. Reduced motion gets a plain fade.
  - **Typewriter** (`src/js/typewriter.js`, home page, built only when retro is on): replaces the keyboard, types the prompt onto its paper (the keyboard stands down and the typewriter sends `kb:ready`), then the title and opening sentence(s) of a **random blog post** from `#tw-entries` (JSON in `index.njk`, word-wrapped at 26 columns, only characters it has keys for). Visitors can click keys, pull the return lever, or type; that stops the note. With typing sounds on it uses `window.gardenSound` for a clack, the margin bell and the return ratchet. `garden.js` `gardenRetype()` retypes the prompt when the switch flips. `window.gardenTypewriter.text/step/screenPos` are test hooks. The paper font is Courier Prime (`extraFonts` on the home page).
- **Home** (`src/index.njk`): intro, then an `ls -l` listing whose right column is live (post count, live projects, `books.total` + currently reading in the same mono type as "reading", `now_updated` from the "as of Month Year" line in `now.md`).
- **Blog** (`src/blog.njk`): grouped by year; each post shows an excerpt, `topic` and reading time. **Give every new post a `topic:` in its front matter** (used so far: `books`, `knitting`, `this site`).
- **Posts** (`src/_includes/post.njk`): meta line `date · N min read · topic`, older/newer links at the end.
- **Book covers in posts:** `{% favorite "<goodreads ids>" %}markdown{% endfavorite %}` (in `eleventy.config.js`) shows a fan of covers beside the entry; a first line that is only bold becomes the entry title. Posts using it need `templateEngineOverride: njk,md` (see `src/posts/get-to-know-me-in-books.md`). Covers for undated books (`books.undated`) are downloaded too, shown without a link since they aren't on /books.
- **Projects** (`src/projects/*.md`): front matter `status`, `link`, `linkLabel`, optional `post` (blog post URL), `order`.
- Filters in `eleventy.config.js`: `gdate` ("17 Jul 2026"), `dayMonth`, `year`, `readTime`, `excerpt`.
- CSS/JS URLs carry `?v={{ build.v }}` (`src/_data/build.js`) so a deploy is never hidden by browser cache.

## Commands

```bash
npm ci
npm test                 # 21 tests
npm run serve            # http://localhost:8080 (fetches Goodreads live)
npm run serve:offline    # BOOKS_FIXTURE=1: sample books, no network needed
BOOKS_NOTES_API=http://localhost:8000/site npm run build   # point notes at a local API
```

## /books: how it works

- **Data:** Goodreads has no API (retired 2020), so the site uses per-shelf **RSS** at build time: `https://www.goodreads.com/review/list_rss/135558742?shelf=<shelf>&page=N`.
  - Shelves: `read`, `currently-reading`, and for DNF both the shelf `did-not-finish` **and** the tag `dnf` (`?shelf=dnf` works for tags).
  - Books with no read date are **left out** (decision #3; 63 of 461 as of Sep 2026). DNF books use the date they were shelved.
  - Years are grouped in Pacific time.
- **Covers:** downloaded once, resized to 400px WebP + JPEG under `.cache/books/covers/`, and passthrough-copied to `/img/books/<id>.{webp,jpg}`. Spine color = the cover's dominant color, clamped to the palette, with ink or paper text at ≥ 4.5:1 contrast.
- **Resilience:** live fetch → `.cache/books/snapshot.json` (kept between CI runs by `actions/cache`) → the build fails with "is the shelf public?". Nothing from Goodreads is committed.
- **Freshness:** `deploy.yml` also runs daily at `17 13 * * *` UTC (~6am PT).
- **UI** (`src/js/books.js`, ported from prototype v9; see PRD §6.0):
  - A "currently reading" shelf (face-out covers + stoneware mug with canvas steam).
  - Year shelves using IM Fell English numerals (old-style figures), smaller than the page title. Years with more than 3 shelves **fold to 2 shelves sorted by rating then date**; "show all" expands to read-date order with FLIP animation.
  - DNF books lie flat in piles. 4★ gets a foil star, 5★ a star plus foil bands.
  - Filters all / loved / unfinished dim books without moving them.
  - Clicking a book pulls it out and turns it to its cover, then opens the reading panel.
  - Evening mode follows `prefers-color-scheme` (charcoal, not brown). Reduced-motion and no-JS fallbacks are included.
- **Reading cards:** `/books/<year>/` for each finished year (`src/books-year.njk`, stats in `lib/books/yearstats.js`, styles `src/css/books-year.css`, PRD §6.8). `books.cards` / `books.cardYears` in the global data; the shelf adds a "reading card →" link via `DATA.cards`.
- **Margin notes:** the panel talks to `lib/books/config.js` → `notesApi` (`https://unraveled.danaadylova.com/site`). Set it to `null` to show "coming soon".
  - Visitor notes are pending until approved.
  - Dana signs in via an emailed link ("sign in" at the bottom of /books). Her notes are pinned in "dana's notes", and she gets inline approve/reject/hide and edit/delete.

## CI workflows (`.github/workflows/`)

| Workflow | When | What |
|---|---|---|
| `deploy.yml` | push to `main`, daily, manual | test → build (Goodreads + covers, cached) → GitHub Pages |
| `books-data-check.yml` | push to `feat/books-*` | Builds with real data **without deploying**, writes counts as annotations, and publishes snapshot + covers to the throwaway branch `books-preview-data` (never merge it) |
| `notes-export.yml` | daily ~5:40am PT | `GET /site/books/comments/export` with secret `NOTES_EXPORT_TOKEN` → commits `notes/notes.json` if changed |
| `notes-api-check.yml` | daily ~9:20am PT, manual, push to `diag/**` | Probes the notes API like a browser (health, CORS, validation POST that saves nothing). **Fails and emails Dana** if settings are missing or the last email failed |

Repo secret: `NOTES_EXPORT_TOKEN`, the same value as `EXPORT_TOKEN` on Railway.

## Working from a Claude cloud session: gotchas

- The sandbox **cannot reach goodreads.com, danaadylova.com or unraveled.danaadylova.com** (egress allowlist), and neither can the linked Mac's shell. Workarounds used so far:
  - **Real Goodreads data locally:** push to a `feat/books-*` branch, then `git clone -b books-preview-data …` and copy `snapshot.json` + `covers/{out,meta}` into `.cache/books/`. The build then falls back to that cache.
  - **Probing the live API:** push to a `diag/<anything>` branch (runs `notes-api-check.yml`) and read the results publicly via `GET https://api.github.com/repos/danaadylova/danaadylova.github.io/check-runs/<job id>/annotations` (the runs/jobs APIs are public; logs and artifacts need auth).
- The git proxy can't delete remote branches, and `gh` isn't available.
- Google Fonts are blocked in the sandbox. For screenshots, install `@fontsource/*` packages and inject `@font-face` served over the local http server.
- Private previews for Dana: publish a built page as a Claude artifact. Absolute `/css`, `/js` and `/img` paths must be rewritten to relative ones, and covers need several publishes (max 255 files each).
- The local clone may only fetch `main`. If a stop hook says a branch is "unpushed", add a fetch refspec for it and `git branch -u origin/<branch>`.

## Conventions

- Lowercase, terminal voice in UI copy (`~/dana $`, `/books`).
- Work on a branch for anything big; Dana asks for merges explicitly. Commit messages end with the `Co-Authored-By` / `Claude-Session` lines from the session's reminder.
- The PRD is also mirrored in the "My website" Claude Project as `claude/prd-books.md`. Update both when decisions change.
