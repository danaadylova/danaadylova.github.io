// Prepares a folder of photos for a photo post.
//
//   node scripts/photos.mjs <album> <folder of originals>
//
// For every JPEG in the folder it writes src/img/photos/<album>/<name>-{large,small}.webp (1600 and 800 wide,
// never upscaled), and records each photo in src/_data/photos.json: its size, a background color to show
// while it loads, and, for digital photos, the camera, lens and date from its EXIF. Film scans get
// `film: true` (their EXIF only names the lab's scanner).
//
// The published copies carry no metadata at all (sharp drops EXIF unless asked to keep it), so nothing
// like GPS ever leaves the originals, which stay out of the repo.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [album, src] = process.argv.slice(2);
if (!album || !src) {
  console.error("usage: node scripts/photos.mjs <album> <folder of originals>");
  process.exit(1);
}
const OUT = path.join("src/img/photos", album);
const DATA = "src/_data/photos.json";
const WIDTHS = { large: 1600, small: 800 };
fs.mkdirSync(OUT, { recursive: true });

// The few EXIF fields we use, read straight from the APP1 segment (sharp only hands back the raw block).
function exifFields(buf) {
  if (!buf || buf.toString("ascii", 0, 4) !== "Exif") return {};
  const t = buf.subarray(6), le = t.toString("ascii", 0, 2) === "II";
  const u16 = (o) => (le ? t.readUInt16LE(o) : t.readUInt16BE(o));
  const u32 = (o) => (le ? t.readUInt32LE(o) : t.readUInt32BE(o));
  const out = {};
  const NAMES = { 0x010f: "make", 0x0110: "model", 0x9003: "taken", 0xa434: "lens", 0x8769: "exif" };
  const readIfd = (off) => {
    const n = u16(off);
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12, tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      const name = NAMES[tag];
      if (!name) continue;
      if (name === "exif") { readIfd(u32(e + 8)); continue; }
      if (type !== 2) continue;
      const at = count > 4 ? u32(e + 8) : e + 8;
      out[name] = t.toString("ascii", at, at + count).replace(/\0.*$/s, "").trim();
    }
  };
  readIfd(u32(4));
  return out;
}

const data = fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA, "utf8")) : {};
data[album] = data[album] || {};
const files = fs.readdirSync(src).filter((f) => /\.jpe?g$/i.test(f)).sort();
for (const f of files) {
  const name = f.replace(/\.jpe?g$/i, "");
  const img = sharp(path.join(src, f)).rotate();   // honor the EXIF orientation, then forget it
  const meta = await img.metadata();
  const portrait = (meta.orientation || 1) >= 5;
  const w = portrait ? meta.height : meta.width, h = portrait ? meta.width : meta.height;
  const ex = exifFields(meta.exif);
  const entry = { w, h };
  for (const [key, max] of Object.entries(WIDTHS)) {
    const width = Math.min(w, max);
    const base = path.join(OUT, `${name}-${key}`);
    await img.clone().resize({ width }).webp({ quality: 80 }).toFile(`${base}.webp`);
    entry[key] = width;
  }
  const { channels } = await img.clone().resize(64).stats();   // the photo's average color
  entry.color = "#" + channels.slice(0, 3).map((c) => Math.round(c.mean).toString(16).padStart(2, "0")).join("");
  if (/fujifilm|sony|canon|nikon|ricoh|leica|olympus|panasonic|apple/i.test(ex.make || "")) {
    entry.camera = [ex.make && ex.make.charAt(0) + ex.make.slice(1).toLowerCase(), ex.model].filter(Boolean).join(" ").replace(/^Fujifilm/, "Fujifilm");
    if (ex.lens) entry.lens = ex.lens.replace(/^XF(\d+)mm.*$/, "$1 mm");
    if (ex.taken) entry.taken = ex.taken.slice(0, 10).replace(/:/g, "-");
  } else {
    entry.film = true;
  }
  data[album][name] = entry;
  console.log(name, entry);
}
fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + "\n");
