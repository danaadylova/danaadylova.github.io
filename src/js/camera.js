// The line-drawn 35 mm camera at the top of photo posts (three.js r128, loaded just before this file).
// Every few seconds it focuses, stops down, fires, winds on and counts the frame; at 36 it rewinds.
// Visitors can click the camera (the wind lever and rewind knob do their own thing).
// It is drawn in lines: page-colored fills hide what's behind, outlines are screen-space quads, and the
// table is only its shadows, hatched. Colors come from garden.css, so it follows retro and evening mode.
// Markup: <div data-camera-box><div class="cam-stage" data-camera></div></div>; optional, anywhere on the page:
//   <span data-camera-status></span> (shows "frame N of 36") and <button data-camera-shoot> (takes a picture).
(() => {
  const stage = document.querySelector("[data-camera]");
  if (!stage) return;
  const box = stage.closest("[data-camera-box]") || stage, statusEl = document.querySelector("[data-camera-status]");
  if (!window.THREE) { box.remove(); return; }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { box.remove(); return; }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let autoAllowed = !reduce.matches;   // with reduced motion it only shoots when asked

  // colors come from the site's tokens: ink on paper by day, cream on charcoal in retro and evening mode
  const PAL = {};
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const get = (v, fallback) => new THREE.Color(cs.getPropertyValue(v).trim() || fallback);
    const paper = get("--paper", "#fbfaf4"), ink = get("--ink", "#2b211a"), muted = get("--muted", "#7a6b52");
    const night = paper.getHSL({ h: 0, s: 0, l: 0 }).l < 0.5;
    const next = {
      paper, ink, muted,
      dim: paper.clone().lerp(muted, night ? 0.75 : 0.85),
      hatch: paper.clone().lerp(muted, night ? 0.6 : 0.5),
      dark: night ? paper.clone().lerp(new THREE.Color(0), 0.45) : ink.clone(),   // the lens's inside and the windows
      glint: night ? ink.clone() : paper.clone(),                                  // highlights drawn on the dark glass
      yellow: get("--wip-ink", "#8a6d12"), teal: get("--teal", "#0f6e56"), film: get("--terra", "#a9603a"), strap: muted.clone(),
    };
    for (const k in next) { if (PAL[k]) PAL[k].copy(next[k]); else PAL[k] = next[k]; }
  }
  readPalette();
  const css = (role) => "#" + PAL[role].getHexString();

  // ── renderer / scene ───────────────────────────────────────────────
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1.6, 3, 80);
  const LOOK = new THREE.Vector3(-0.55, 1.45, 0.6);

  // a single lamp, used only for the shadows, which the table draws as hatching
  const lamp = new THREE.DirectionalLight(0xffffff, 1);
  lamp.position.set(-7, 12, 9);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  Object.assign(lamp.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 50 });
  lamp.shadow.radius = 2; lamp.shadow.bias = -0.0006;
  scene.add(lamp);

  // ── ink ────────────────────────────────────────────────────────────
  // Lines are quads that face the screen, so they keep the same width at any distance (WebGL's own lines are 1px).
  // Outer contours come from an "inverted hull": the back faces pushed out a fixed number of pixels.
  // Everything else is filled with the page color, so the lines behind it disappear.
  const RES = { value: new THREE.Vector2(1, 1) }, widths = [];
  const LINE_VS = `attribute vec3 other; attribute float side; uniform vec2 res; uniform float width;
    void main() {
      vec4 a = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vec4 b = projectionMatrix * modelViewMatrix * vec4(other, 1.0);
      vec2 d = (a.xy / a.w - b.xy / b.w) * res; float l = length(d);
      d = l > 1e-4 ? d / l : vec2(1.0, 0.0);
      a.xy += (vec2(-d.y, d.x) * side + d) * width / res * a.w;
      gl_Position = a;
    }`;
  const HULL_VS = `attribute vec3 hn; uniform vec2 res; uniform float width;
    void main() {
      vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vec4 q = projectionMatrix * modelViewMatrix * vec4(position + hn * 0.02, 1.0);
      vec2 d = (q.xy / q.w - c.xy / c.w) * res; float l = length(d);
      if (l > 1e-5) c.xy += d / l * width * 2.0 / res * c.w;
      gl_Position = c;
    }`;
  const FLAT_FS = `uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }`;
  const inkMats = {};
  function inkMat(kind, role, w) {
    const k = `${kind}/${role}/${w}`;
    if (!inkMats[k]) {
      const width = { value: w, css: w }; widths.push(width);
      inkMats[k] = new THREE.ShaderMaterial({
        uniforms: { res: RES, width, color: { value: PAL[role] } },
        vertexShader: kind === "hull" ? HULL_VS : LINE_VS, fragmentShader: FLAT_FS,
        side: kind === "hull" ? THREE.BackSide : THREE.DoubleSide,
      });
    }
    return inkMats[k];
  }
  function segGeo(cap) { // room for `cap` segments
    const g = new THREE.BufferGeometry(), idx = [], side = new Float32Array(cap * 4);
    for (let i = 0; i < cap; i++) { const v = i * 4; idx.push(v, v + 1, v + 2, v, v + 2, v + 3); side.set([-1, 1, -1, 1], v); }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(cap * 12), 3));
    g.setAttribute("other", new THREE.BufferAttribute(new Float32Array(cap * 12), 3));
    g.setAttribute("side", new THREE.BufferAttribute(side, 1));
    g.setIndex(idx); g.cap = cap;
    return g;
  }
  function setSegs(g, s) { // s: [x1,y1,z1, x2,y2,z2, ...]
    const n = Math.min(s.length / 6, g.cap), P = g.attributes.position.array, O = g.attributes.other.array;
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
      const a = s[i * 6 + k], b = s[i * 6 + 3 + k], v = i * 12 + k;
      P[v] = P[v + 3] = O[v + 6] = O[v + 9] = a;
      P[v + 6] = P[v + 9] = O[v] = O[v + 3] = b;
    }
    g.setDrawRange(0, n * 6);
    g.attributes.position.needsUpdate = true; g.attributes.other.needsUpdate = true;
    g.computeBoundingSphere();
    return g;
  }
  function inkMesh(parent, geo, color, w) {
    const m = new THREE.Mesh(geo, inkMat("line", color, w)); m.raycast = () => {}; m.userData.ink = true; parent.add(m); return m;
  }
  function lines(parent, segs, color = "ink", w = 1.1) { return inkMesh(parent, setSegs(segGeo(segs.length / 6), segs), color, w); }
  function polyline(pts, closed) { // [Vector3] → segments
    const s = [];
    for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    return s;
  }
  function hullNormals(g) { // smooth normals for the hull, so corners don't split open
    if (g.attributes.hn) return;
    const p = g.attributes.position, n = g.attributes.normal, acc = new Map();
    const key = (i) => `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
    for (let i = 0; i < p.count; i++) { const k = key(i), a = acc.get(k) || [0, 0, 0]; a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); acc.set(k, a); }
    const hn = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; hn[i * 3] = a[0] / l; hn[i * 3 + 1] = a[1] / l; hn[i * 3 + 2] = a[2] / l; }
    g.setAttribute("hn", new THREE.BufferAttribute(hn, 3));
  }
  const edgeCache = new Map();
  function inkAll(root) { // contour + crease lines for every part, in the color of its group
    const list = [];
    root.traverse((m) => { if (m.isMesh && !m.userData.ink && m.userData.o) list.push(m); });
    for (const m of list) {
      const o = m.userData.o;
      if (o.ink === false) continue;
      let color = o.color;
      for (let p = m; color === undefined && p; p = p.parent) color = p.userData.inkColor;
      if (color === undefined) color = "ink";
      if (o.hull !== false) {
        hullNormals(m.geometry);
        const h = new THREE.Mesh(m.geometry, inkMat("hull", color, o.hullW || 1.4)); h.raycast = () => {}; h.userData.ink = true; m.add(h);
      }
      if (o.crease !== false) {
        const k = m.geometry.uuid + "/" + (o.crease || 30);
        if (!edgeCache.has(k)) { const e = new THREE.EdgesGeometry(m.geometry, o.crease || 30).attributes.position.array; edgeCache.set(k, e.length ? setSegs(segGeo(e.length / 6), e) : null); }
        const g = edgeCache.get(k);
        if (g) inkMesh(m, g, color, o.lineW || 1.1);
      }
    }
  }

  // fills in the page color (pushed back a hair so the lines on their surface always win)
  const fills = [];
  function fill(role, double, map) {
    const m = new THREE.MeshBasicMaterial({ color: map ? 0xffffff : PAL[role], map: map || null, side: double ? THREE.DoubleSide : THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
    if (!map) fills.push({ m, role });
    return m;
  }
  const M = { paper: fill("paper"), both: fill("paper", true), dark: fill("dark"), darkBoth: fill("dark", true) };
  function add(parent, geo, mat = M.paper, o = {}) {
    const m = new THREE.Mesh(geo, mat); m.castShadow = o.shadow !== false; m.userData.o = o; parent.add(m); return m;
  }

  // the table: nothing but its shadows, drawn as diagonal hatching
  const HATCH = { spacing: { value: 6 }, lw: { value: 1 } };
  const hatchMat = new THREE.ShadowMaterial({ color: PAL.hatch, opacity: 1 });
  {
    const mat = hatchMat;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.spacing = HATCH.spacing; sh.uniforms.lw = HATCH.lw;
      sh.fragmentShader = "uniform float spacing; uniform float lw;\n" + sh.fragmentShader.replace(
        "gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );",
        `float shade = smoothstep(0.35, 0.65, 1.0 - getShadowMask());
        float d = abs(mod(gl_FragCoord.x - gl_FragCoord.y, spacing) - spacing * 0.5);
        float ink = 1.0 - smoothstep(lw * 0.5 - 0.5, lw * 0.5 + 0.5, d);
        gl_FragColor = vec4(color, opacity * shade * ink);`);
    };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  }

  const texts = [];
  function redraw(t) { // from a clean slate: the draw functions translate, rotate and fade as they go
    const c = t.userData.canvas, g = c.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, c.width, c.height);
    t.userData.draw(g, c.width, c.height); t.needsUpdate = true;
  }
  function canvasTex(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    t.userData = { canvas: c, draw };   // r128 textures have no userData of their own
    texts.push(t);
    return t;
  }
  function roundedRect(w, d, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function slab(w, d, r, y0, h) { // an upright slab with this rounded top-view outline, from y0 to y0 + h
    const g = new THREE.ExtrudeGeometry(roundedRect(w, d, r), { depth: h, bevelEnabled: false, curveSegments: 18 });
    g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    return g;
  }
  function knurl(parent, r, y0, y1, n, color = "ink") { // fine hatching around a dial instead of ridges
    const s = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, x = Math.cos(a) * (r + 0.004), z = Math.sin(a) * (r + 0.004); s.push(x, y0, z, x, y1, z); }
    return lines(parent, s, color, 0.75);
  }

  // ── the camera ─────────────────────────────────────────────────────
  const W = 6, D = 1.6, R = 0.62, FRONT = D / 2;
  const cam = new THREE.Group(); cam.userData.inkColor = "ink"; scene.add(cam);
  add(cam, slab(W, D, R, 0, 0.3));                                // bottom plate
  add(cam, slab(W - 0.06, D - 0.06, R - 0.03, 0.3, 2.2));         // body (the leather)
  add(cam, slab(W, D, R, 2.5, 0.72));                             // top plate
  const TOP = 3.22;

  // front windows on the top plate: viewfinder, the selenium meter's honeycomb, rangefinder
  const honey = canvasTex(256, 96, (g, w, h) => {
    g.fillStyle = css("paper"); g.fillRect(0, 0, w, h);
    g.strokeStyle = css("ink"); g.globalAlpha = 0.7; g.lineWidth = 1.6;
    const r = 11, dx = r * Math.sqrt(3), dy = r * 1.5;
    for (let row = -1; row * dy < h + r; row++) for (let i = -1; i * dx < w + r; i++) {
      const x = i * dx + (row % 2 ? dx / 2 : 0), y = row * dy;
      g.beginPath();
      for (let k = 0; k <= 6; k++) { const t = Math.PI / 6 + (k * Math.PI) / 3; g[k ? "lineTo" : "moveTo"](x + Math.cos(t) * r, y + Math.sin(t) * r); }
      g.stroke();
    }
  });
  function frontWindow(x, w, h, mat) {
    add(cam, new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.04), M.paper, { shadow: false }).position.set(x, 2.86, FRONT + 0.02);
    add(cam, new THREE.PlaneGeometry(w, h), mat, { ink: false, shadow: false }).position.set(x, 2.86, FRONT + 0.042);
  }
  frontWindow(-2.0, 0.74, 0.4, M.dark);
  frontWindow(-0.35, 0.9, 0.32, fill(null, false, honey));
  frontWindow(1.25, 0.42, 0.36, M.dark);

  // accessory shoe
  {
    const shoe = new THREE.Group(); shoe.position.set(-0.35, TOP, 0); cam.add(shoe);
    add(shoe, new THREE.BoxGeometry(0.95, 0.04, 0.72)).position.y = 0.02;
    for (const z of [-0.3, 0.3]) add(shoe, new THREE.BoxGeometry(0.95, 0.12, 0.1)).position.set(0, 0.1, z);
  }
  // shutter speed dial, numbers on top
  const speedTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = css("paper"); g.fillRect(0, 0, w, h);
    g.translate(w / 2, h / 2); g.fillStyle = css("ink"); g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "700 20px 'Space Mono', monospace";
    ["B", "1", "2", "4", "8", "15", "30", "60", "125", "250", "500", "1000"].forEach((s, i, a) => {
      const ang = (i / a.length) * Math.PI * 2; g.save(); g.rotate(ang); g.fillText(s, 0, -94); g.restore();
    });
    g.strokeStyle = css("ink"); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 32, 0, Math.PI * 2); g.stroke();
  });
  {
    const dial = new THREE.Group(); dial.position.set(1.4, TOP, -0.2); cam.add(dial);
    add(dial, new THREE.CylinderGeometry(0.46, 0.46, 0.2, 48)).position.y = 0.1;
    knurl(dial, 0.46, 0.03, 0.17, 40);
    const top = add(dial, new THREE.CircleGeometry(0.44, 48), fill(null, false, speedTex), { ink: false, shadow: false });
    top.rotation.x = -Math.PI / 2; top.position.y = 0.201; top.rotation.z = 0.6;
  }
  // shutter button on its collar, with the wind-on lever around it
  const btn = new THREE.Group(), lever = new THREE.Group();
  {
    const base = new THREE.Group(); base.position.set(2.3, TOP, 0.32); cam.add(base);
    add(base, new THREE.CylinderGeometry(0.21, 0.23, 0.18, 32)).position.y = 0.09;
    base.add(lever); lever.position.y = 0.2;
    add(lever, new THREE.BoxGeometry(1.25, 0.05, 0.13)).position.x = -0.62;   // points left, along the top plate
    add(lever, new THREE.CylinderGeometry(0.2, 0.2, 0.05, 32));
    add(lever, new THREE.BoxGeometry(0.34, 0.09, 0.18), M.dark).position.x = -1.2;
    base.add(btn); btn.position.y = 0.23;
    add(btn, new THREE.CylinderGeometry(0.12, 0.13, 0.12, 24)).position.y = 0.06;
    const cap = add(btn, new THREE.SphereGeometry(0.12, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.paper, { crease: false }); cap.position.y = 0.12; cap.scale.y = 0.35;
    btn.userData.part = "shutter"; lever.userData.part = "lever";
  }
  // frame counter window
  let frame = 12;
  const counterTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = css("paper"); g.fillRect(0, 0, w, h);
    g.fillStyle = css("ink"); g.textAlign = "center"; g.textBaseline = "middle"; g.font = "700 64px 'Space Mono', monospace";
    g.fillText(frame === 0 ? "S" : String(frame), w / 2, h / 2 + 4);
  });
  {
    const win = add(cam, new THREE.CircleGeometry(0.16, 32), fill(null, false, counterTex), { ink: false, shadow: false });
    win.rotation.x = -Math.PI / 2; win.position.set(2.62, TOP + 0.005, -0.42); win.rotation.z = Math.PI;
    const rim2 = add(cam, new THREE.TorusGeometry(0.17, 0.025, 8, 32), M.paper, { crease: false, shadow: false }); rim2.rotation.x = Math.PI / 2; rim2.position.set(2.62, TOP + 0.01, -0.42);
  }
  // rewind knob with a fold-out crank
  const rewind = new THREE.Group(), crank = new THREE.Group();
  {
    rewind.position.set(-2.2, TOP, -0.05); cam.add(rewind);
    add(rewind, new THREE.CylinderGeometry(0.28, 0.3, 0.1, 32)).position.y = 0.05;
    const knob = new THREE.Group(); rewind.add(knob); knob.position.y = 0.1; rewind.userData.knob = knob;
    add(knob, new THREE.CylinderGeometry(0.42, 0.42, 0.28, 48)).position.y = 0.14;
    knurl(knob, 0.42, 0.04, 0.24, 44);
    add(knob, new THREE.CylinderGeometry(0.4, 0.4, 0.02, 48), M.dark).position.y = 0.285;
    knob.add(crank); crank.position.y = 0.3;
    add(crank, new THREE.BoxGeometry(0.06, 0.04, 0.42)).position.z = 0.2;
    add(crank, new THREE.CylinderGeometry(0.06, 0.06, 0.18, 12), M.dark).position.set(0, 0.09, 0.4);
    rewind.userData.part = "rewind";
  }
  // strap lugs at both ends
  for (const s of [-1, 1]) { const lug = add(cam, new THREE.TorusGeometry(0.13, 0.035, 8, 20), M.paper, { crease: false }); lug.position.set(s * (W / 2 + 0.05), 2.35, 0); lug.rotation.y = Math.PI / 2; }
  // small front details: self-timer lever and lens release
  { const st = add(cam, new THREE.BoxGeometry(0.1, 0.42, 0.06)); st.position.set(1.45, 1.95, FRONT + 0.03); st.rotation.z = -0.5;
    const rl = add(cam, new THREE.CylinderGeometry(0.09, 0.09, 0.06, 20)); rl.rotation.x = Math.PI / 2; rl.position.set(0.85, 0.9, FRONT + 0.03); }

  // ── the lens ───────────────────────────────────────────────────────
  const LX = -0.35, LY = 1.42;
  const lens = new THREE.Group(); lens.position.set(LX, LY, FRONT); cam.add(lens);
  const along = (geo) => { geo.rotateX(Math.PI / 2); return geo; };   // cylinders along +z
  add(lens, along(new THREE.CylinderGeometry(1.06, 1.06, 0.14, 64))).position.z = 0.07;   // mount ring
  add(lens, along(new THREE.CylinderGeometry(0.99, 0.99, 0.3, 64))).position.z = 0.29;    // aperture ring
  {
    const s = [];   // its scale: a row of ticks along the top-right, where we can see it
    for (let i = 0; i < 7; i++) { const a = 0.45 + i * 0.13, x = Math.sin(a) * 0.994, y = Math.cos(a) * 0.994; s.push(x, y, 0.2, x, y, i % 2 ? 0.29 : 0.33); }
    lines(lens, s, "ink", 0.75);
  }
  const focus = new THREE.Group(); lens.add(focus); focus.position.z = 0.44;
  add(focus, along(new THREE.CylinderGeometry(1.02, 1.02, 0.34, 64))).position.z = 0.17;
  { const kn = new THREE.Group(); focus.add(kn); kn.position.z = 0.11; kn.rotation.x = Math.PI / 2; knurl(kn, 1.02, -0.08, 0.08, 72); }
  { add(focus, new THREE.BoxGeometry(0.16, 0.36, 0.16)).position.set(0, -1.12, 0.17);
    add(focus, new THREE.SphereGeometry(0.1, 16, 10), M.paper, { crease: false }).position.set(0, -1.3, 0.17); }
  const front = new THREE.Group(); lens.add(front); front.position.z = 0.78;   // slides out a little when focusing
  {
    // a hollow front barrel: outer wall, a lip, and a well where the aperture blades sit
    const pts = [[0.93, -0.02], [0.93, 0.28], [0.9, 0.31], [0.74, 0.31], [0.7, 0.27], [0.7, -0.05]].map(([r, y]) => new THREE.Vector2(r, y));
    add(front, along(new THREE.LatheGeometry(pts, 72)), M.both, { hull: false });
    const name = canvasTex(1024, 1024, (g, w, h) => { // the front ring's engraving
      g.fillStyle = css("paper"); g.fillRect(0, 0, w, h); g.translate(w / 2, h / 2); g.fillStyle = css("ink"); g.font = "700 46px 'Space Mono', monospace"; g.textAlign = "center";
      const text = "1:2.8  f=35mm  ·  no. 0930  ·", n = text.length;
      for (let i = 0; i < n; i++) { g.save(); g.rotate(-Math.PI * 0.85 + i * (Math.PI * 0.95 / n)); g.fillText(text[i], 0, -405); g.restore(); }
    });
    add(front, new THREE.RingGeometry(0.74, 0.9, 72), fill(null, false, name), { ink: false, shadow: false }).position.z = 0.312;
    add(front, new THREE.CircleGeometry(0.71, 48), M.dark, { ink: false, shadow: false }).position.z = 0.006;   // the dark inside
    // the glass itself is left out; two short glints say it's there
    const glint = (r, a0, a1, z) => { const p = []; for (let i = 0; i <= 16; i++) { const a = a0 + (a1 - a0) * (i / 16); p.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z)); } return polyline(p); };
    lines(front, [...glint(0.52, 1.95, 2.6, 0.22), ...glint(0.4, 2.05, 2.35, 0.24)], "glint", 1.3);
  }
  // aperture: eight blades that swing in from the rim. Each blade is a rectangle pivoting on the rim; it is
  // clipped to the opening every time it moves, so the part tucked into the barrel wall never shows.
  const blades = [], WELL = [], NB = 8, MAXV = 72;
  for (let i = 0; i < 64; i++) { const t = (i / 64) * Math.PI * 2; WELL.push([Math.cos(t) * 0.705, Math.sin(t) * 0.705]); }
  const RECT = [[0, 0], [1.0, 0], [1.0, -0.8], [0, -0.8]];
  function clip(subject) { // Sutherland–Hodgman against the (convex, counter-clockwise) well
    let out = subject;
    for (let i = 0; i < WELL.length && out.length; i++) {
      const [ax, ay] = WELL[i], [bx, by] = WELL[(i + 1) % WELL.length], inp = out; out = [];
      const side = (p) => (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax);
      for (let j = 0; j < inp.length; j++) {
        const p = inp[j], q = inp[(j + 1) % inp.length], sp = side(p), sq = side(q);
        if (sp >= 0) out.push(p);
        if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
      }
    }
    return out;
  }
  {
    const fan = []; for (let i = 1; i < MAXV - 1; i++) fan.push(0, i, i + 1);
    for (let i = 0; i < NB; i++) {
      const g = new THREE.BufferGeometry(), pos = new Float32Array(MAXV * 3);
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex(fan);
      const m = add(front, g, M.both, { ink: false, shadow: false }); m.frustumCulled = false;
      const ln = inkMesh(front, segGeo(MAXV), "ink", 0.9); ln.frustumCulled = false;
      blades.push({ g, pos, ln, a: (i / NB) * Math.PI * 2, z: 0.02 + i * 0.004 });
    }
  }
  let K_OPEN = 0.0, K_SHUT = 1.8, lastIris = -1;
  function setIris(k) { // 0 open (blades hidden in the wall), 1 shut
    if (k === lastIris) return; lastIris = k;
    blades.forEach((bl) => {
      const th = bl.a + Math.PI / 2 + K_OPEN + k * (K_SHUT - K_OPEN), c = Math.cos(th), s = Math.sin(th);
      const px = Math.cos(bl.a) * 0.7, py = Math.sin(bl.a) * 0.7;
      const poly = clip(RECT.map(([x, y]) => [px + x * c - y * s, py + x * s + y * c])).slice(0, MAXV);
      for (let v = 0; v < poly.length; v++) { bl.pos[v * 3] = poly[v][0]; bl.pos[v * 3 + 1] = poly[v][1]; bl.pos[v * 3 + 2] = bl.z; }
      bl.g.setDrawRange(0, poly.length >= 3 ? (poly.length - 2) * 3 : 0);
      bl.g.attributes.position.needsUpdate = true;
      setSegs(bl.ln.geometry, poly.length >= 3 ? polyline(poly.map(([x, y]) => new THREE.Vector3(x, y, bl.z + 0.001)), true) : []);
    });
  }
  cam.traverse((o) => { if (o.isMesh && !o.userData.part) for (let p = o.parent; p; p = p.parent) { if (p.userData.part) { o.userData.part = p.userData.part; break; } } });

  // ── film rolls ─────────────────────────────────────────────────────
  // a strip of film along a curve: outline, sprocket holes, and the leader's tongue cut at the far end
  function filmStrip(parent, points, side, width) {
    const curve = new THREE.CatmullRomCurve3(points), N = 160, L = curve.getLength();
    const P = curve.getSpacedPoints(N).map((p) => p.setY(Math.max(p.y, 0.012)));
    const at = (s, t) => { const f = Math.min(N - 1e-6, Math.max(0, (s / L) * N)), i = Math.floor(f); return P[i].clone().lerp(P[i + 1], f - i).addScaledVector(side, t * width); };
    const TL = width * 1.15, SH = width * 0.45, RR = width * 0.16;
    const top = (s) => (s < L - TL ? 0.5 : s > L - TL + SH ? 0.02 : 0.02 + 0.48 * (0.5 + 0.5 * Math.cos(Math.PI * (s - (L - TL)) / SH)));
    const bot = (s) => { const d = s - (L - RR); return d <= 0 ? -0.5 : -0.5 + (RR - Math.sqrt(Math.max(0, RR * RR - d * d))) / width; };
    const pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * L, a = at(s, bot(s)), b = at(s, top(s)); pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      if (i < N) { const v = i * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = add(parent, g, M.both, { ink: false });
    const A = [], B = [];
    for (let i = 0; i <= N; i++) { const s = (i / N) * L; A.push(at(s, bot(s))); B.push(at(s, top(s))); }
    lines(parent, [...polyline(A), ...polyline(B), ...polyline([A[0], B[0]]), ...polyline([A[N], B[N]])], "film", 1.1);
    // sprocket holes at the real pitch (4.75 mm on 35 mm film)
    const k = width / 35, pitch = 4.75 * k, hw = 1.98 * k, hh = 2.79 * k / width, mg = 2.0 * k / width, holes = [];
    const rect = (s0, t0, t1) => { const q = [at(s0, t0), at(s0 + hw / 2, t0), at(s0 + hw, t0), at(s0 + hw, t1), at(s0 + hw / 2, t1), at(s0, t1)]; holes.push(...polyline(q, true)); };
    for (let s = pitch * 0.5; s + hw < L - 0.3; s += pitch) {
      rect(s, -0.5 + mg, -0.5 + mg + hh);
      if (s + hw < L - TL - 0.05) rect(s, 0.5 - mg - hh, 0.5 - mg);
    }
    lines(parent, holes, "film", 0.7);
    return m;
  }
  // the canister's print, as line work: two bands, an outlined speed and a line of small type, centered at `cx`
  // (where the label faces us); on a canister lying down the type runs along its length so it reads level
  function label(color, iso, cx, lengthwise) {
    return canvasTex(1024, 512, (g, w, h) => {
      g.fillStyle = css("paper"); g.fillRect(0, 0, w, h);
      g.strokeStyle = g.fillStyle = css(color);
      g.lineWidth = 3; for (const y of [0.11, 0.89]) { g.beginPath(); g.moveTo(0, h * y); g.lineTo(w, h * y); g.stroke(); }
      g.textAlign = "center"; g.textBaseline = "alphabetic";
      for (const x of [cx, cx - w, cx + w]) {
        g.save(); g.translate(x, h / 2);
        if (lengthwise) g.rotate(-Math.PI / 2);
        g.lineWidth = 4; g.font = `700 ${lengthwise ? 150 : 170}px 'Space Mono', monospace`; g.strokeText(iso, 0, lengthwise ? 40 : 30);
        g.font = "700 26px 'Space Mono', monospace"; g.fillText(`135 · 36 exp`, 0, lengthwise ? 92 : 100);
        g.restore();
      }
    });
  }
  function canister(color, iso, cx, lengthwise) { // origin at the bottom, axis up
    const c = new THREE.Group(); c.userData.inkColor = color;
    for (const y of [0.05, 1.85]) add(c, new THREE.CylinderGeometry(0.585, 0.585, 0.1, 48)).position.y = y;
    add(c, new THREE.CylinderGeometry(0.55, 0.55, 1.7, 64), fill(null, false, label(color, iso, cx, lengthwise))).position.y = 0.95;
    const spool = new THREE.Group(); spool.position.y = 1.9; c.add(spool);
    add(spool, new THREE.CylinderGeometry(0.2, 0.2, 0.24, 24)).position.y = 0.12;
    knurl(spool, 0.2, 0.05, 0.2, 16, color);
    const hole = add(spool, new THREE.CircleGeometry(0.08, 16), M.dark, { ink: false }); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.241;
    add(c, new THREE.BoxGeometry(0.14, 1.55, 0.06), M.dark).position.set(0, 0.95, 0.56);   // the felt light trap
    return c;
  }
  // lying in front, to the left, with a length of film spilling across the table
  const rollB = canister("teal", "200", 930, true);
  {
    const yaw = 0.42, axis = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const base = new THREE.Vector3(-4.7, 0.585, 2.0);              // the bottom cap's center
    rollB.position.copy(base); rollB.rotation.set(0, yaw, -Math.PI / 2); scene.add(rollB);
    const mid = base.clone().addScaledVector(axis, 0.95);
    const at = (f, y) => mid.clone().addScaledVector(fwd, f).setY(y);
    filmStrip(scene, [at(0.6, 0.585), at(0.8, 0.52), at(0.98, 0.25), at(1.2, 0.03), at(1.8, 0.012), at(2.6, 0.02), at(3.1, 0.15), at(3.2, 0.42), at(2.95, 0.5)], axis, 1.42);
  }
  // standing right behind it, its leader curling out of the slot
  const rollA = canister("yellow", "400", 541);
  rollA.position.set(-5.15, 0, 0.25); rollA.rotation.y = -2.55; scene.add(rollA);
  filmStrip(rollA, [[0, 0.95, 0.58], [0.4, 0.95, 0.66], [0.85, 0.95, 0.58], [1.08, 0.95, 0.28], [1.02, 0.95, 0.02]].map((p) => new THREE.Vector3(...p)), new THREE.Vector3(0, 1, 0), 1.42);

  // a leather strap from the lugs, looping down onto the table behind the camera: two edges and a row of stitches
  {
    const P = [[3.08, 2.35, 0], [3.35, 2.1, -0.15], [3.6, 1.2, -0.5], [3.78, 0.28, -1.0], [3.95, 0.035, -1.6], [3.45, 0.035, -2.45], [1.5, 0.035, -2.85],
      [-1.5, 0.035, -2.85], [-3.45, 0.035, -2.45], [-3.9, 0.04, -1.6], [-3.62, 0.3, -1.0], [-3.48, 1.2, -0.5], [-3.3, 2.1, -0.15], [-3.08, 2.35, 0]].map((p) => new THREE.Vector3(...p));
    const curve = new THREE.CatmullRomCurve3(P), N = 200, pts = curve.getSpacedPoints(N), up = new THREE.Vector3(0, 1, 0), w = 0.42;
    let sd = new THREE.Vector3(1, 0, 0);
    const sides = pts.map((p, i) => { const c = new THREE.Vector3().crossVectors(curve.getTangentAt(i / N), up); if (c.length() > 0.2) sd = c.normalize(); return sd.clone(); });
    const edge = (t) => pts.map((p, i) => p.clone().addScaledVector(sides[i], t));
    const pos = [], idx = [], A = edge(-w / 2), B = edge(w / 2);
    for (let i = 0; i <= N; i++) { pos.push(A[i].x, A[i].y, A[i].z, B[i].x, B[i].y, B[i].z); if (i < N) { const v = i * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    add(scene, g, M.both, { ink: false });
    lines(scene, [...polyline(A), ...polyline(B)], "strap", 1.1);
    const st = [];
    for (const t of [-w / 2 + 0.07, w / 2 - 0.07]) { const E = edge(t); for (let i = 1; i < N; i += 2) st.push(...polyline([E[i], E[i + 1]])); }
    lines(scene, st, "strap", 0.6);
  }

  inkAll(scene);

  // ── what the camera does ───────────────────────────────────────────
  const S = { focus: 0, ext: 0, btn: 0, iris: 0, lever: 0, spin: 0, crank: 0, shake: 0 };
  const tweens = [];
  let clock = 0, busyUntil = 0, autoNext = 2.2, rewinding = false;
  const ease = { inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2), out: (u) => 1 - Math.pow(1 - u, 3), in: (u) => u * u * u, lin: (u) => u };
  function tween(key, to, delay, dur, ez = ease.inOut, onDone) { tweens.push({ key, to, start: clock + delay, dur, ez, from: null, onDone }); }
  function at(delay, fn) { tweens.push({ start: clock + delay, dur: 0, fn }); }
  function setStatus(s) { if (statusEl) statusEl.textContent = s; }
  function redrawCounter() { redraw(counterTex); }

  function shoot() {
    if (clock < busyUntil || rewinding) return false;
    if (frame >= 36) { rewindFilm(); return true; }
    busyUntil = clock + 1.9;
    tween("focus", (Math.random() - 0.5) * 0.9, 0, 0.55); tween("ext", 0.04 + Math.random() * 0.05, 0, 0.55);   // focus
    tween("iris", 0.3 + Math.random() * 0.25, 0.1, 0.4);                                                         // stop down
    tween("btn", 1, 0.7, 0.07, ease.out); tween("btn", 0, 0.86, 0.12, ease.out);                                 // press
    at(0.76, () => { snd.shutter(); });
    tween("iris", 1, 0.76, 0.045, ease.in); tween("iris", 0.45, 0.83, 0.09, ease.out); tween("iris", 0, 1.3, 0.4);   // the blink, then open up
    tween("shake", 1, 0.76, 0.03, ease.lin); tween("shake", 0, 0.8, 0.25, ease.out);
    at(1.0, () => { snd.wind(); });
    tween("lever", 1, 1.0, 0.32, ease.out); tween("lever", 0, 1.38, 0.28, ease.inOut);                            // wind on
    tween("spin", S.spin + 1.1, 1.0, 0.4, ease.out);
    at(1.16, () => { frame++; redrawCounter(); setStatus(frame >= 36 ? "frame 36 of 36 · end of the roll" : `frame ${frame} of 36`); });
    tween("focus", 0, 1.5, 0.5); tween("ext", 0, 1.5, 0.5);
    return true;
  }
  function advance() {
    if (clock < busyUntil || rewinding) return;
    busyUntil = clock + 0.7;
    snd.wind();
    tween("lever", 1, 0, 0.32, ease.out); tween("lever", 0, 0.38, 0.28, ease.inOut);
    tween("spin", S.spin + 1.1, 0, 0.4, ease.out);
  }
  function rewindFilm() {
    if (rewinding || clock < busyUntil) return;
    rewinding = true; setStatus("rewinding…");
    tween("crank", 1, 0, 0.35, ease.out);
    tween("spin", S.spin + Math.PI * 2 * 7, 0.4, 2.4, ease.inOut);
    at(0.4, () => snd.rewind());
    at(1.6, () => { frame = 0; redrawCounter(); });
    tween("crank", 0, 2.95, 0.3, ease.inOut);
    at(3.4, () => { setStatus("new roll loaded · frame 1 of 36"); frame = 1; redrawCounter(); rewinding = false; busyUntil = clock + 0.4; });
  }

  // ── sound: only when the site's "typing sounds" switch is on ─────────
  const audio = () => (window.gardenSound && window.gardenSound.on() ? window.gardenSound.ctx() : null);
  let ac = null;
  function burst(t, dur, freq, q, gain) {
    const buf = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * dur)), ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain();
    s.buffer = buf; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q; gn.gain.value = gain;
    s.connect(f); f.connect(gn); gn.connect(ac.destination); s.start(t);
  }
  const soundOn = () => !!(ac = audio());
  const snd = {
    shutter() { if (!soundOn()) return; const t = ac.currentTime; burst(t, 0.02, 3800, 1.2, 0.55); burst(t + 0.05, 0.03, 2600, 1, 0.5); },
    wind() { if (!soundOn()) return; const t = ac.currentTime; for (let i = 0; i < 6; i++) burst(t + i * 0.045, 0.012, 4200, 2, 0.15); burst(t + 0.62, 0.02, 1800, 1, 0.3); },
    rewind() { if (!soundOn()) return; const t = ac.currentTime; for (let i = 0; i < 46; i++) burst(t + i * 0.05 + Math.random() * 0.01, 0.01, 3000 + Math.random() * 600, 2, 0.09); },
  };

  // ── simulation ─────────────────────────────────────────────────────
  function step(dt) {
    clock += dt;
    if (autoAllowed && clock >= autoNext && clock >= busyUntil && !rewinding) { shoot(); autoNext = clock + 3.4 + Math.random() * 2.4; }
    for (let i = tweens.length - 1; i >= 0; i--) {
      const t = tweens[i];
      if (clock < t.start) continue;
      if (t.fn) { tweens.splice(i, 1); t.fn(); continue; }
      if (t.from === null) t.from = S[t.key];
      const u = t.dur ? Math.min(1, (clock - t.start) / t.dur) : 1;
      S[t.key] = t.from + (t.to - t.from) * t.ez(u);
      if (u >= 1) tweens.splice(i, 1);
    }
    focus.rotation.z = S.focus;
    front.position.z = 0.78 + S.ext;
    btn.position.y = 0.23 - S.btn * 0.06;
    setIris(S.iris);
    lever.rotation.y = -S.lever * 2.0;
    rewind.userData.knob.rotation.y = S.spin;
    crank.rotation.x = -S.crank * 1.25;
    cam.rotation.z = S.shake * 0.004; cam.position.y = -S.shake * 0.01;
    return tweens.length > 0;
  }

  // ── size / loop ───────────────────────────────────────────────────
  const DEG = Math.PI / 180, buf = new THREE.Vector2();
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.getDrawingBufferSize(buf); RES.value.copy(buf);   // line widths are in device pixels
    const pr = renderer.getPixelRatio();
    widths.forEach((u) => { u.value = u.css * pr; });
    HATCH.spacing.value = 6 * pr; HATCH.lw.value = Math.max(1, pr);
    camera.aspect = w / h;
    const hfov = 2 * Math.atan(Math.tan(12.5 * DEG) * 1.6 * (camera.aspect < 1.4 ? 0.86 : 1));
    camera.fov = Math.min(50, 2 * Math.atan(Math.tan(hfov / 2) / camera.aspect) / DEG);
    camera.position.set(8.2, 7.0, 14.0);
    camera.lookAt(LOOK);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  let running = false, last = 0, visible = true;
  function frameLoop(now) {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
    last = now;
    for (let left = dt; left > 0; left -= 1 / 120) step(Math.min(left, 1 / 120));
    renderer.render(scene, camera);
    requestAnimationFrame(frameLoop);
  }
  function update() {
    const go = visible && !document.hidden;
    if (go && !running) { running = true; last = performance.now(); requestAnimationFrame(frameLoop); }
    if (!go) running = false;
  }
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); }).observe(stage);
  document.addEventListener("visibilitychange", update);

  // ── visitors ───────────────────────────────────────────────────────
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), canvas = renderer.domElement;
  function partAt(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(cam, true).find((h) => h.object.isMesh);
    return hit ? hit.object.userData.part || "body" : null;
  }
  canvas.addEventListener("pointerdown", (ev) => {
    const p = partAt(ev);
    if (!p) return;
    autoNext = clock + 6;   // let them play before it shoots on its own again
    if (p === "lever") advance(); else if (p === "rewind") rewindFilm(); else shoot();
  });
  let hoverPending = false;
  canvas.addEventListener("pointermove", (ev) => {
    if (ev.pointerType !== "mouse" || hoverPending) return;
    hoverPending = true;
    requestAnimationFrame(() => { hoverPending = false; canvas.style.cursor = partAt(ev) ? "pointer" : ""; });
  });
  const shootBtn = document.querySelector("[data-camera-shoot]");
  if (shootBtn) shootBtn.addEventListener("click", () => { autoNext = clock + 6; shoot(); });
  reduce.addEventListener && reduce.addEventListener("change", () => { autoAllowed = !reduce.matches; });

  // retro mode and evening mode swap the palette; everything is recolored in place
  function recolor() {
    readPalette();
    fills.forEach(({ m, role }) => m.color.copy(PAL[role]));
    hatchMat.color.copy(PAL.hatch);
    texts.forEach(redraw);
    renderer.render(scene, camera);
  }
  document.addEventListener("garden:retro", () => requestAnimationFrame(recolor));
  const evening = matchMedia("(prefers-color-scheme: dark)");
  evening.addEventListener && evening.addEventListener("change", recolor);
  if (document.fonts && document.fonts.load) document.fonts.load("700 22px 'Space Mono'").then(recolor, () => {});

  setIris(0);
  resize();
  update();
  // test hooks, like window.gardenKeyboard
  window.gardenCamera = {
    step: (n) => { for (let i = 0; i < n; i++) step(1 / 60); renderer.render(scene, camera); },
    stop: () => { running = false; autoAllowed = false; },
    shoot, rewind: rewindFilm, frame: () => frame, state: () => ({ ...S }), recolor,
    screenPos: (o) => { const v = new THREE.Vector3(); ({ shutter: btn, lever, rewind })[o].getWorldPosition(v); v.project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
  };
})();
