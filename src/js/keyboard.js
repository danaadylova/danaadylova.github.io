// The little 3D keyboard on the home page (three.js r128, loaded just before this file).
// It types the `~/dana $ ls -l` prompt together with garden.js: garden.js waits for "kb:ready",
// then sends one "garden:key" event per character. Visitors can press keys by clicking them,
// or by typing on their own keyboard while it's on screen.
// Markup: <div class="kb" data-kb data-colors="<a colorway below>" aria-hidden="true"></div>
(function () {
  var stage = document.querySelector("[data-kb]");
  if (!stage) return;
  function skip() {
    stage.remove();
    document.dispatchEvent(new CustomEvent("kb:skip"));
  }
  if (!window.THREE) return skip();
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    return skip();
  }

  var dark = matchMedia("screen and (prefers-color-scheme: dark)");
  var reduce = matchMedia("(prefers-reduced-motion: reduce)");

  // ── renderer / scene ───────────────────────────────────────────────
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(21, 2.2, 0.1, 200);
  var LOOK = new THREE.Vector3(0.8, 0.15, 0.1);

  var hemi = new THREE.HemisphereLight(0xfff8ee, 0xbcae9a, 0.55);
  var sun = new THREE.DirectionalLight(0xfff0dc, 1.6);
  sun.position.set(-11, 12, 13);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 11, bottom: -11, near: 1, far: 60 });
  sun.shadow.radius = 9;
  sun.shadow.bias = -0.0004;
  var fill = new THREE.DirectionalLight(0xffe9d2, 0.35);
  fill.position.set(12, 6, -6);
  scene.add(hemi, sun, fill);

  function std(r) { return new THREE.MeshStandardMaterial({ roughness: r }); }
  var M = {
    cap: std(0.7), mod: std(0.7), accent: std(0.7), kase: std(0.6), plate: std(0.75), sw: std(0.65),
    stem: std(0.5), cable: std(0.6), yarn: std(0.9),
    edge: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.45 }),
    caseEdge: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.45 }),
  };
  var edgeCache = {};
  // hairline outlines, like a technical drawing: they keep the cream keys from merging into one surface
  function outline(mesh, id, mat) {
    var g = edgeCache[id] || (edgeCache[id] = new THREE.EdgesGeometry(mesh.geometry, 28));
    mesh.add(new THREE.LineSegments(g, mat || M.edge));
  }
  var ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.17 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  // Colorways (sRGB hex). Each one names its day colors; evening is derived from them
  // (the same colors, muted and darker) unless it spells out its own.
  //   cap: letter keys · mod: edge keys · accent: enter and the yarn-ball escape · kase: the case
  var COLORWAYS = {
    cream: {
      day: { cap: 0xf6efe3, mod: 0xd9cbb6, accent: 0xd9cbb6, kase: 0xe9dcc6, cable: 0xf1e8da, yarn: 0xcfb99a },
      eve: { cap: 0x8d8579, mod: 0x6f665a, accent: 0x6f665a, kase: 0x6a6153, cable: 0x7d7468, yarn: 0xa08a6c },
    },
    moss: { day: { cap: 0xefe6cc, mod: 0xa6b077, accent: 0xecc762, kase: 0x68774a, cable: 0x68774a, yarn: 0xecc762 } },
    "butter-sage": { day: { cap: 0xf6eed3, mod: 0xa9ba84, accent: 0x7f9763, kase: 0xefd272, cable: 0xa9ba84, yarn: 0x7f9763 } },
    matcha: { day: { cap: 0xefe9d6, mod: 0x97aa74, accent: 0xc0693f, kase: 0xb9c78e, cable: 0x97aa74, yarn: 0xc0693f } },
    "forest-honey": { day: { cap: 0xefe6cf, mod: 0xdcae52, accent: 0xdcae52, kase: 0x33503b, cable: 0x33503b, yarn: 0xdcae52 } },
    pistachio: { day: { cap: 0xf4dd88, mod: 0xa3bb78, accent: 0xec9270, kase: 0xcfdca6, cable: 0xa3bb78, yarn: 0xec9270 } },
    terracotta: { day: { cap: 0xf1e7d0, mod: 0xe2c6a0, accent: 0x6f7d4d, kase: 0x96553a, cable: 0x96553a, yarn: 0x6f7d4d } },
    green: { day: { cap: 0xf2ecdb, mod: 0xb4d0aa, accent: 0xefc55c, kase: 0x336a4a, cable: 0x336a4a, yarn: 0xefc55c } },
    olive: { day: { cap: 0xf0e8cf, mod: 0xc9c28a, accent: 0xc0693f, kase: 0x5f5e34, cable: 0x5f5e34, yarn: 0xc0693f } },
    coffee: { day: { cap: 0xf2e6d0, mod: 0xc9a47c, accent: 0x4a3326, kase: 0x6f4e37, cable: 0x6f4e37, yarn: 0xc9a47c } },
    // olive + butter yellow, three ways
    "olive-butter-mods": { day: { cap: 0xf3ecd6, mod: 0xefd173, accent: 0x9e9a55, kase: 0x5f5e34, cable: 0xefd173, yarn: 0x9e9a55 } },
    "olive-butter-caps": { day: { cap: 0xf5df8e, mod: 0xf3ecd6, accent: 0x8f8c4c, kase: 0x5f5e34, cable: 0x5f5e34, yarn: 0xf3ecd6 } },
    "butter-olive-case": { day: { cap: 0xf3ecd6, mod: 0x8a8847, accent: 0x5f5e34, kase: 0xefd173, cable: 0x8a8847, yarn: 0x5f5e34 } },
    walnut: { grain: true, day: { cap: 0xf1e6cf, mod: 0xdcbd90, accent: 0x6f7d4d, kase: 0x8a5a36, cable: 0xdcbd90, yarn: 0x6f7d4d } },
  };
  var grain = (function () { // soft walnut grain, multiplied over the case color
    var c = document.createElement("canvas"), g = c.getContext("2d");
    c.width = 1024; c.height = 256;
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    for (var i = 0; i < 70; i++) {
      var y0 = Math.random() * c.height, amp = 2 + Math.random() * 7, f = 0.004 + Math.random() * 0.01, ph = Math.random() * 6;
      g.strokeStyle = "rgba(60,30,10," + (0.06 + Math.random() * 0.16) + ")";
      g.lineWidth = 0.6 + Math.random() * 2.2;
      g.beginPath();
      for (var x = 0; x <= c.width; x += 8) {
        var y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph) * amp * 0.3;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(0.07, 0.35); // extrude UVs are in board units
    t.encoding = THREE.sRGBEncoding;
    return t;
  })();
  var colorway = COLORWAYS[stage.dataset.colors] ? stage.dataset.colors : "cream";
  var tmp = new THREE.Color(), hsl = {};
  function shade(hex, l, s) { // scale lightness (and saturation) of an sRGB hex
    tmp.setHex(hex).getHSL(hsl);
    return tmp.setHSL(hsl.h, Math.min(1, hsl.s * (s || 1)), Math.min(1, hsl.l * l)).getHex();
  }
  function palette(name, eve) {
    var cw = COLORWAYS[name], day = cw.day, p = {};
    var base = eve ? (cw.eve || {}) : day;
    ["cap", "mod", "accent", "kase", "cable", "yarn"].forEach(function (k) {
      p[k] = base[k] !== undefined ? base[k] : shade(day[k], 0.55, 0.45); // the warm glow adds color back
    });
    p.plate = shade(day.kase, eve ? 0.2 : 0.62, 0.8);   // under the keys: the case color in shadow
    p.sw = shade(day.kase, eve ? 0.28 : 0.45, 0.6);
    p.stem = shade(day.mod, eve ? 0.6 : 0.95);
    p.caseEdge = eve ? 0x0e0906 : shade(day.kase, 0.72);
    return p;
  }

  // ── geometry helpers ───────────────────────────────────────────────
  function roundedRect(w, d, r) {
    var s = new THREE.Shape(), x = -w / 2, y = -d / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  // an extruded rounded shape standing up along +y
  function slab(shape, h, bevel) {
    var g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: !!bevel, bevelThickness: bevel || 0, bevelSize: bevel || 0, bevelSegments: 3, curveSegments: 8 });
    g.rotateX(-Math.PI / 2);
    return g;
  }

  var U = 1, GAP = 0.1, CAP_H = 0.5, TAPER = 0.13;
  var capCache = {};
  // tapered keycap: rounded base, narrower top, beveled edges (a simple OEM-ish profile)
  function capGeometry(wu) {
    if (capCache[wu]) return capCache[wu];
    var w = wu * U - GAP, d = U - GAP;
    var g = slab(roundedRect(w - 0.14, d - 0.14, 0.2), CAP_H - 0.14, 0.07);
    var p = g.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var y = p.getY(i), t = Math.max(0, Math.min(1, y / CAP_H)), x = p.getX(i), z = p.getZ(i);
      p.setX(i, x - Math.sign(x) * Math.min(Math.abs(x), t * TAPER));
      p.setZ(i, z - Math.sign(z) * Math.min(Math.abs(z), t * TAPER * 1.1) - t * 0.03); // leans back a touch
    }
    g.computeVertexNormals();
    return (capCache[wu] = g);
  }

  // ── layout: 60% ANSI ───────────────────────────────────────────────
  // [width, label]: labels only name the keys, the caps are blank
  var ROWS = [
    [[1, "`"], [1, "1"], [1, "2"], [1, "3"], [1, "4"], [1, "5"], [1, "6"], [1, "7"], [1, "8"], [1, "9"], [1, "0"], [1, "-"], [1, "="], [2, "bksp"]],
    [[1.5, "tab"], [1, "q"], [1, "w"], [1, "e"], [1, "r"], [1, "t"], [1, "y"], [1, "u"], [1, "i"], [1, "o"], [1, "p"], [1, "["], [1, "]"], [1.5, "\\"]],
    [[1.75, "caps"], [1, "a"], [1, "s"], [1, "d"], [1, "f"], [1, "g"], [1, "h"], [1, "j"], [1, "k"], [1, "l"], [1, ";"], [1, "'"], [2.25, "enter"]],
    [[2.25, "lshift"], [1, "z"], [1, "x"], [1, "c"], [1, "v"], [1, "b"], [1, "n"], [1, "m"], [1, ","], [1, "."], [1, "/"], [2.75, "rshift"]],
    [[1.25, "lctrl"], [1.25, "lwin"], [1.25, "lalt"], [6.25, " "], [1.25, "ralt"], [1.25, "fn"], [1.25, "menu"], [1.25, "rctrl"]],
  ];
  var MODS = { "`": 1, bksp: 1, tab: 1, "\\": 1, caps: 1, enter: 1, lshift: 1, rshift: 1, lctrl: 1, lwin: 1, lalt: 1, ralt: 1, fn: 1, menu: 1, rctrl: 1 };
  var W = 15 * U, D = 5 * U, BORDER = 0.55, PLATE_Y = 0.62, SW_H = 0.34, STEM = 0.16;

  var board = new THREE.Group();
  board.rotation.x = 0.07; // typing angle: the front sits lower
  board.position.y = 0.2;
  scene.add(board);

  // case: a tray with rounded corners, walls up to just under the keycaps
  var outer = roundedRect(W + BORDER * 2, D + BORDER * 2, 0.75);
  outer.holes.push(roundedRect(W + 0.06, D + 0.06, 0.3));
  var walls = new THREE.Mesh(slab(outer, 0.9, 0.14), M.kase);
  var bottom = new THREE.Mesh(slab(roundedRect(W + BORDER * 2, D + BORDER * 2, 0.75), 0.5, 0.14), M.kase);
  var plate = new THREE.Mesh(new THREE.BoxGeometry(W + 0.05, 0.05, D + 0.05), M.plate);
  plate.position.y = PLATE_Y;
  [walls, bottom, plate].forEach(function (m) { m.castShadow = m.receiveShadow = true; board.add(m); });
  outline(walls, "walls", M.caseEdge);
  outline(bottom, "bottom", M.caseEdge);

  var swGeo = new THREE.BoxGeometry(0.58, SW_H, 0.58);
  var stemGeo = new THREE.BoxGeometry(0.16, STEM + 0.1, 0.16);
  var keys = {}, all = [], caps = [];
  ROWS.forEach(function (row, r) {
    var x = -W / 2, z = -D / 2 + (r + 0.5) * U;
    var sculpt = [0.1, 0.05, 0, -0.04, -0.08][r]; // row tilt, like a sculpted profile
    row.forEach(function (kd) {
      var wu = kd[0], label = kd[1], cx = x + (wu * U) / 2;
      var kind = label === "enter" || label === "`" ? "accent" : MODS[label] ? "mod" : "cap";
      var sw = new THREE.Mesh(swGeo, M.sw);
      sw.position.set(cx, PLATE_Y + SW_H / 2, z);
      sw.castShadow = sw.receiveShadow = true;
      var stem = new THREE.Mesh(stemGeo, M.stem);
      stem.position.set(cx, PLATE_Y + SW_H + STEM / 2, z);
      var mat = M[kind].clone(); // its own material, so a pressed key can glow on its own
      var cap = new THREE.Mesh(capGeometry(wu), mat);
      var restY = PLATE_Y + SW_H + STEM;
      cap.position.set(cx, restY, z);
      cap.rotation.x = sculpt;
      cap.castShadow = cap.receiveShadow = true;
      outline(cap, "cap" + wu);
      board.add(sw, stem, cap);
      var k = { label: label, kind: kind, cap: cap, mat: mat, restY: restY, press: 0, target: 0, v: 0, releaseAt: 0 };
      cap.userData.key = k;
      keys[label] = k; all.push(k); caps.push(cap);
      x += wu * U;
    });
  });

  // ── evening glow: warm light from under the keys ───────────────────
  var GLOW = 0xffa760, glowOn = false;
  var underLights = [-5.5, -1.8, 1.8, 5.5].map(function (x) {
    var l = new THREE.PointLight(GLOW, 0, 5.5, 2);
    l.position.set(x, PLATE_Y + 0.25, 0);
    board.add(l);
    return l;
  });
  var halo = (function () {
    var c = document.createElement("canvas");
    c.width = c.height = 256;
    var g = c.getContext("2d"), grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grd.addColorStop(0, "rgba(255,167,96,0.42)"); grd.addColorStop(0.5, "rgba(255,150,80,0.12)"); grd.addColorStop(1, "rgba(255,150,80,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.35, D * 2.6),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.01; m.visible = false;
    scene.add(m);
    return m;
  })();

  // coiled cable curling off the back
  (function () {
    var x0 = -W / 2 + 2.2, zBack = -D / 2 - BORDER, pts = [];
    pts.push(new THREE.Vector3(x0, 0.45, zBack + 0.1), new THREE.Vector3(x0, 0.45, zBack - 0.5));
    for (var t = 0; t <= 1; t += 0.01) {
      var a = t * Math.PI * 2 * 7;
      pts.push(new THREE.Vector3(x0 + Math.sin(a) * 0.28, 0.45 + Math.cos(a) * 0.28, zBack - 0.8 - t * 2.4));
    }
    pts.push(new THREE.Vector3(x0 - 0.3, 0.2, zBack - 3.8), new THREE.Vector3(x0 - 1.6, 0.08, zBack - 4.6), new THREE.Vector3(x0 - 4, 0.08, zBack - 5));
    var cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.075, 8, false), M.cable);
    cable.castShadow = true;
    board.add(cable);
  })();

  // one artisan keycap: a tiny ball of yarn on escape
  (function () {
    var ball = new THREE.Group();
    ball.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), M.yarn));
    for (var i = 0; i < 6; i++) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 6, 28), M.cap);
      ring.rotation.set(i * 0.9, i * 0.55, i * 0.3);
      ball.add(ring);
    }
    ball.position.set(0.02, CAP_H + 0.1, -0.02);
    ball.traverse(function (m) { m.castShadow = true; });
    keys["`"].cap.add(ball);
  })();

  // ── colors ─────────────────────────────────────────────────────────
  function setColors(P) {
    for (var k in P) M[k].color.set(P[k]).convertSRGBToLinear(); // sRGB hex in, the renderer works in linear light
  }
  function theme() {
    var d = dark.matches;
    setColors(palette(colorway, d));
    var map = COLORWAYS[colorway].grain ? grain : null;
    if (M.kase.map !== map) { M.kase.map = map; M.kase.needsUpdate = true; }
    all.forEach(function (k) { k.mat.color.copy(M[k.kind].color); k.mat.emissiveIntensity = 0; });
    glowOn = d;
    underLights.forEach(function (l) { l.intensity = d ? 3.2 : 0; });
    halo.visible = d;
    M.plate.emissive.set(d ? GLOW : 0).convertSRGBToLinear(); M.plate.emissiveIntensity = d ? 0.55 : 0;
    M.sw.emissive.set(d ? GLOW : 0).convertSRGBToLinear(); M.sw.emissiveIntensity = d ? 0.25 : 0;
    sun.intensity = d ? 0.75 : 1.6;
    fill.intensity = d ? 0.15 : 0.35;
    hemi.intensity = d ? 0.32 : 0.55;
    renderer.toneMappingExposure = d ? 1.05 : 1.0;
    ground.material.opacity = d ? 0.55 : 0.17;
    M.edge.color.set(d ? 0x14110e : 0xb9a990).convertSRGBToLinear();
    M.edge.opacity = d ? 0.6 : 0.45;
  }

  // ── pressing keys ──────────────────────────────────────────────────
  var TRAVEL = 0.22, clock = 0;
  function press(label, holdFor) {
    var k = keys[label];
    if (!k) return;
    k.target = 1;
    k.releaseAt = holdFor === Infinity ? Infinity : clock + (holdFor || (label === " " ? 0.09 : 0.06));
    wake();
  }
  function release(label) {
    var k = keys[label];
    if (k) { k.target = 0; k.releaseAt = 0; wake(); }
  }
  var SHIFTED = { "~": "`", "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
    "_": "-", "+": "=", "{": "[", "}": "]", "|": "\\", ":": ";", "\"": "'", "<": ",", ">": ".", "?": "/" };
  function typeChar(ch) {
    if (ch === "\n") return press("enter");
    var base = SHIFTED[ch] || (/[A-Z]/.test(ch) ? ch.toLowerCase() : null);
    if (base) { press("lshift", 0.16); press(base); return; }
    press(keys[ch] ? ch : " ");
  }

  function step(dt) {
    clock += dt;
    var moving = false;
    for (var i = 0; i < all.length; i++) {
      var k = all[i];
      if (k.target && clock >= k.releaseAt) k.target = 0;
      // springy: fast down, a little bounce on the way up
      var stiff = k.target ? 900 : 380, damp = k.target ? 50 : 22;
      k.v += ((k.target - k.press) * stiff - k.v * damp) * dt;
      k.press = Math.max(-0.08, Math.min(1.02, k.press + k.v * dt));
      if (k.target || Math.abs(k.press) > 0.0005 || Math.abs(k.v) > 0.005) moving = true;
      else { k.press = 0; k.v = 0; }
      k.cap.position.y = k.restY - k.press * TRAVEL;
      if (glowOn) { k.mat.emissive.setHex(GLOW); k.mat.emissiveIntensity = Math.max(0, k.press) * 0.35; }
      var sq = Math.max(0, k.v) * 0.0009 * (k.target ? 1 : 0) + k.press * 0.05; // squash going down, a little stretch on the rebound
      k.cap.scale.set(1 + sq * 0.5, 1 - sq - (k.press < 0 ? k.press * 0.6 : 0), 1 + sq * 0.5);
    }
    return moving;
  }

  // ── loop: only runs while a key is moving ──────────────────────────
  var running = false, last = 0, visible = true;
  function render() { renderer.render(scene, camera); }
  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.1, (now - last) / 1000 || 0.016), moving = false;
    last = now;
    for (var left = dt; left > 0; left -= 1 / 120) moving = step(Math.min(left, 1 / 120)) || moving;
    render();
    if (moving && !document.hidden) requestAnimationFrame(frame);
    else running = false;
  }
  function wake() {
    if (running || !visible) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  function resize() {
    var w = stage.clientWidth, h = stage.clientHeight || w / 2.2;
    if (!w) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    var narrow = w < 520; // phones: zoom in, the board is the limit
    camera.fov = narrow ? 20 : 21;
    camera.position.set(12.5, 13.5, 21);
    camera.lookAt(LOOK);
    camera.updateProjectionMatrix();
    render();
  }

  // ── visitors pressing keys ─────────────────────────────────────────
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), held = null;
  function keyAt(ev) {
    var r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    // only solid surfaces count: the hairline outlines are lines, and three.js treats a ray that
    // passes near a line as a hit, so the key in front used to win
    var hits = ray.intersectObjects(caps, true);
    for (var i = 0; i < hits.length; i++) {
      if (!hits[i].object.isMesh) continue;
      for (var o = hits[i].object; o; o = o.parent) if (o.userData.key) return o.userData.key;
    }
    return null;
  }
  function thock(label) {
    if (window.gardenThock) window.gardenThock(label === " " || label === "enter", true);
  }
  var canvas = renderer.domElement;
  canvas.addEventListener("pointerdown", function (ev) {
    var k = keyAt(ev);
    if (!k) return;
    held = k.label;
    press(held, Infinity);
    thock(held);
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
  });
  function letGo() { if (held) { release(held); held = null; } }
  canvas.addEventListener("pointerup", letGo);
  canvas.addEventListener("pointercancel", letGo);
  canvas.addEventListener("lostpointercapture", letGo);
  var hoverPending = false;
  canvas.addEventListener("pointermove", function (ev) {
    if (ev.pointerType !== "mouse" || hoverPending) return;
    hoverPending = true;
    requestAnimationFrame(function () {
      hoverPending = false;
      canvas.style.cursor = keyAt(ev) ? "pointer" : "";
    });
  });

  // typing on your own keyboard presses the same key here, while it's on screen
  var CODES = { Backquote: "`", Minus: "-", Equal: "=", Backspace: "bksp", Tab: "tab", BracketLeft: "[", BracketRight: "]",
    Backslash: "\\", CapsLock: "caps", Semicolon: ";", Quote: "'", Enter: "enter", NumpadEnter: "enter", ShiftLeft: "lshift",
    ShiftRight: "rshift", Comma: ",", Period: ".", Slash: "/", ControlLeft: "lctrl", MetaLeft: "lwin", AltLeft: "lalt",
    Space: " ", AltRight: "ralt", MetaRight: "fn", ContextMenu: "menu", ControlRight: "rctrl" };
  function labelFor(code) {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
    if (/^Digit\d$/.test(code)) return code.slice(5);
    return CODES[code];
  }
  document.addEventListener("keydown", function (e) {
    if (!visible || e.repeat) return;
    var l = labelFor(e.code);
    if (l) press(l, Infinity);
  });
  document.addEventListener("keyup", function (e) {
    var l = labelFor(e.code);
    if (l) release(l);
  });
  window.addEventListener("blur", function () { all.forEach(function (k) { if (k.target) release(k.label); }); });

  // the home page prompt, one character at a time (sent by garden.js)
  document.addEventListener("garden:key", function (e) { typeChar(e.detail.ch); });

  // ── start ──────────────────────────────────────────────────────────
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) wake(); }).observe(stage);
  if (dark.addEventListener) dark.addEventListener("change", function () { theme(); render(); });
  theme();
  resize();
  stage.classList.add("kb-on");
  window.gardenKeyboard = {
    colorways: Object.keys(COLORWAYS),
    setColors: function (name) { if (COLORWAYS[name]) { colorway = name; stage.dataset.colors = name; theme(); render(); } },
    typeChar: typeChar,
    screenPos: function (label) {
      var k = keys[label], v = new THREE.Vector3(0, CAP_H * 0.8, 0);
      k.cap.localToWorld(v).project(camera);
      var r = renderer.domElement.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    },
    pressed: function () { return all.filter(function (k) { return k.press > 0.5; }).map(function (k) { return k.label; }); },
    reducedMotion: reduce.matches,
    // for tests: advance the simulation by n frames without waiting for the browser
    step: function (n) { for (var i = 0; i < n; i++) step(1 / 60); render(); },
  };
  document.dispatchEvent(new CustomEvent("kb:ready"));
})();
