// A per-build version string, appended to CSS/JS URLs (?v=…) so browsers pick up
// new styles right after a deploy instead of using a cached copy.
export default { v: Date.now().toString(36) };
