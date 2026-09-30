// The 3D typewriter for retro mode on the home page (three.js r128, loaded before this file).
// It is only built when retro mode is on (retro.js calls gardenTypewriter.start()). Like the
// keyboard, it types the prompt with garden.js ("garden:key" events), and visitors can click its
// keys, pull the return lever, or type on their own keyboard: the letters land on its paper.
// Markup: <div class="tw" data-tw aria-hidden="true"></div>
(function () {
  var stage = document.querySelector("[data-tw]");
  if (!stage) return;
  var root = document.documentElement;
  function retro() { return root.classList.contains("retro"); }
  var api = { start: start, started: false };
  window.gardenTypewriter = api;

  function start() {
    if (api.started) return true;
    api.started = true;
    try { build(); return true; }
    catch (e) {
      stage.remove();
      document.dispatchEvent(new CustomEvent("kb:skip"));
      return false;
    }
  }

  function build() {
    if (!window.THREE) throw new Error("three.js missing");
    var DEG = Math.PI / 180;
    function col(h) { return new THREE.Color(h).convertSRGBToLinear(); } // sRGB hex in; the renderer works in linear light

    // ── renderer / scene ─────────────────────────────────────────────
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    stage.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 1.6, 0.1, 200);
    var LOOK = new THREE.Vector3(1.0, 2.2, -0.4);

    // reflections: a dark room with a warm lamp softbox and a cool window strip, for the chrome and the lacquer
    (function () {
      var env = new THREE.Scene();
      env.add(new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({ color: 0x080706, side: THREE.BackSide })));
      function panel(w, h, hex, k, x, y, z) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
        m.material.color.copy(col(hex)).multiplyScalar(k);
        m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
      }
      panel(9, 6, 0xffcf96, 5, -7, 10, 7);      // the desk lamp
      panel(16, 2.5, 0x9fb4d6, 1.4, 9, 5, -10); // a cool window behind
      panel(12, 3, 0xffeedd, 0.7, 5, 4, 12);    // a little light from the room
      var pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(env, 0.04).texture;
      pm.dispose();
    })();

    var lamp = new THREE.DirectionalLight(0xffd3a0, 2.1);
    lamp.position.set(-7, 13, 9);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    Object.assign(lamp.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
    lamp.shadow.radius = 6;
    lamp.shadow.bias = -0.0005;
    var rim = new THREE.DirectionalLight(0xa9bddc, 0.9);
    rim.position.set(9, 6, -11);
    scene.add(new THREE.HemisphereLight(0xffe2c0, 0x120d0a, 0.3), lamp, rim);

    var M = {
      lacquer: new THREE.MeshPhysicalMaterial({ color: col(0x17130f), roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.07 }),
      chrome: new THREE.MeshStandardMaterial({ color: col(0xe6e1d8), metalness: 1, roughness: 0.18 }),
      steel: new THREE.MeshStandardMaterial({ color: col(0xb4ada1), metalness: 0.9, roughness: 0.36 }),
      brass: new THREE.MeshStandardMaterial({ color: col(0xd3aa5c), metalness: 1, roughness: 0.3 }),
      rubber: new THREE.MeshStandardMaterial({ color: col(0x1b1917), roughness: 0.9, envMapIntensity: 0.4 }),
      bakelite: new THREE.MeshPhysicalMaterial({ color: col(0x1c1712), roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
      felt: new THREE.MeshStandardMaterial({ color: col(0x4a1f1a), roughness: 1, envMapIntensity: 0.3 }),
      ribbon: new THREE.MeshStandardMaterial({ color: col(0x4f1512), roughness: 0.75 }),
      keyBody: new THREE.MeshPhysicalMaterial({ color: col(0x121110), roughness: 0.3, clearcoat: 1 }),
    };
    function add(parent, geo, mat, cast) {
      var m = new THREE.Mesh(geo, mat);
      m.castShadow = cast !== false; m.receiveShadow = true;
      parent.add(m);
      return m;
    }

    var ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShadowMaterial({ opacity: 0.55 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    (function () { // the pool of lamp light on the desk
      var c = document.createElement("canvas"); c.width = c.height = 256;
      var g = c.getContext("2d"), grd = g.createRadialGradient(128, 128, 4, 128, 128, 128);
      grd.addColorStop(0, "rgba(255,196,130,0.26)"); grd.addColorStop(0.5, "rgba(255,170,100,0.07)"); grd.addColorStop(1, "rgba(255,170,100,0)");
      g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
      var pool = new THREE.Mesh(new THREE.PlaneGeometry(17, 12), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(-0.5, 0.01, 0.5);
      scene.add(pool);
    })();

    var redraws = []; // canvases that redraw once the web fonts arrive
    function redrawAll() { redraws.forEach(function (f) { f(); }); }

    // ── body: one side profile, extruded across ──────────────────────
    var W = 9, TOP = 2.5;
    (function () {
      var s = new THREE.Shape();              // (u, v) = (z, y): front is +z
      s.moveTo(-3.3, 0.12);
      s.lineTo(3.9, 0.12);
      s.lineTo(3.9, 0.52);
      s.quadraticCurveTo(3.9, 0.66, 3.72, 0.7);
      s.lineTo(1.15, 1.58);                    // the sloped deck under the keys
      s.quadraticCurveTo(0.95, 1.65, 0.93, 1.85);
      s.lineTo(0.88, 2.25);                    // hood front
      s.quadraticCurveTo(0.86, 2.38, 0.6, 2.38);
      s.lineTo(-2.9, 2.38);                    // top deck, where the typebars rest
      s.quadraticCurveTo(-3.3, 2.38, -3.3, 1.98);
      s.lineTo(-3.3, 0.12);
      var g = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.12, bevelSegments: 4, curveSegments: 14 });
      g.rotateY(-Math.PI / 2);
      g.translate(W / 2, 0, 0);
      add(scene, g, M.lacquer);
    })();
    function deckY(z) { return 0.7 + (3.72 - z) * 0.3424 + 0.127; }
    [-1, 1].forEach(function (sx) { // gold pinstripes along both sides
      var p = add(scene, new THREE.BoxGeometry(0.006, 0.028, 7.0), M.brass, false);
      p.position.set(sx * (W / 2 + 0.143), 0.34, 0.3);
    });

    // ── typebars: a fan in the basket that swings up to strike the paper
    var PC = new THREE.Vector3(0, 3.05, -1.75);            // platen center (the carriage slides along x)
    var PLAT_R = 0.42;
    var PP = new THREE.Vector3(0, PC.y, PC.z + PLAT_R);     // printing point: the front of the platen
    var SEG = new THREE.Vector3(0, 2.6, PP.z);              // center of the segment the bars pivot on
    var SEG_R = 1.0, BAR_H = PP.y - SEG.y, BAR_L = Math.hypot(SEG_R, BAR_H);
    var PHI_REST = -0.08, PHI_STRIKE = Math.atan2(BAR_H, -SEG_R);
    (function () {
      var felt = add(scene, new THREE.RingGeometry(0.45, 2.25, 56, 1, Math.PI + 0.12, Math.PI - 0.24), M.felt, false);
      felt.rotation.x = -Math.PI / 2;
      felt.position.set(SEG.x, TOP + 0.006, SEG.z);
      var arc = new THREE.Group();
      var torus = add(arc, new THREE.TorusGeometry(SEG_R, 0.05, 10, 64, 164 * DEG), M.brass);
      torus.rotation.z = -172 * DEG;
      arc.rotation.x = -Math.PI / 2;
      arc.position.copy(SEG);
      scene.add(arc);
    })();
    var armGeo = new THREE.BoxGeometry(BAR_L - 0.1, 0.022, 0.045); armGeo.translate((BAR_L - 0.1) / 2, 0, 0);
    var slugGeo = new THREE.BoxGeometry(0.1, 0.085, 0.07); slugGeo.translate(BAR_L - 0.05, 0, 0);
    function makeBar(theta) {
      var pivot = new THREE.Group();
      pivot.position.set(SEG.x + SEG_R * Math.sin(theta), SEG.y, SEG.z + SEG_R * Math.cos(theta));
      pivot.rotation.y = theta - Math.PI / 2;   // local x points outward along the fan
      var arm = new THREE.Group();
      arm.rotation.z = PHI_REST;
      add(arm, armGeo, M.steel); add(arm, slugGeo, M.chrome);
      pivot.add(arm);
      scene.add(pivot);
      return { arm: arm, t: -1, glyph: "", struck: false };
    }

    // ── keys: round, chrome-ringed, black glass with cream legends ───
    function legendTexture(text) {
      var c = document.createElement("canvas"); c.width = c.height = 128;
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
      function draw() {
        var g = c.getContext("2d");
        var grd = g.createRadialGradient(52, 44, 6, 64, 64, 66);
        grd.addColorStop(0, "#2d2924"); grd.addColorStop(1, "#0c0b0a");
        g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
        g.fillStyle = "#efe4cc"; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = text.length > 1 ? "700 27px 'Courier Prime', 'Courier New', monospace" : "700 64px 'Courier Prime', 'Courier New', monospace";
        g.fillText(text, 64, text.length > 1 ? 66 : 70);
        t.needsUpdate = true;
      }
      draw(); redraws.push(draw);
      return t;
    }
    var capGeo = new THREE.CylinderGeometry(0.215, 0.2, 0.08, 32);
    var ringGeo = new THREE.TorusGeometry(0.228, 0.032, 10, 40);
    var faceGeo = new THREE.CircleGeometry(0.195, 32); faceGeo.rotateX(-Math.PI / 2);
    var P = 0.64;
    var ROWS = [
      { z: 1.45, stem: 0.6, off: 0, chars: "1234567890-", pre: [], post: [["back", "back"]] },
      { z: 2.0, stem: 0.55, off: 0.18, chars: "qwertyuiop", pre: [], post: [] },
      { z: 2.6, stem: 0.5, off: 0.36, chars: "asdfghjkl;", pre: [["lock", "lock"]], post: [] },
      { z: 3.2, stem: 0.45, off: 0.54, chars: "zxcvbnm,./", pre: [["lshift", "shift"]], post: [["rshift", "shift"]] },
    ];
    var keys = {}, allKeys = [], clickable = [];
    function makeKey(label, legend, x, z, stemH) {
      var restY = deckY(z) + stemH;
      var r = new THREE.Group();
      r.position.set(x, restY, z);
      var stem = add(r, new THREE.BoxGeometry(0.05, stemH + 0.2, 0.05), M.steel);
      stem.position.y = -(stemH + 0.2) / 2;
      var cap = new THREE.Group();
      cap.rotation.x = 0.28;                   // faces lean toward the typist
      add(cap, capGeo, M.keyBody);
      var ring = add(cap, ringGeo, M.chrome); ring.rotation.x = Math.PI / 2; ring.position.y = 0.036;
      var face = add(cap, faceGeo, new THREE.MeshPhysicalMaterial({ map: legendTexture(legend), roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.04 }), false);
      face.position.y = 0.044;
      r.add(cap);
      scene.add(r);
      var k = { label: label, root: r, cap: cap, restY: restY, press: 0, v: 0, target: 0, releaseAt: 0, bar: null, x: x };
      r.userData.key = k;
      keys[label] = k; allKeys.push(k); clickable.push(r);
      return k;
    }
    ROWS.forEach(function (row) {
      var n = row.chars.length, xs = [];
      row.chars.split("").forEach(function (ch, j) { var x = (j - (n - 1) / 2) * P + row.off; xs.push(x); makeKey(ch, ch.toUpperCase(), x, row.z, row.stem); });
      row.pre.forEach(function (d) { makeKey(d[0], d[1], xs[0] - P - 0.06, row.z, row.stem); });
      row.post.forEach(function (d) { makeKey(d[0], d[1], xs[n - 1] + P + 0.06, row.z, row.stem); });
    });
    (function () { // space bar: a long lacquered bar on two arms, with chrome ends
      var z = 3.74, y = 1.26, w = 4.6, d = 0.24, r = 0.1;
      var sb = new THREE.Group(); sb.position.set(0.3, y, z);
      var s = new THREE.Shape();
      s.moveTo(-w / 2 + r, -d / 2); s.lineTo(w / 2 - r, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, 0); s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
      s.lineTo(-w / 2 + r, d / 2); s.quadraticCurveTo(-w / 2, d / 2, -w / 2, 0); s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
      var g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 });
      g.rotateX(-Math.PI / 2);
      add(sb, g, M.lacquer);
      [-1, 1].forEach(function (sx) {
        var end = add(sb, new THREE.CylinderGeometry(0.125, 0.125, 0.1, 20), M.chrome); end.position.set(sx * (w / 2 - 0.02), 0.035, 0);
        var armH = y - deckY(z) + 0.2;
        var arm = add(sb, new THREE.BoxGeometry(0.06, armH, 0.06), M.steel); arm.position.set(sx * (w / 2 - 0.5), -armH / 2, -0.04);
      });
      scene.add(sb);
      var k = { label: " ", root: sb, restY: y, press: 0, v: 0, target: 0, releaseAt: 0, bar: null };
      sb.userData.key = k;
      keys[" "] = k; allKeys.push(k); clickable.push(sb);
    })();
    // one typebar per character key; the fan follows the keys left to right, like the real linkage
    (function () {
      var charKeys = allKeys.filter(function (k) { return k.label.length === 1 && k.label !== " "; }).sort(function (a, b) { return a.x - b.x; });
      charKeys.forEach(function (k, i) { k.bar = makeBar((-78 + (156 * i) / (charKeys.length - 1)) * DEG); });
    })();

    // ribbon spools, and the ribbon just below the typing line so the letters stay readable
    [-1, 1].forEach(function (sx) {
      var spool = new THREE.Group(); spool.position.set(sx * 3.1, TOP, -1.0);
      add(spool, new THREE.CylinderGeometry(0.52, 0.52, 0.16, 36), M.chrome).position.y = 0.08;
      add(spool, new THREE.CylinderGeometry(0.12, 0.12, 0.26, 16), M.lacquer).position.y = 0.13;
      var groove = add(spool, new THREE.TorusGeometry(0.42, 0.018, 6, 40), M.lacquer);
      groove.rotation.x = Math.PI / 2; groove.position.y = 0.165;
      scene.add(spool);
    });
    (function () { // a flat band: a tube squashed front to back, built around its own center so the squash doesn't move it
      var O = new THREE.Vector3(0, 2.76, -1.18);
      var pts = [[-2.75, 2.64, -1.0], [-1.6, 2.8, -1.2], [-0.5, 2.86, -1.26], [0.5, 2.86, -1.26], [1.6, 2.8, -1.2], [2.75, 2.64, -1.0]]
        .map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]).sub(O); });
      var rib = add(scene, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.03, 8, false), M.ribbon);
      rib.position.copy(O); rib.scale.set(1, 1.4, 0.4);
      add(scene, new THREE.BoxGeometry(0.34, 0.1, 0.04), M.chrome).position.set(0, 2.84, -1.25);
      var rail = add(scene, new THREE.CylinderGeometry(0.06, 0.06, W + 0.6, 16), M.chrome); // the rail the carriage rides on
      rail.rotation.z = Math.PI / 2; rail.position.set(0, TOP + 0.1, -2.55);
    })();

    // ── carriage: platen, knobs, paper, bail and the return lever ─────
    var carriage = new THREE.Group(); scene.add(carriage);
    var PLAT_L = 7.0;
    var platen = new THREE.Group(); platen.position.copy(PC); carriage.add(platen);
    add(platen, new THREE.CylinderGeometry(PLAT_R, PLAT_R, PLAT_L, 48), M.rubber).rotation.z = Math.PI / 2;
    [-1, 1].forEach(function (sx) {
      var knob = new THREE.Group(); knob.position.x = sx * (PLAT_L / 2 + 0.36);
      add(knob, new THREE.CylinderGeometry(0.4, 0.4, 0.34, 32), M.bakelite).rotation.z = Math.PI / 2;
      for (var i = 0; i < 18; i++) {           // knurling, so you can see the knob turn when the paper feeds
        var a = (i / 18) * Math.PI * 2;
        var r = add(knob, new THREE.BoxGeometry(0.34, 0.05, 0.05), M.bakelite, false);
        r.position.set(0, Math.cos(a) * 0.4, Math.sin(a) * 0.4); r.rotation.x = a;
      }
      add(knob, new THREE.CylinderGeometry(0.19, 0.19, 0.36, 24), M.chrome).rotation.z = Math.PI / 2;
      var axle = add(platen, new THREE.CylinderGeometry(0.07, 0.07, 0.4, 12), M.chrome); axle.rotation.z = Math.PI / 2; axle.position.x = sx * (PLAT_L / 2 + 0.15);
      platen.add(knob);
      add(carriage, new THREE.BoxGeometry(0.1, 0.95, 1.2), M.lacquer).position.set(sx * (PLAT_L / 2 + 0.08), PC.y - 0.05, PC.z - 0.25);
      add(carriage, new THREE.BoxGeometry(0.3, 0.14, 0.3), M.steel).position.set(sx * (PLAT_L / 2 - 0.3), TOP + 0.1, -2.55);
    });
    add(carriage, new THREE.BoxGeometry(PLAT_L, 0.08, 0.1), M.lacquer).position.set(0, TOP + 0.24, -2.5);

    // paper: wraps the front of the platen, then rises along the paper table
    var PAPER_W = 5.2, PR = PLAT_R + 0.012, A0 = -20 * DEG, A1 = 25 * DEG;
    var ARC = PR * (A1 - A0), STRAIGHT = 2.55, SP = ARC + STRAIGHT;
    var S0 = PR * (0 - A0);                          // where the printing point sits along the sheet
    function pathAt(s) {
      if (s <= ARC) { var a = A0 + s / PR; return { z: PC.z + PR * Math.cos(a), y: PC.y + PR * Math.sin(a) }; }
      var t = s - ARC, z1 = PC.z + PR * Math.cos(A1), y1 = PC.y + PR * Math.sin(A1);
      return { z: z1 - Math.sin(A1) * t, y: y1 + Math.cos(A1) * t };
    }
    var PX = 1024 / PAPER_W, CW = 0.155, LH = 0.29, XL = -2.15, MAXCOL = 27, FS = 50;
    var paperCanvas = document.createElement("canvas");
    paperCanvas.width = 1024; paperCanvas.height = Math.round(SP * PX);
    var paperTex = new THREE.CanvasTexture(paperCanvas);
    paperTex.encoding = THREE.sRGBEncoding;
    paperTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    (function () {
      var N = 70, pos = [], uv = [], idx = [];
      for (var i = 0; i <= N; i++) {
        var s = (i / N) * SP, p = pathAt(s);
        for (var j = 0; j < 2; j++) { pos.push((j - 0.5) * PAPER_W, p.y, p.z); uv.push(j, s / SP); }
        if (i < N) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      add(carriage, g, new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.35 }));
      var t = pathAt(ARC + 0.85);                      // paper table behind the sheet
      var table = add(carriage, new THREE.BoxGeometry(PLAT_L - 0.6, 1.7, 0.05), M.lacquer);
      table.position.set(0, t.y - 0.07 * Math.sin(A1), t.z - 0.07 * Math.cos(A1));
      table.rotation.x = -A1;
      var b = pathAt(ARC + 1.95), bz = b.z + 0.07 * Math.cos(A1), by = b.y + 0.07 * Math.sin(A1); // paper bail and its rollers
      var rod = add(carriage, new THREE.CylinderGeometry(0.028, 0.028, PAPER_W + 0.9, 12), M.chrome); rod.rotation.z = Math.PI / 2; rod.position.set(0, by, bz);
      [-1.25, 1.25].forEach(function (sx) { var rl = add(carriage, new THREE.CylinderGeometry(0.075, 0.075, 0.34, 16), M.rubber); rl.rotation.z = Math.PI / 2; rl.position.set(sx, by, bz); });
    })();
    var lever = new THREE.Group(); // carriage return lever on the left
    (function () {
      lever.position.set(-(PLAT_L / 2 + 0.2), PC.y + 0.15, PC.z + 0.25);
      var pts = [[0, 0, 0], [-0.05, 0.3, 0.4], [-0.2, 0.5, 1.0], [-0.45, 0.48, 1.55]].map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
      add(lever, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.065, 12, false), M.chrome);
      var paddle = add(lever, new THREE.BoxGeometry(0.56, 0.08, 0.3), M.chrome);
      paddle.position.set(-0.55, 0.47, 1.7); paddle.rotation.y = 0.45;
      add(lever, new THREE.SphereGeometry(0.08, 16, 12), M.chrome);
      lever.userData.lever = true;
      carriage.add(lever); clickable.push(lever);
    })();

    // ── the page ─────────────────────────────────────────────────────
    var lines = [[]], column = 0, feed = 0;
    function drawPaper() {
      var g = paperCanvas.getContext("2d"), H = paperCanvas.height;
      g.fillStyle = "#efe6d2"; g.fillRect(0, 0, 1024, H);
      var edge = g.createLinearGradient(0, 0, 0, H);   // a little shading toward the top of the sheet
      edge.addColorStop(0, "rgba(120,90,50,0.10)"); edge.addColorStop(0.3, "rgba(120,90,50,0)");
      g.fillStyle = edge; g.fillRect(0, 0, 1024, H);
      g.font = FS + "px 'Courier Prime', 'Courier New', monospace";
      g.textAlign = "center"; g.textBaseline = "alphabetic";
      g.fillStyle = "#171412";
      lines.forEach(function (line, j) {
        var s = S0 + (j + feed) * LH - 0.07, yb = (1 - s / SP) * H;
        if (yb < 0 || yb > H + FS) return;
        line.forEach(function (gl) {
          g.globalAlpha = gl.a;
          g.fillText(gl.ch, (gl.k * CW + XL + PAPER_W / 2) * PX + gl.jx, yb + gl.jy);
        });
      });
      g.globalAlpha = 1;
      paperTex.needsUpdate = true;
    }
    redraws.push(drawPaper);
    redrawAll();
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load(FS + "px 'Courier Prime'"), document.fonts.load("700 64px 'Courier Prime'")])
        .then(function () { redrawAll(); wake(); }, function () {});
    }

    // ── typing ───────────────────────────────────────────────────────
    var SHIFTED = { "'": "8", '"': "2", "!": "1", "?": "/", ":": ";", "$": "4", "&": "7", "(": "9", ")": "0", "_": "-", "#": "3", "%": "5", "~": "6", "@": "2" };
    var capsLock = false;
    function keyFor(ch) {
      if (ch === " ") return { key: keys[" "] };
      var lower = ch.toLowerCase();
      if (keys[lower] && keys[lower].bar) return { key: keys[lower], shift: ch !== lower };
      if (SHIFTED[ch]) return { key: keys[SHIFTED[ch]], shift: true };
      return null;
    }
    var clock = 0, carX = 0, carV = 0, carTarget = 0, returning = null, queue = [], nextActionAt = 0;
    var TRAVEL = 0.17;
    function thock(deep) { if (window.gardenThock) window.gardenThock(deep, true); }
    function press(k, hold) {
      k.target = 1;
      k.releaseAt = hold === Infinity ? Infinity : clock + (hold || 0.07);
    }
    function setColumn(c) { column = Math.max(0, Math.min(MAXCOL, c)); carTarget = -(XL + column * CW); }
    function typeChar(ch) {
      var info = keyFor(ch);
      if (!info) return;
      if (ch === " ") { press(info.key, 0.09); setColumn(column + 1); thock(true); return; }
      if (info.shift) press(keys.lshift, 0.2);
      press(info.key);
      var bar = info.key.bar;
      bar.t = 0; bar.struck = false; bar.glyph = ch;
    }
    function strike(glyph) {
      var r = Math.random;
      lines[0].push({ k: column, ch: glyph, a: 0.82 + r() * 0.18, jx: (r() - 0.5) * 1.6, jy: (r() - 0.5) * 1.6 });
      drawPaper();
      thock(false);
      setColumn(column + 1);
    }
    function process() {
      if (returning || !queue.length || clock < nextActionAt) return;
      var a = queue.shift();
      if (a.type === "char") { typeChar(a.ch); nextActionAt = clock + 0.055; }
      else if (a.type === "return") { returning = { t: 0, from: carX, rot0: platen.rotation.x }; thock(true); }
      else if (a.type === "back") { setColumn(column - 1); nextActionAt = clock + 0.08; }
    }
    function act(a) { queue.push(a); wake(); }

    // ── simulation ───────────────────────────────────────────────────
    var UP = 0.055, DOWN = 0.17;
    function ease(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
    function step(dt) {
      clock += dt;
      process();
      var busy = queue.length > 0 || !!returning;
      allKeys.forEach(function (k) {
        if (k.target && clock >= k.releaseAt) k.target = 0;
        var stiff = k.target ? 900 : 380, damp = k.target ? 50 : 22;
        k.v += ((k.target - k.press) * stiff - k.v * damp) * dt;
        k.press = Math.max(-0.08, Math.min(1.02, k.press + k.v * dt));
        if (k.target || Math.abs(k.press) > 0.0005 || Math.abs(k.v) > 0.005) busy = true;
        else { k.press = 0; k.v = 0; }
        k.root.position.y = k.restY - k.press * TRAVEL;
        if (k.cap) k.cap.rotation.x = 0.28 + k.press * 0.08;
        var b = k.bar;
        if (b && b.t >= 0) {
          busy = true;
          b.t += dt;
          var p;
          if (b.t < UP) p = Math.pow(b.t / UP, 2);
          else {
            if (!b.struck) { b.struck = true; strike(b.glyph); }
            var u = (b.t - UP) / DOWN;
            if (u >= 1) { b.t = -1; p = 0; } else p = Math.pow(1 - u, 3);
          }
          b.arm.rotation.z = PHI_REST + (PHI_STRIKE - PHI_REST) * p;
        }
      });
      if (returning) {
        var r = returning;
        r.t += dt;
        var u = Math.min(1, r.t / 0.55), f = Math.min(1, r.t / 0.3);
        carX = r.from + (-XL - r.from) * ease(u); carV = 0;
        lever.rotation.y = -0.55 * Math.sin(Math.PI * Math.min(1, r.t / 0.35));
        platen.rotation.x = r.rot0 - (LH / PR) * ease(f);
        feed = ease(f);
        drawPaper();
        if (u >= 1) {
          returning = null; feed = 0; lever.rotation.y = 0;
          lines.unshift([]); if (lines.length > 14) lines.pop();
          setColumn(0); carX = carTarget;
          drawPaper();
          nextActionAt = clock + 0.15;
        }
      } else {
        carV += ((carTarget - carX) * 420 - carV * 34) * dt;
        carX += carV * dt;
        if (Math.abs(carTarget - carX) > 0.0005 || Math.abs(carV) > 0.002) busy = true;
      }
      carriage.position.x = carX;
      return busy;
    }

    // ── size / loop: it only draws while something moves ─────────────
    function resize() {
      var w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      var hfov = 2 * Math.atan(Math.tan(13 * DEG) * 1.6); // the same width in view on any shape
      camera.fov = Math.min(50, 2 * Math.atan(Math.tan(hfov / 2) / camera.aspect) / DEG);
      camera.position.set(10.6, 9.4, 16.8);
      camera.lookAt(LOOK);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    }
    var running = false, last = 0, visible = true;
    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.1, (now - last) / 1000 || 0.016), busy = false;
      last = now;
      for (var left = dt; left > 0; left -= 1 / 120) busy = step(Math.min(left, 1 / 120)) || busy;
      renderer.render(scene, camera);
      if (busy && visible && !document.hidden) requestAnimationFrame(frame);
      else running = false;
    }
    function wake() {
      if (running || !visible || document.hidden) return;
      running = true; last = performance.now();
      requestAnimationFrame(frame);
    }
    new ResizeObserver(resize).observe(stage);
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) { resize(); wake(); } }).observe(stage);
    document.addEventListener("visibilitychange", wake);

    // ── visitors ─────────────────────────────────────────────────────
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function hitAt(ev) {
      var r = renderer.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      var hits = ray.intersectObjects(clickable, true);
      for (var i = 0; i < hits.length; i++) {
        if (!hits[i].object.isMesh) continue;
        for (var o = hits[i].object; o; o = o.parent) { if (o.userData.key) return { key: o.userData.key }; if (o.userData.lever) return { lever: true }; }
      }
      return null;
    }
    function held(k) { return k.target && k.releaseAt === Infinity; }
    var holding = null, canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", function (ev) {
      var hit = hitAt(ev);
      if (!hit) return;
      if (hit.lever) { act({ type: "return" }); return; }
      var k = hit.key, l = k.label;
      if (l === "lock") { capsLock = !capsLock; press(k, capsLock ? Infinity : 0.1); wake(); return; }
      if (l === "lshift" || l === "rshift") { press(k, Infinity); holding = k; wake(); return; }
      if (l === "back") { press(k, 0.1); act({ type: "back" }); return; }
      var shift = capsLock || held(keys.lshift) || held(keys.rshift), ch = l;
      if (shift && l.length === 1) ch = /[a-z]/.test(l) ? l.toUpperCase() : (Object.keys(SHIFTED).filter(function (c) { return SHIFTED[c] === l; })[0] || l);
      act({ type: "char", ch: ch });
    });
    function letGo() { if (holding) { holding.target = 0; holding.releaseAt = 0; holding = null; wake(); } }
    canvas.addEventListener("pointerup", letGo);
    canvas.addEventListener("pointercancel", letGo);
    var hoverPending = false;
    canvas.addEventListener("pointermove", function (ev) {
      if (ev.pointerType !== "mouse" || hoverPending) return;
      hoverPending = true;
      requestAnimationFrame(function () { hoverPending = false; canvas.style.cursor = hitAt(ev) ? "pointer" : ""; });
    });
    // typing on your own keyboard types on the paper, while retro mode is on and the typewriter is on screen
    document.addEventListener("keydown", function (e) {
      if (!retro() || !visible || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest && e.target.closest("button, input, textarea, select, a")) return;
      if (e.key === "Enter") { act({ type: "return" }); return; }
      if (e.key === "Backspace") { press(keys.back, 0.1); act({ type: "back" }); return; }
      if (e.key === "Shift") { press(e.code === "ShiftRight" ? keys.rshift : keys.lshift, 0.15); wake(); return; }
      if (e.key.length === 1 && keyFor(e.key) && !e.repeat) {
        if (e.key === " ") e.preventDefault();
        act({ type: "char", ch: e.key });
      }
    });
    // the prompt, one character at a time (sent by garden.js)
    document.addEventListener("garden:key", function (e) {
      if (!retro()) return;
      act(e.detail.ch === "\n" ? { type: "return" } : { type: "char", ch: e.detail.ch });
    });

    setColumn(0); carX = carTarget; carriage.position.x = carX;
    resize();
    stage.classList.add("tw-on");
    api.text = function () { return lines.slice().reverse().map(function (l) { var a = []; l.forEach(function (g) { a[g.k] = g.ch; }); return Array.from(a, function (c) { return c || " "; }).join(""); }); };
    api.step = function (n) { for (var i = 0; i < n; i++) step(1 / 60); renderer.render(scene, camera); };
    api.screenPos = function (label) {
      var o = label === "lever" ? lever : keys[label].root, v = new THREE.Vector3();
      if (label === "lever") v.set(-0.55, 0.47, 1.7); else v.set(0, 0.05, 0);
      o.localToWorld(v).project(camera);
      var r = canvas.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    };
  }

  // retro mode was already on when the page loaded: build now and type the prompt on paper
  if (retro() && start()) document.dispatchEvent(new CustomEvent("kb:ready"));
})();
