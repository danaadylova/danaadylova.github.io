# /blog topic filters: PRD

Status: **proposal, not built** (Oct 1 2026). Mockups in `docs/prd-blog-tags/` were made from a working prototype of the real /blog page.

## 1. Why

Every post already has a `topic` (books, knitting, photography, this site), shown as a small pill. With more posts on the way (photo posts, knitting, code), readers should be able to see only the posts about the thing they came for. Dana also wants a **tech** topic for the posts about building things.

## 2. What it looks like

Under the "Notes, experiments…" line on /blog, a terminal line and a row of topic pills:

```
~/dana $ ls blog/ --topic books
( all 5 ) ( books 2 ) ( knitting 1 ) ( photography 1 ) ( tech 2 ) ( this site 1 )
```

- **The prompt line** reads like a command and changes with the filter: `--topic *` for all posts, `--topic books`, `--topic "this site"`. Same voice as the home page's `ls -l`.
- **Pills** use the existing topic pill style (terra on its pale pill color) with the number of posts in a muted color. The selected pill is filled terra with paper-colored text. "all" comes first, then topics A–Z.
- **The list** keeps its year grouping. Posts that don't match are hidden, and a year heading disappears when none of its posts match.
- **Each post card** shows all of its topics as pills, and clicking one filters by it (the same as clicking it in the top row).
- **On a post page**, the topic pill in the meta line links to `/blog/?tag=<topic>`.

| Day (books) | Evening (tech) | Retro (books) |
|---|---|---|
| ![day](prd-blog-tags/day.jpg) | ![evening](prd-blog-tags/evening.jpg) | ![retro](prd-blog-tags/retro.jpg) |

Unfiltered: ![all](prd-blog-tags/day-all.jpg) Phone: ![phone](prd-blog-tags/phone.jpg)

Colors are garden.css tokens only (`--terra`, `--pill-bg`, `--muted`, `--teal` for `--topic`, `--paper`), so day, evening and retro follow automatically. On a phone the pills wrap to two lines.

## 3. Behavior

1. **One topic at a time.** Clicking a pill selects it; "all" (or clicking the selected pill again) clears the filter. No multi-select.
2. **Shareable URL.** The filter writes `?tag=books` (spaces as `-`, so `?tag=this-site`) with `history.replaceState`; opening that URL lands filtered. An unknown tag shows everything.
3. **No JavaScript:** the pill row is hidden and every post is listed, as today.
4. **Accessibility:** pills are `<button aria-pressed>`; a visually hidden live region says "2 notes about books". Focus stays on the pill. Contrast is the same as today's pills.
5. **Motion:** hidden posts fade out over 150 ms, nothing slides. None with reduced motion.
6. **Typing sounds:** clicking a pill makes the usual keyboard "thock" when typing sounds are on, and the `--topic` word re-types itself in the prompt line, like the site's other typed text.

## 4. Data

- Posts get **`topics:`**, a list: `topics: [books, tech]`. The old single `topic:` keeps working (read as a one-item list), so nothing breaks. The first topic stays the "main" one: the photo post meta line and the home page typewriter use it.
- The pill row is built at build time from all posts: every topic, its count, sorted A–Z, "all" first. A new topic appears by itself the first time a post uses it.
- **New topic: `tech`.** Proposed tagging (to confirm, see §6):

| Post | Topics |
|---|---|
| digital bookshelf and my reading journal | books, tech |
| planting this garden | this site, tech |
| dear california | photography |
| know me in books | books |
| on knitting your first (bad) sweater | knitting |

## 5. Out of scope (for now)

- A search box (full-text search across posts).
- Separate pages per topic (`/blog/topic/books/`) and per-topic RSS feeds. Easy to add later from the same data if wanted.
- Topic filters on /projects.

## 6. Open questions for Dana

1. Which posts get **tech**? The table above is a proposal.
2. Keep **this site** as its own topic, or fold it into **tech**?
3. Pill order: A–Z (proposed) or most posts first?
4. Should the home page `ls -l` line for `blog/` link straight to a topic? (Proposed: no.)

## 7. Build plan (after sign-off)

- `src/blog.njk`: the filter row, `data-topics` on each post card, topic pills as buttons/links.
- `eleventy.config.js`: a `topics` filter (normalizes `topic`/`topics`) and a `topicCounts` collection.
- `src/js/blog.js` (new, small): filtering, URL, live region, retyping the prompt word.
- `src/css/garden.css`: `.tag-filter`, `.tf-tag` (tokens only).
- `post.njk` / `photo-essay.njk`: topic pills link to `/blog/?tag=…`.
- Posts: add `topics:` per §4. CLAUDE.md: document `topics:` and the filter.
