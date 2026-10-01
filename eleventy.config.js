import markdownIt from "markdown-it";
import { feedPlugin } from "@11ty/eleventy-plugin-rss";

const slugMap = new Map();
const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/css": "css", "src/js": "js", "src/img": "img", CNAME: "CNAME" });
  // Book covers, downloaded and resized at build time by src/_data/books.js (see lib/books/covers.js).
  eleventyConfig.addPassthroughCopy({ ".cache/books/covers/out": "img/books" });
  eleventyConfig.addWatchTarget("./lib/books/");

  eleventyConfig.addPlugin(feedPlugin, {
    type: "atom",
    outputPath: "/feed.xml",
    collection: { name: "post", limit: 20 },
    metadata: {
      language: "en",
      title: "dana adylova — notes",
      subtitle: "Notes from somewhere between code and yarn.",
      base: "https://danaadylova.com/",
      author: { name: "Dana Adylova" },
    },
  });

  eleventyConfig.addCollection("garden", (api) => {
    const all = api.getAll().filter((p) => p.url && p.data.title);
    slugMap.clear();
    for (const p of all) {
      if (p.fileSlug) slugMap.set(p.fileSlug, { url: p.url, title: p.data.title });
    }
    const refs = new Map();
    for (const p of all) {
      const raw = p.rawInput || "";
      for (const m of raw.matchAll(WIKILINK)) {
        const slug = m[1].trim();
        if (!refs.has(slug)) refs.set(slug, new Set());
        refs.get(slug).add(p);
      }
    }
    for (const p of all) {
      const sources = refs.get(p.fileSlug) || [];
      p.data.backlinks = [...sources]
        .filter((s) => s.url !== p.url)
        .map((s) => ({ url: s.url, title: s.data.title }));
    }
    return all;
  });

  eleventyConfig.addFilter("wikilinks", (content) => {
    if (typeof content !== "string") return content;
    return content
      .split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>)/)
      .map((chunk, i) => {
        if (i % 2 === 1) return chunk;
        return chunk.replace(WIKILINK, (_, slug, label) => {
          slug = slug.trim();
          const target = slugMap.get(slug);
          const text = (label || slug).trim();
          if (!target) return `<span class="wikilink broken">[[${text}]]</span>`;
          return `<a class="wikilink" href="${target.url}">${text}</a>`;
        });
      })
      .join("");
  });

  // /books/ids.json → { "<goodreads id>": "Title — Author" } for the notes API (see src/books-ids.njk).
  eleventyConfig.addFilter("bookIdsJson", (books) => {
    const out = {};
    for (const b of [...books.reading, ...books.years.flatMap((y) => y.books)]) out[b.id] = `${b.title} — ${b.author}`;
    return JSON.stringify(out);
  });

  eleventyConfig.addFilter("gdate", (d) => {
    const x = new Date(d);
    const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][x.getUTCMonth()];
    return `${String(x.getUTCDate()).padStart(2, "0")} ${mon} ${x.getUTCFullYear()}`;
  });
  eleventyConfig.addFilter("dayMonth", (d) => {
    const x = new Date(d);
    return `${String(x.getUTCDate()).padStart(2, "0")} ${["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"][x.getUTCMonth()]}`;
  });
  // {% favorite "id id id" %}markdown{% endfavorite %}: a favourite book or series in a post, with a fan of its
  // covers from the /books shelf (each links to that book on /books). Ids are Goodreads ids; undated books (not on the
  // shelf) still show their cover, without a link; ids with no cover are skipped. Posts using it need `templateEngineOverride: njk,md`.
  const favMd = markdownIt({ html: true, typographer: true });
  eleventyConfig.addPairedShortcode("favorite", function (content, ids) {
    const books = this.ctx?.books || this.ctx?.environments?.books || {};
    const all = new Map([...(books.undated || []), ...(books.reading || []), ...(books.years || []).flatMap((y) => y.books)].map((b) => [b.id, b]));
    const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const found = String(ids).split(/[\s,]+/).filter(Boolean).map((id) => all.get(id)).filter((b) => b && b.cover);
    const covers = found.map((b, i) =>
      (b.year ? `<a href="/books/#b-${b.id}"` : `<span`) + ` style="--i:${i}" title="${esc(b.title)}"><img src="${b.cover}.webp" alt="${esc(b.title)}" loading="lazy">` + (b.year ? `</a>` : `</span>`)).join("");
    // a first line that is only bold text becomes the entry's title
    const text = favMd.render(content.trim()).replace(/^<p><strong>([\s\S]*?)<\/strong><\/p>/, '<p class="fav-title">$1</p>');
    return `<div class="favorite"><div class="fav-covers" style="--n:${found.length}">${covers}</div><div class="fav-text">${text}</div></div>`;
  });
  // Photo posts (layout photo-essay.njk, front matter `album: <name>`, `templateEngineOverride: njk,md`):
  //   {% frame { photo: "bench", at: "4-12", title: "…", note: "…", place: "…", alt: "…", lead: true } %}
  //   {% aside "1-3 end" %}markdown{% endaside %}      {% pull "9-12" %}one line{% endpull %}
  // `at` is a span of the 12-column grid ("first-last") plus optional words: "drop" starts it lower (the
  // staggered look), "end" sits it at the bottom of its row, "center" in the middle; other words become classes. Below 760px everything
  // is one column. Photos and their sizes, colors and EXIF come from src/_data/photos.json (made by
  // scripts/photos.mjs); captions are numbered by CSS like frames on a roll. `lead` loads it first.
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const escHtml = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const gridAt = (at) => {
    const m = /(\d+)-(\d+)/.exec(at || "1-12"), words = String(at || "").split(/\s+/);
    return {
      span: m ? m[2] - m[1] + 1 : 12,
      style: m ? `--c:${m[1]} / ${+m[2] + 1}` : "",
      mods: words.filter((w) => w && !/^\d+-\d+$/.test(w)).join(" "),   // drop, end, center, or any class
    };
  };
  eleventyConfig.addShortcode("frame", function (o) {
    const album = this.ctx?.album || this.ctx?.environments?.album;
    const photos = this.ctx?.photos || this.ctx?.environments?.photos || {};
    const p = (photos[album] || {})[o.photo];
    if (!p) throw new Error(`frame: no photo "${o.photo}" in album "${album}" (run scripts/photos.mjs)`);
    const g = gridAt(o.at), src = `/img/photos/${album}/${o.photo}`;
    const taken = p.taken ? `${MONTHS[+p.taken.slice(5, 7) - 1]} ${p.taken.slice(0, 4)}` : "";
    const medium = o.medium || (p.film ? "35\u00a0mm film" : [p.camera, taken].filter(Boolean).join(", "));
    const meta = [o.place, medium].filter(Boolean).join(" · ");
    return `<figure class="frame ${g.mods}${p.h > p.w ? " tall" : ""}" style="${g.style};--bg:${p.color}">` +
      `<img src="${src}-large.webp" srcset="${src}-small.webp ${p.small}w, ${src}-large.webp ${p.large}w" sizes="(min-width: 760px) ${Math.round((g.span / 12) * 72)}rem, 100vw" width="${p.w}" height="${p.h}" alt="${escHtml(o.alt || "")}" ${o.lead ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">` +
      `<figcaption><span class="cap-title">${escHtml(o.title || "")}</span>${meta ? `<span class="cap-meta">${escHtml(meta)}</span>` : ""}${o.note ? `<em class="cap-note">${escHtml(o.note)}</em>` : ""}</figcaption></figure>`;
  });
  eleventyConfig.addPairedShortcode("aside", function (content, at) {
    const g = gridAt(at);
    return `<div class="aside ${g.mods}" style="${g.style}">${favMd.render(content.trim()).trim()}</div>`;
  });
  eleventyConfig.addPairedShortcode("pull", function (content, at) {
    const g = gridAt(at);
    return `<blockquote class="pull ${g.mods}" style="${g.style}"><p>${favMd.renderInline(content.trim())}</p></blockquote>`;
  });
  // Post topics: `topics: [books, tech]` (a list) or the older single `topic: books`. The first is the main one.
  const topicsOf = (data) => [].concat((typeof data === "string" || Array.isArray(data) ? data : data && (data.topics || data.topic)) || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  eleventyConfig.addFilter("topics", topicsOf);
  eleventyConfig.addFilter("mainTopic", (data) => topicsOf(data)[0] || "");
  eleventyConfig.addFilter("tagSlug", (t) => String(t).replace(/\s+/g, "-"));
  // every topic with its number of posts, A–Z, for the filter row on /blog
  eleventyConfig.addFilter("topicCounts", (posts) => {
    const n = new Map();
    for (const p of posts || []) for (const t of topicsOf(p.data)) n.set(t, (n.get(t) || 0) + 1);
    return [...n].sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
  });
  eleventyConfig.addFilter("commas", (n) => Number(n || 0).toLocaleString("en-US"));
  eleventyConfig.addFilter("fixed", (n, d = 1) => Number(n || 0).toFixed(d));
  eleventyConfig.addFilter("max", (arr) => Math.max(...arr));
  eleventyConfig.addFilter("year", (d) => new Date(d).getUTCFullYear());
  // "3 min read" from the rendered HTML
  eleventyConfig.addFilter("readTime", (html) => {
    const words = String(html || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  });
  // First sentence or two of a post, without sidenotes or markup, for the blog list
  eleventyConfig.addFilter("excerpt", (html, max = 150) => {
    const text = String(html || "").replace(/<span class="sidenote">(?:<span[^>]*>[^<]*<\/span>|[^<])*<\/span>/g, "")
      .replace(/<sup[\s\S]*?<\/sup>/g, "").replace(/<figure[\s\S]*?<\/figure>/g, "")
      .replace(/<[^>]+>/g, " ").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, a, b) => (b || a).replace(/-/g, " "))
      .replace(/&#39;/g, "’").replace(/\s+/g, " ").trim();
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\-–—]$/, "") + "…";
  });

  return {
    dir: { input: "src", includes: "_includes", output: "_site" },
  };
}
