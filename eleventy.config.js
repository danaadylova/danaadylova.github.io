import { feedPlugin } from "@11ty/eleventy-plugin-rss";

const slugMap = new Map();
const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/css": "css", "src/js": "js", "src/img": "img", CNAME: "CNAME" });

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

  eleventyConfig.addFilter("gdate", (d) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
  );

  return {
    dir: { input: "src", includes: "_includes", output: "_site" },
  };
}
