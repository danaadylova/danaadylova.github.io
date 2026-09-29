// "updated Jul 2026", taken from the "as of <Month Year>" line at the top of src/now.md.
import { readFileSync } from "node:fs";
export default function () {
  const m = readFileSync(new URL("../now.md", import.meta.url), "utf8").match(/as of ([A-Z][a-z]+) (\d{4})/);
  return m ? `updated ${m[1].slice(0, 3)} ${m[2]}` : "";
}
