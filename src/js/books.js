/* /books — bookshelf. Built from docs/prd-books.md §6 (prototype v9). Data: #books-data (src/_data/books.js). */
(function () {
  "use strict";

  /* ───────────── data (rendered into the page by src/_data/books.js) ───────────── */
  var dataEl = document.getElementById("books-data");
  var shelvesEl = document.getElementById("shelves");
  if (!dataEl || !shelvesEl) return;
  var DATA = JSON.parse(dataEl.textContent);
  var MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  var PALETTE = ["#6b3f2a","#2f4f4a","#a9603a","#d9c7a0","#3b4a63","#7a2e2e","#5c6b3a","#c9a86a","#4a3b52","#e6d9c0","#1f3a3a","#8c5a3c","#b7b39a","#34495e","#9b4f3f","#6e7f6a"];
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lum(hex) {
    var n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) {
      v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
  function textFor(bg) { return contrast(bg, "#2b211a") >= contrast(bg, "#fbfaf4") ? "#2b211a" : "#fbfaf4"; }

  var BOOKS = {}, YEARS = [], NOW = [];
  function mk(o) {
    var b = { id: String(o.id), title: o.t, series: o.s || null, author: o.a, rating: o.r || 0, pages: o.p || null, dnf: !!o.d,
      year: o.y, month: o.m ? o.m - 1 : -1, review: o.rv || null, notes: [], color: o.c, text: o.tc,
      w: o.w, h: o.h, font: o.f, variant: o.v, cover: o.cv || null, ar: o.ar || .66, url: o.u };
    BOOKS[b.id] = b;
    return b;
  }
  DATA.years.forEach(function (y) { YEARS.push({ year: y.year, books: y.books.map(mk) }); });
  NOW = DATA.reading.map(function (o) { var b = mk(o); b.reading = true; b.h = 176; return b; });
  var lovedN = DATA.lovedTotal, dnfN = DATA.dnfTotal;
  var NOTES_API = DATA.notesApi || null; // margin notes backend (PRD §7) — not live yet

  /* ───────────── helpers ───────────── */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function dur(ms) { return ms; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function lastName(a) { var p = a.split(" "); return p[p.length - 1]; }
  function approvedCount(b) { return b.notes.filter(function (n) { return !n.pending; }).length; }
  function stars(r) { return "★★★★★".slice(0, r) + "☆☆☆☆☆".slice(0, 5 - r); }
  function scaleFactor() { return window.innerWidth < 480 ? .86 : 1; }
  function yarnBall(name) {
    var c = PALETTE[hash(name) % PALETTE.length], d = textFor(c) === "#2b211a" ? "rgba(43,33,26,.42)" : "rgba(251,250,244,.5)";
    return '<svg class="avatar" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="13" fill="' + c + '"/>' +
      '<path d="M4 10c6 2 13 1.5 19-3M3 16c7 3 15 2 22-3.5M8 25c3-6 9-12 16-13.5M9 3.5c1 6 5 12 12 16" fill="none" stroke="' + d + '" stroke-width="1.4" stroke-linecap="round"/></svg>';
  }

  /* ───────────── shelves ───────────── */
  function spineInner(b) { return '<span class="st">' + esc(b.title) + '</span><span class="sa">' + esc(lastName(b.author)) + '</span>'; }
  function labelFor(b) {
    var cnt = approvedCount(b);
    return b.title + " by " + b.author + (b.dnf ? ", did not finish, put down " : ", " + b.rating + " stars, read ") + MONTHS[b.month] + " " + b.year +
      (b.review ? ", reviewed" : "") + (cnt ? ", " + cnt + " note" + (cnt > 1 ? "s" : "") : "");
  }
  function spineBtn(b, k, flat) {
    var fav = !flat && b.rating >= 4, cnt = approvedCount(b);
    var cls = "spine sf-" + b.font + (flat ? " flat" : "") + (b.rating === 5 ? " fav5" : b.rating === 4 ? " fav4" : "") + (openId === b.id ? " out" : "");
    var style = "--w:" + Math.round(b.w * k) + "px;--h:" + Math.round(b.h * k) + "px;--c:" + b.color + ";--t:" + b.text;
    return '<button class="' + cls + '" type="button" data-id="' + b.id + '" aria-label="' + esc(labelFor(b)) + '" style="' + style + '">' + spineInner(b) +
      (fav ? '<span class="foil-star" aria-hidden="true"></span>' : "") +
      (b.rating === 5 ? '<span class="glint-wrap" aria-hidden="true"><span class="glint"></span></span>' : "") +
      (b.review ? '<span class="ribbon" aria-hidden="true"></span>' : "") +
      (cnt ? '<span class="slip" aria-hidden="true"></span>' : "") + '</button>';
  }

  var FOLD_ROWS = 2, expanded = {}, filterMode = "all";
  function renderShelves() {
    var k = scaleFactor();
    var pad = window.innerWidth < 480 ? 20 : 36;
    var avail = Math.max(220, shelvesEl.clientWidth - pad);
    var html = "";
    var mh = Math.round(176 * k), ms = mh / 176;
    html += '<section class="year now" aria-labelledby="ynow"><div class="year-head"><h2 class="yr words" id="ynow">' +
      'currently <em>reading</em></h2>' +
      '<span class="ym">' + (NOW.length ? NOW.length + (NOW.length > 1 ? " books" : " book") : "") + '</span></div><div class="room"><div class="shelf"><ul class="row">';
    if (!NOW.length) html += '<li class="empty" style="align-self:center">not reading anything right now</li>';
    NOW.forEach(function (b, i) {
      var cp = coverParts(b), cnt = approvedCount(b), mw = Math.round(176 * coverRatio(b) * k);
      html += '<li class="faceout"><button type="button" class="facecover' + (openId === b.id ? " out" : "") + '" data-id="' + b.id + '" style="--tilt:' + (i % 2 ? 1.5 : -1.5) + 'deg" aria-label="' +
        esc(b.title + " by " + b.author + ", currently reading" + (cnt ? ", " + cnt + " note" + (cnt > 1 ? "s" : "") : "")) + '">' +
        '<span class="mcover ' + cp.cls + '" style="--mw:' + mw + 'px;--mh:' + mh + 'px;--c:' + b.color + ';--t:' + b.text + ';font-size:' + (10 * ms).toFixed(2) + 'px">' + cp.inner + '</span>' +
        '<span class="now-tab" aria-hidden="true"></span></button></li>';
    });
    html += '<li class="mug-wrap" aria-hidden="true"><canvas class="steam" width="96" height="130"></canvas><div class="mug"><div class="mug-handle"></div><div class="mug-body"></div><div class="mug-rim"></div></div></li></ul><div class="plank" aria-hidden="true"></div></div></div></section>';
    YEARS.forEach(function (y) {
      var upright = y.books.filter(function (b) { return !b.dnf; });
      var flat = y.books.filter(function (b) { return b.dnf; });
      var parts = [];
      function pack(list) {
        var rs = [[]], u = 0;
        list.forEach(function (b) {
          var bw = Math.round(b.w * k) + 3;
          if (u + bw > avail && rs[rs.length - 1].length) { rs.push([]); u = 0; }
          rs[rs.length - 1].push({ b: b }); u += bw;
        });
        return { rows: rs, used: u };
      }
      var packed = pack(upright), rows = packed.rows, used = packed.used;
      // unfinished books: split into piles that fit the shelf height
      // balanced piles: as few as the shelf height allows, filled evenly
      var piles = [], maxH = 184 * k, totalH = 0;
      flat.forEach(function (b) { totalH += Math.round(b.w * k) + 2; });
      var nP = flat.length ? Math.ceil(totalH / maxH) : 0;
      for (var tries = 0; tries < 6 && nP; tries++) {
        piles = []; for (var q = 0; q < nP; q++) piles.push([]);
        var hs = piles.map(function () { return 0; });
        flat.forEach(function (b) { var j = hs.indexOf(Math.min.apply(null, hs)); piles[j].push(b); hs[j] += Math.round(b.w * k) + 2; });
        if (Math.max.apply(null, hs) <= maxH) break;
        nP++;
      }
      var tail = piles.length ? piles.map(function (pl) { return { pile: pl }; }) : [{ bookend: true }];
      var tws = tail.map(function (it) { return it.pile ? Math.max.apply(null, it.pile.map(function (b) { return Math.round(b.h * k); })) + 24 : 34; });
      var tailW = tws.reduce(function (x, y) { return x + y; }, 0);
      tail.forEach(function (it, i) {
        if (used + tws[i] > avail) { rows.push([]); used = 0; }
        rows[rows.length - 1].push(it); used += tws[i];
      });
      // if piles spilled onto a shelf of their own, bring some upright books down to keep them company
      var fin = rows[rows.length - 1], prev = rows[rows.length - 2];
      if (prev && fin.every(function (it) { return !it.b; })) {
        var wOf = function (it) { return it.b ? Math.round(it.b.w * k) + 3 : tws[tail.indexOf(it)]; };
        var finW = fin.reduce(function (x, it) { return x + wOf(it); }, 0), prevW = prev.reduce(function (x, it) { return x + wOf(it); }, 0);
        for (;;) {
          var idx = -1; for (var q = prev.length - 1; q >= 0; q--) if (prev[q].b) { idx = q; break; }
          if (idx < 1) break;
          var ww = wOf(prev[idx]);
          if (finW + ww > avail || finW + ww > prevW - ww) break;
          fin.unshift(prev.splice(idx, 1)[0]); finW += ww; prevW -= ww;
        }
      }
      var foldable = filterMode === "all" && rows.length > FOLD_ROWS + 1;
      var open = !foldable || expanded[y.year];
      // folded: highest-rated first (5★, then 4★, …), newest first within each rating. expanded: everything by read date.
      var byRating = open ? null : pack(upright.slice().sort(function (a, b) { return b.rating - a.rating; })).rows;
      var shown = open ? rows : byRating.slice(0, FOLD_ROWS);
      html += '<section class="year" aria-labelledby="y' + y.year + '"><div class="year-head"><h2 class="yr" id="y' + y.year + '">' + y.year + '</h2>' +
        '<span class="ym">' + y.books.length + ' books' + (flat.length ? " · " + flat.length + " unfinished" : "") + '</span>' +
        (foldable ? '<span class="sortnote">' + (open ? "all books · by read date" : '<span class="st">★</span> top rated first') + '</span>' : "") +
        '</div><div class="room">';
      function rowHTML(row, peek) {
        var h = '<div class="shelf' + (peek ? " peek" : "") + '"' + (peek ? ' aria-hidden="true" inert' : "") + '><ul class="row">';
        row.forEach(function (it) {
          if (it.b) h += '<li class="slot" data-id="' + it.b.id + '">' + spineBtn(it.b, k, false) + '</li>';
          else if (it.pile) h += '<li class="pile">' + it.pile.map(function (b) { return spineBtn(b, k, true); }).join("") + '</li>';
          else h += '<li class="bookend" aria-hidden="true"></li>';
        });
        return h + '</ul>' + (peek ? "" : '<div class="plank" aria-hidden="true"></div>') + '</div>';
      }
      shown.forEach(function (row, i) { html += rowHTML(row).replace('<div class="shelf">', '<div class="shelf" data-row="' + i + '">'); });
      if (!open && byRating[FOLD_ROWS]) html += rowHTML(byRating[FOLD_ROWS], true);
      html += '</div>';
      if (foldable) {
        var shownN = 0; shown.forEach(function (row) { shownN += row.length; });
        html += '<div class="fold"><button type="button" data-fold="' + y.year + '" aria-expanded="' + open + '">' +
          (open ? 'back to top rated <span class="arr">↑</span>' : 'show all ' + y.books.length + ' by date <span class="n">· ' + (y.books.length - shownN) + ' more</span> <span class="arr">↓</span>') + '</button></div>';
      }
      html += '</section>';
    });
    shelvesEl.innerHTML = html;
    shelvesEl.querySelectorAll(".pile .spine.flat").forEach(function (el, i) { el.style.marginLeft = (i % 2 ? 7 : 0) + "px"; });
  }

  function dropIn() {
    if (reduceMotion.matches) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var items = e.target.querySelectorAll(".slot, .pile, .bookend"), step = Math.min(20, 400 / Math.max(1, items.length));
        items.forEach(function (s, i) {
          s.animate([
            { transform: "translateY(-30px)", opacity: 0 },
            { transform: "translateY(3px)", opacity: 1, offset: .72 },
            { transform: "translateY(0)", opacity: 1 }
          ], { duration: dur(440), delay: dur(i * step), easing: "cubic-bezier(.3,.6,.4,1)", fill: "backwards" });
        });
      });
    }, { threshold: .15 });
    shelvesEl.querySelectorAll(".row").forEach(function (r) { io.observe(r); });
  }

  var openId = null;
  renderShelves();
  dropIn();
  var rt;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(renderShelves, 120); });

  /* steam: soft particles that rise, curl and fade */
  var steamRaf = 0, steamVisible = true;
  function startSteam() {
    cancelAnimationFrame(steamRaf);
    var cv = shelvesEl.querySelector("canvas.steam"); if (!cv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1), W = 96, H = 130;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
    var ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
    var parts = [], last = performance.now(), spawnAcc = 0;
    var color, peak;
    function rgb() { var cs = getComputedStyle(document.documentElement); color = cs.getPropertyValue("--steam-rgb").trim() || "168,152,126"; peak = parseFloat(cs.getPropertyValue("--steam-a")) || .08; }
    rgb();
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", rgb);
    function spawn() {
      var lane = Math.random() < .5 ? -5 : 5;
      parts.push({ x: W / 2 + lane + (Math.random() - .5) * 8, y: H - 2, age: 0, life: 3.6 + Math.random() * 2.2,
        vy: 13 + Math.random() * 8, amp: 5 + Math.random() * 9, freq: .7 + Math.random() * .8, ph: Math.random() * 6.28,
        r0: 2 + Math.random() * 1.5, r1: 8 + Math.random() * 7, drift: (Math.random() - .5) * 6 });
    }
    function step(dt) {
      spawnAcc += dt;
      while (spawnAcc > .06) { spawnAcc -= .06; spawn(); }
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i]; p.age += dt;
        if (p.age > p.life) { parts.splice(i, 1); continue; }
        p.y -= p.vy * dt * (1 - p.age / p.life * .35);
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i], t = p.age / p.life;
        var x = p.x + Math.sin(p.age * p.freq + p.ph) * p.amp * t + p.drift * t;
        var rad = p.r0 + (p.r1 - p.r0) * Math.pow(t, .8);
        var a = Math.sin(Math.PI * Math.min(1, t * 1.15)) * peak * (1 - t * .4);
        var g = ctx.createRadialGradient(x, p.y, 0, x, p.y, rad);
        g.addColorStop(0, "rgba(" + color + "," + a + ")");
        g.addColorStop(.55, "rgba(" + color + "," + (a * .45) + ")");
        g.addColorStop(1, "rgba(" + color + ",0)");
        ctx.save(); ctx.translate(x, p.y); ctx.rotate(Math.sin(p.age * p.freq + p.ph) * .35); ctx.scale(.7, 1.45); ctx.translate(-x, -p.y);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, p.y, rad, 0, 6.2832); ctx.fill(); ctx.restore();
      }
    }
    for (var w = 0; w < 70; w++) step(1 / 15);   // start already steaming
    draw();
    if (reduceMotion.matches) return;             // reduced motion: one still frame
    function tick(now) {
      var dt = Math.min(.05, (now - last) / 1000); last = now;
      if (steamVisible && !document.hidden && !openId) { step(dt); draw(); }
      steamRaf = requestAnimationFrame(tick);
    }
    steamRaf = requestAnimationFrame(tick);
    new IntersectionObserver(function (es) { steamVisible = es[0].isIntersecting; }).observe(cv);
  }
  startSteam();
  var _render = renderShelves;
  renderShelves = function () { _render(); startSteam(); };

  /* lamp glow follows the pointer across each shelf */
  shelvesEl.addEventListener("pointermove", function (e) {
    var room = e.target.closest && e.target.closest(".room"); if (!room) return;
    var r = room.getBoundingClientRect();
    room.style.setProperty("--mx", (e.clientX - r.left) + "px");
    room.style.setProperty("--my", (e.clientY - r.top) + "px");
    room.classList.add("lit");
  });
  shelvesEl.addEventListener("pointerout", function (e) {
    var room = e.target.closest && e.target.closest(".room");
    if (room && !room.contains(e.relatedTarget)) room.classList.remove("lit");
  });

  /* hover label */
  var hoverLabel = document.getElementById("hoverLabel");
  function showLabel(btn) {
    var b = BOOKS[btn.dataset.id]; if (!b || openId) return;
    if (b.cover && !b._pre) { b._pre = new Image(); b._pre.src = b.cover + ".webp"; }
    hoverLabel.querySelector(".ht").textContent = b.title;
    hoverLabel.querySelector(".ha").textContent = b.author + (b.reading ? " · currently reading" : b.dnf ? " · didn't finish" : b.rating ? " · " + stars(b.rating) : "");
    var r = btn.getBoundingClientRect();
    var top = r.top - (btn.classList.contains("flat") ? 8 : 16) - hoverLabel.offsetHeight;
    var x = clamp(r.left + r.width / 2, 12 + hoverLabel.offsetWidth / 2, window.innerWidth - 12 - hoverLabel.offsetWidth / 2);
    hoverLabel.style.left = x + "px"; hoverLabel.style.top = Math.max(8, top) + "px";
    hoverLabel.classList.add("show");
  }
  function hideLabel() { hoverLabel.classList.remove("show"); }
  shelvesEl.addEventListener("pointerover", function (e) { var b = e.target.closest(".spine, .facecover"); if (b && e.pointerType !== "touch") showLabel(b); });
  shelvesEl.addEventListener("pointerout", function (e) { if (e.target.closest(".spine, .facecover")) hideLabel(); });
  shelvesEl.addEventListener("focusin", function (e) { var b = e.target.closest(".spine, .facecover"); if (b && b.matches(":focus-visible")) showLabel(b); });
  shelvesEl.addEventListener("focusout", hideLabel);
  window.addEventListener("scroll", hideLabel, { passive: true });
  shelvesEl.addEventListener("click", function (e) {
    var f = e.target.closest("[data-fold]"); if (!f) return;
    var yr = +f.dataset.fold, wasOpen = !!expanded[yr];
    expanded[yr] = !wasOpen;
    var sec = document.getElementById("y" + yr).closest(".year"), topBefore = sec.getBoundingClientRect().top;
    var before = {};
    sec.querySelectorAll(".shelf:not(.peek) .slot").forEach(function (el) { before[el.dataset.id] = el.getBoundingClientRect(); });
    renderShelves();
    var sec2 = document.getElementById("y" + yr).closest(".year");
    if (wasOpen) window.scrollBy(0, sec2.getBoundingClientRect().top - topBefore);
    if (!reduceMotion.matches) {
      var fresh = 0;
      sec2.querySelectorAll(".shelf:not(.peek) .slot, .shelf:not(.peek) .pile, .shelf:not(.peek) .bookend").forEach(function (el) {
        var old = el.dataset.id && before[el.dataset.id];
        if (old) {
          var now = el.getBoundingClientRect();
          el.animate([{ transform: "translate(" + (old.left - now.left) + "px," + (old.top - now.top) + "px)" }, { transform: "none" }],
            { duration: 620, easing: "cubic-bezier(.3,.7,.2,1)" });
        } else {
          el.animate([{ transform: "translateY(-24px)", opacity: 0 }, { transform: "translateY(2px)", opacity: 1, offset: .72 }, { transform: "none", opacity: 1 }],
            { duration: 440, delay: 260 + Math.min(fresh++ * 7, 420), easing: "cubic-bezier(.3,.6,.4,1)", fill: "backwards" });
        }
      });
    }
    var fb = sec2.querySelector("[data-fold]"); if (fb) fb.focus({ preventScroll: true });
    document.getElementById("live").textContent = wasOpen ? yr + ": showing top rated books first." : yr + ": showing all " + sec2.querySelectorAll(".spine").length + " books by read date.";
  });
  shelvesEl.addEventListener("click", function (e) { var btn = e.target.closest(".spine, .facecover"); if (!btn) return; hideLabel(); openBook(btn.dataset.id); });
  shelvesEl.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    var all = Array.prototype.slice.call(shelvesEl.querySelectorAll(".facecover, .spine"));
    var i = all.indexOf(document.activeElement); if (i < 0) return;
    e.preventDefault();
    all[clamp(i + (e.key === "ArrowRight" ? 1 : -1), 0, all.length - 1)].focus();
  });

  /* ───────────── open / close ───────────── */
  var busy = false, layers = null, flightKeys = null, flyEl = null, castEl = null;

  function coverRatio(b) { return b.cover ? clamp(b.ar, .55, .8) : .66; }
  function coverParts(b) {
    if (b.cover) return { cls: "cv-img", inner: '<img src="' + b.cover + '.webp" alt="" decoding="async">' };
    var ttl = '<div class="ttl">' + esc(b.title) + '</div><div class="au">' + esc(b.author) + '</div>';
    if (b.variant === 0) return { cls: "cv-frame cf-" + b.font, inner: '<div class="inner"><div class="orn"></div>' + ttl + '</div>' };
    if (b.variant === 1) return { cls: "cv-band cf-" + b.font, inner: '<div class="art"></div><div class="band">' + ttl + '</div>' };
    return { cls: "cv-moon cf-" + b.font, inner: '<div class="disc"></div>' + ttl };
  }
  function build3D(b, s) {
    var W = b.w * s, H = b.h * s, D = Math.round(b.h * coverRatio(b)) * s;
    var cp = coverParts(b), cover = '<div class="f f-cover ' + cp.cls + '">' + cp.inner;
    cover += (b.dnf ? '<div class="dnf-mark">left off here</div>' : "") +
      (b.rating === 5 ? '<div class="cover-glint-wrap"><div class="cover-glint"></div></div>' : "") + "</div>";
    return { W: W, H: H, D: D, html:
      '<div class="b3d" style="--W:' + W + 'px;--H:' + H + 'px;--D:' + D + 'px;--c:' + b.color + ';--t:' + b.text + ';font-size:' + (10 * s) + 'px">' +
        '<div class="f f-spine sf-' + b.font + '">' + spineInner(b) + '</div>' + cover +
        '<div class="f f-back"></div><div class="f f-top"></div><div class="f f-fore"></div></div>' };
  }

  function targetGeom(b) {
    var vw = window.innerWidth, vh = window.innerHeight, mobile = vw <= 760;
    var D0 = Math.round(b.h * coverRatio(b)), s, cx, cy;
    if (mobile) {
      var area = vh * .40;
      s = Math.min((area * .8) / b.h, (vw * .44) / D0);
      cx = vw / 2; cy = area / 2 + 4;
    } else {
      var pw = Math.min(420, Math.max(340, vw * .36));
      document.documentElement.style.setProperty("--panel-w", pw + "px");
      var areaW = vw - pw - 32;
      s = Math.min(Math.min(290, areaW * .6) / D0, (vh * .68) / b.h);
      cx = areaW / 2 + 8; cy = vh / 2 - 10;
    }
    return { s: s, cx: cx, cy: cy, mobile: mobile };
  }

  function openBook(id) {
    if (busy) return;
    if (openId) { if (openId === id) return; closeBook(function () { openBook(id); }); return; }
    var b = BOOKS[id]; if (!b) return;
    var btn = shelvesEl.querySelector('[data-id="' + id + '"].spine, [data-id="' + id + '"].facecover'); if (!btn) return;
    busy = true; openId = id;
    var k = scaleFactor(), flat = btn.classList.contains("flat"), face = btn.classList.contains("facecover");
    var lifted = btn.matches(":hover") ? (flat ? -4 : face ? -10 : -12) : 0;
    var startCx, startCy;
    if (face) { var cr = btn.querySelector(".mcover").getBoundingClientRect(); startCx = cr.left + cr.width / 2; startCy = cr.top + cr.height / 2 - lifted; }
    else if (flat) { var fr = btn.getBoundingClientRect(); startCx = fr.left + fr.width / 2; startCy = fr.top + fr.height / 2 - lifted; }
    else { var sr = btn.parentNode.getBoundingClientRect(); startCx = sr.left + b.w * k / 2; startCy = sr.bottom - b.h * k / 2; }

    var g = targetGeom(b), built = build3D(b, g.s), s0 = k / g.s;
    layers = {};
    layers.backdrop = document.createElement("div"); layers.backdrop.className = "backdrop";
    layers.backdrop.style.setProperty("--cx", g.cx + "px"); layers.backdrop.style.setProperty("--cy", g.cy + "px");
    layers.flight = document.createElement("div"); layers.flight.className = "flight"; layers.flight.setAttribute("aria-hidden", "true");
    castEl = document.createElement("div"); castEl.className = "cast";
    castEl.style.width = built.D * .95 + "px"; castEl.style.left = (g.cx - built.D * .475) + "px"; castEl.style.top = (g.cy + built.H / 2 + 14) + "px";
    flyEl = document.createElement("div"); flyEl.className = "fly";
    flyEl.style.width = built.W + "px"; flyEl.style.height = built.H + "px";
    flyEl.style.left = (g.cx - built.W / 2) + "px"; flyEl.style.top = (g.cy - built.H / 2) + "px";
    flyEl.innerHTML = built.html;
    layers.flight.appendChild(castEl); layers.flight.appendChild(flyEl);
    layers.panel = buildPanel(b);
    document.body.appendChild(layers.backdrop); document.body.appendChild(layers.flight); document.body.appendChild(layers.panel);
    document.documentElement.classList.add("locked");
    btn.classList.add("out");
    layers.backdrop.addEventListener("click", function () { closeBook(); });

    var dx = startCx - g.cx, dy = startCy - g.cy, rz = flat ? -90 : 0, zSpine = -(built.D * s0) / 2;
    var sc = "scale3d(" + s0 + "," + s0 + "," + s0 + ")";
    if (face) {
      var sf = (176 * k) / b.h / g.s, scf = "scale3d(" + sf + "," + sf + "," + sf + ")", zf = -(built.W * sf) / 2;
      flightKeys = [
        { transform: "translate3d(" + dx + "px," + (dy + lifted) + "px," + zf + "px) rotateZ(0deg) rotateY(-90deg) " + scf, easing: "cubic-bezier(.3,.7,.4,1)" },
        { transform: "translate3d(" + dx + "px," + (dy + lifted - 30) + "px," + (zf + 110) + "px) rotateZ(-3deg) rotateY(-100deg) " + scf, offset: .3, easing: "cubic-bezier(.5,.05,.25,1.1)" },
        { transform: "translate3d(0px,0px," + (-built.W / 2) + "px) rotateZ(0deg) rotateY(-90deg) scale3d(1,1,1)" }
      ];
    } else flightKeys = [
      { transform: "translate3d(" + dx + "px," + (dy + lifted) + "px," + zSpine + "px) rotateZ(" + rz + "deg) rotateY(0deg) " + sc, easing: "cubic-bezier(.3,.7,.4,1)" },
      { transform: "translate3d(" + (dx + (flat ? 30 : 0)) + "px," + (dy + lifted - 26) + "px," + (zSpine + 90) + "px) rotateZ(" + (flat ? -70 : 0) + "deg) rotateY(-8deg) " + sc, offset: .28, easing: "cubic-bezier(.5,.05,.25,1.1)" },
      { transform: "translate3d(0px,0px," + (-built.W / 2) + "px) rotateZ(0deg) rotateY(-90deg) scale3d(1,1,1)" }
    ];
    var panelFrom = g.mobile ? { transform: "translateY(100%)" } : { transform: "translateX(28px) scale(.985)", opacity: 0 };
    var panelTo = g.mobile ? { transform: "translateY(0)" } : { transform: "none", opacity: 1 };

    var done = function () {
      busy = false;
      if (!reduceMotion.matches && flyEl) {
        var cg = flyEl.querySelector(".cover-glint");
        if (cg) cg.animate([{ transform: "translateX(-120%) skewX(-14deg)", opacity: 0 }, { opacity: 1, offset: .2 }, { transform: "translateX(330%) skewX(-14deg)", opacity: 0 }],
          { duration: dur(1000), easing: "cubic-bezier(.3,.6,.4,1)" });
        flyEl.querySelector(".b3d").animate([{ transform: "translateY(0)" }, { transform: "translateY(-5px)" }], { duration: 3000, direction: "alternate", iterations: Infinity, easing: "ease-in-out" });
        castEl.animate([{ transform: "scaleX(1)", opacity: 1 }, { transform: "scaleX(.93)", opacity: .75 }], { duration: 3000, direction: "alternate", iterations: Infinity, easing: "ease-in-out" });
      }
      var t = layers && layers.panel.querySelector(".p-title"); if (t) t.focus({ preventScroll: true });
      try { history.replaceState(null, "", "#b-" + id); } catch (err) {}
    };

    if (reduceMotion.matches) {
      flyEl.style.transform = flightKeys[2].transform; castEl.style.opacity = 1;
      [flyEl, layers.backdrop, layers.panel].forEach(function (el) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 }); });
      setTimeout(done, 160);
      return;
    }
    layers.backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur(420), easing: "ease-out", fill: "both" });
    flyEl.animate(flightKeys, { duration: dur(900), fill: "forwards" });
    castEl.animate([{ opacity: 0, transform: "scaleX(.4)" }, { opacity: 1, transform: "scaleX(1)" }], { duration: dur(420), delay: dur(560), easing: "ease-out", fill: "both" });
    layers.panel.animate([panelFrom, panelTo], { duration: dur(g.mobile ? 440 : 420), delay: dur(560), easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" }).onfinish = done;
  }

  function closeBook(then) {
    if (!openId || busy) return;
    busy = true;
    var mobile = window.innerWidth <= 760, L = layers, fly = flyEl, cast = castEl;
    fly.querySelector(".b3d").getAnimations().forEach(function (a) { a.cancel(); });
    cast.getAnimations().forEach(function (a) { a.cancel(); });
    var finish = function () {
      L.backdrop.remove(); L.flight.remove(); L.panel.remove();
      var s = shelvesEl.querySelector('[data-id="' + openId + '"].spine, [data-id="' + openId + '"].facecover');
      if (s) s.classList.remove("out");
      document.documentElement.classList.remove("locked");
      openId = null; layers = null; flyEl = null; castEl = null; busy = false;
      try { history.replaceState(null, "", location.pathname + location.search); } catch (err) {}
      if (then) then(); else if (s) s.focus({ preventScroll: true });
    };
    if (reduceMotion.matches) {
      [L.backdrop, L.flight, L.panel].forEach(function (el) { el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: "forwards" }); });
      setTimeout(finish, 160);
      return;
    }
    L.panel.animate([{ transform: "none", opacity: 1 }, mobile ? { transform: "translateY(100%)", opacity: 1 } : { transform: "translateX(28px)", opacity: 0 }],
      { duration: dur(220), easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" });
    cast.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur(200), fill: "forwards" });
    L.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur(560), delay: dur(200), easing: "ease-in", fill: "forwards" });
    var back = [
      { transform: flightKeys[2].transform, easing: "cubic-bezier(.45,0,.2,1)" },
      { transform: flightKeys[1].transform, offset: .74, easing: "cubic-bezier(.3,0,.3,1)" },
      { transform: flightKeys[0].transform }
    ];
    fly.animate(back, { duration: dur(700), delay: dur(120), fill: "forwards" }).onfinish = finish;
  }

  document.addEventListener("keydown", function (e) {
    if (!layers) return;
    if (e.key === "Escape") { e.preventDefault(); closeBook(); return; }
    if (e.key === "Tab") {
      var f = layers.panel.querySelectorAll('button, [href], textarea, input');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !layers.panel.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ───────────── reading sheet ───────────── */
  var savedName = "";
  try { savedName = localStorage.getItem("books-note-name") || ""; } catch (err) {}
  function rememberName(n) { savedName = n; try { localStorage.setItem("books-note-name", n); } catch (err) {} }

  function noteHTML(n) {
    return '<article class="note' + (n.pending ? " pending" : "") + '" data-note="' + n.id + '">' + yarnBall(n.name) +
      '<div class="nh"><span class="who">' + esc(n.name) + '</span>' + (n.dana ? '<span class="author-tag">author</span>' : "") +
      '<span class="ago">' + esc(n.ago) + '</span></div>' +
      '<div class="body-wrap"><p>' + (n.replyTo ? '<span class="at">@' + esc(n.replyTo) + '</span> ' : "") + esc(n.body).replace(/\n/g, "<br>") + '</p></div>' +
      (n.pending ? '<div class="pending-tag">waiting for dana to read it ✎</div>' :
        '<div class="actions"><button type="button" class="linkish" data-reply="' + n.id + '" data-name="' + esc(n.name) + '">reply</button></div>') +
      '</article>';
  }
  function notesListHTML(b) {
    if (!b.notes.length) return '<p class="empty"><span class="hand">no margin notes yet</span>Be the first to leave one.</p>';
    return '<ol class="notes">' + b.notes.map(function (n) {
      return '<li class="thread' + (n.replies.length ? " has-replies" : "") + '">' + noteHTML(n) +
        (n.replies.length ? '<ol class="replies">' + n.replies.map(function (r) { return '<li>' + noteHTML(r) + '</li>'; }).join("") + '</ol>' : "") + '</li>';
    }).join("") + '</ol>';
  }
  function composerHTML(idp, placeholder, btn) {
    return '<div class="composer"><label class="sr" for="' + idp + '-body">Your note</label>' +
      '<textarea id="' + idp + '-body" rows="1" maxlength="2000" placeholder="' + esc(placeholder) + '"></textarea>' +
      '<div class="row2"><label class="sr" for="' + idp + '-name">Your name</label>' +
      '<input type="text" id="' + idp + '-name" maxlength="40" placeholder="your name" value="' + esc(savedName) + '">' +
      '<button type="submit" class="pin">' + btn + '</button></div></div><p class="err" hidden></p>';
  }
  function autogrow(ta) { ta.addEventListener("input", function () { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; }); }

  function buildPanel(b) {
    var el = document.createElement("aside");
    el.className = "panel";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "p-title");
    var when = b.month >= 0 ? (b.reading ? "started " : b.dnf ? "put down " : "read ") + MONTHS[b.month] + " " + b.year : "";
    el.innerHTML =
      '<div class="grab" aria-hidden="true"></div>' +
      '<button type="button" class="close" aria-label="Put the book back">×</button>' +
      '<div class="panel-scroll">' +
        '<h2 class="p-title" id="p-title" tabindex="-1">' + esc(b.title) + '</h2>' +
        '<p class="p-author">' + esc(b.author) + '</p>' +
        (b.series ? '<p class="series">' + esc(b.series) + '</p>' : "") +
        '<div class="meta">' +
          (b.reading ? '<span class="pill">currently reading</span>' : b.dnf ? '<span class="pill">didn\'t finish</span>' :
            b.rating ? '<span class="stars" aria-label="rated ' + b.rating + ' of 5">' + stars(b.rating) + '</span>' : "") +
          (when ? '<span>' + when + '</span>' : "") + (b.pages ? '<span>' + b.pages + ' pages</span>' : "") +
          '<a href="' + esc(b.url) + '">goodreads ↗</a>' +
        '</div>' +
        (b.review ? '<section class="review" aria-label="Dana\'s review"><span class="tape" aria-hidden="true"></span><div class="card">' +
          '<div class="hand">dana\'s notes</div><div class="rv">' + b.review + '</div></div></section>' : "") +
        (NOTES_API ?
          '<div class="notes-head"><h3>Margin notes</h3><span class="count">' + approvedCount(b) + '</span></div>' +
          '<div class="notes-wrap">' + notesListHTML(b) + '</div>' :
          '<p class="notes-soon"><span class="hand">margin notes are coming soon</span>You\'ll be able to leave a note on any book here.</p>') +
      '</div>' +
      (NOTES_API ? '<form class="compose" novalidate>' + composerHTML("note", "leave a note in the margin…", "pin it") +
        '<p class="fine">notes appear once dana approves them · be kind</p></form>' : "");

    el.querySelector(".close").addEventListener("click", function () { closeBook(); });
    if (!NOTES_API) return el;
    autogrow(el.querySelector("#note-body"));
    el.querySelector(".compose").addEventListener("submit", function (e) {
      e.preventDefault();
      var body = el.querySelector("#note-body"), name = el.querySelector("#note-name"), err = el.querySelector(".compose .err");
      if (!body.value.trim() || !name.value.trim()) { err.textContent = !body.value.trim() ? "Write something first." : "Add a name so Dana knows who it's from."; err.hidden = false; return; }
      err.hidden = true;
      var n = { id: Date.now(), name: name.value.trim(), body: body.value.trim(), ago: "just now", replies: [], pending: true };
      b.notes.push(n); rememberName(n.name);
      body.value = ""; body.style.height = "auto";
      refreshNotes(el, b, n.id);
    });
    el.addEventListener("click", function (e) {
      var r = e.target.closest("[data-reply]"); if (!r) return;
      openReply(el, b, +r.dataset.reply, r.dataset.name, r.closest(".note"));
    });
    return el;
  }

  function findTop(b, id) {
    for (var i = 0; i < b.notes.length; i++) {
      if (b.notes[i].id === id) return b.notes[i];
      for (var j = 0; j < b.notes[i].replies.length; j++) if (b.notes[i].replies[j].id === id) return b.notes[i];
    }
    return null;
  }
  function openReply(panel, b, noteId, name, noteEl) {
    var existing = panel.querySelector(".reply-form"); if (existing) existing.remove();
    var f = document.createElement("form");
    f.className = "reply-form"; f.noValidate = true; f.style.gridColumn = "2";
    f.innerHTML = composerHTML("reply", "reply to " + name + "…", "pin reply");
    noteEl.appendChild(f);
    var ta = f.querySelector("textarea"); autogrow(ta); ta.focus();
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var body = ta.value.trim(), nm = f.querySelector("input").value.trim(), err = f.querySelector(".err");
      if (!body || !nm) { err.textContent = !body ? "Write something first." : "Add a name so Dana knows who it's from."; err.hidden = false; return; }
      var top = findTop(b, noteId); if (!top) return;
      var r = { id: Date.now(), name: nm, body: body, ago: "just now", pending: true, replyTo: top.id === noteId ? null : name };
      top.replies.push(r); rememberName(nm);
      refreshNotes(panel, b, r.id);
    });
  }
  function refreshNotes(panel, b, newId) {
    panel.querySelector(".notes-wrap").innerHTML = notesListHTML(b);
    var el = panel.querySelector('[data-note="' + newId + '"]');
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: reduceMotion.matches ? "auto" : "smooth" });
      if (!reduceMotion.matches) el.animate([
        { transform: "translateY(-14px) rotate(-2deg) scale(1.02)", opacity: 0 },
        { transform: "translateY(3px) rotate(.5deg)", opacity: 1, offset: .65 },
        { transform: "none", opacity: 1 }
      ], { duration: dur(480), easing: "cubic-bezier(.3,.7,.4,1)" });
    }
    document.getElementById("live").textContent = "Note pinned. It will appear publicly once Dana approves it.";
  }

  /* ───────────── filters + deep links ───────────── */
  var filters = document.getElementById("filters");
  filters.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-f]"); if (!btn) return;
    filters.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === btn)); });
    shelvesEl.classList.remove("f-loved", "f-dnf");
    filterMode = btn.dataset.f; renderShelves();
    if (btn.dataset.f !== "all") shelvesEl.classList.add("f-" + btn.dataset.f);
    document.getElementById("live").textContent = btn.dataset.f === "loved" ? "Highlighting " + lovedN + " four and five star books." :
      btn.dataset.f === "dnf" ? "Highlighting " + dnfN + " unfinished books." : "Showing all books.";
  });

  var m = /^#b-(\d+)$/.exec(location.hash || "");
  if (m && BOOKS[m[1]]) setTimeout(function () { openBook(m[1]); }, 400);
})();
