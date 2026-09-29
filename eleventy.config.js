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
