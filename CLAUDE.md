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
| `src/css/garden.css`, `src/js/garden.js` | Site-wide styles (paper `#fbfaf4` dot grid, Space Mono + Inter, terra `#a9603a` / teal `#0f6e56`) and the typed-heading / keyboard-sound effects |
| `src/books.njk`, `src/css/books.css`, `src/js/books.js` | **/books** bookshelf page (see below) |
| `src/books-ids.njk` | `/books/ids.json`: `{goodreadsId: "Title — Author"}`, read by the notes API to validate book ids |
| `src/_data/books.js` | Global data `books`: Goodreads → shelves, covers, spine colors; also builds the compact JSON the page script reads |
| `lib/books/` | Pipeline code: `goodreads.js` (RSS parse/normalize/merge), `fetch.js` (paginated fetch), `covers.js` + `color.js` (download/resize covers, cover-derived spine colors with AA contrast), `reviews.js` (Markdown reviews), `config.js` (**settings: Goodreads user id, shelves, fold rows, notes API URL**) |
| `src/reviews/*.md` | Dana's own reviews (front matter `book_id`). Not output as pages (`reviews.json` → `permalink: false`) |
| `notes/notes.json` | Nightly backup of all approved margin notes (written by `notes-export.yml`); also rendered into the page as a fallback |
| `test/` | `node --test` suites (`npm test`, 17 tests). Fixtures mimic Goodreads RSS exactly |
| `docs/prd-books.md` | **The /books PRD**: design, decisions log, mockups (`docs/prd-books/*.jpg`), rejected directions, implementation status. Read it before changing /books |
| `scripts/books-report.mjs` | Summarizes a build's Goodreads data (used by CI) |

`base.njk` supports per-page front matter: `pageClass`, `extraCss`, `extraJs`, `extraFonts`.
Headings get `# ` / `## ` prefixes from garden.css; the books page turns that off for its own headings.

## Commands

```bash
npm ci
npm test                 # 17 tests
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
  - Year shelves using Instrument Serif numerals. Years with more than 3 shelves **fold to 2 shelves sorted by rating then date**; "show all" expands to read-date order with FLIP animation.
  - DNF books lie flat in piles. 4★ gets a foil star, 5★ a star plus foil bands.
  - Filters all / loved / unfinished dim books without moving them.
  - Clicking a book pulls it out and turns it to its cover, then opens the reading panel.
  - Evening mode follows `prefers-color-scheme` (charcoal, not brown). Reduced-motion and no-JS fallbacks are included.
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
