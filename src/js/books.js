/* /books — bookshelf. Built from docs/prd-books.md §6 (prototype v9). Data: #books-data (src/_data/books.js). */
(function () {
  "use strict";

  /* ───────────── data (rendered into the page by src/_data/books.js) ───────────── */
  var dataEl = document.getElementById("books-data");
  var shelvesEl = document.getElementById("shelves");
  if (!dataEl || !shelvesEl) return;
  var DATA = JSON.parse(dataEl.textContent);
  var CARDS = DATA.cards || [];
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
      w: o.w, h: o.h, font: o.f, variant: o.v, cover: o.cv || null, ar: o.ar || .66, url: o.u,
      noteCount: o.nc || 0, staticNotes: o.nn || null, hasDana: !!o.dn };
    BOOKS[b.id] = b;
    return b;
  }
  DATA.years.forEach(function (y) { YEARS.push({ year: y.year, books: y.books.map(mk) }); });
  NOW = DATA.reading.map(function (o) { var b = mk(o); b.reading = true; b.h = 176; return b; });
  var lovedN = DATA.lovedTotal, dnfN = DATA.dnfTotal;
  var NOTES_API = DATA.notesApi || null; // margin notes API (PRD §7): unraveled.makes /site

  /* ───────────── helpers ───────────── */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function dur(ms) { return ms; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function lastName(a) { var p = a.split(" "); return p[p.length - 1]; }
  function approvedCount(b) { return b.noteCount || 0; }
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
      (b.review || b.hasDana ? '<span class="ribbon" aria-hidden="true"></span>' : "") +
      (cnt ? '<span class="slip" aria-hidden="true"></span>' : "") + '</button>';
  }

  var FOLD_ROWS = 2, expanded = {}, filterMode = "all";
  function renderShelves() {
    var k = scaleFactor();
    var pad = window.innerWidth < 480 ? 20 : 36;
    var avail = Math.max(220, shelvesEl.clientWidth - pad);
    var html = "";
    var mh = Math.round(176 * k), ms = mh / 176;
    html += '<section class="year now" aria-labelledby="ynow"><div class="year-head"><h2 class="yr words" id="ynow" tabindex="-1">' +
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
      html += '<section class="year" aria-labelledby="y' + y.year + '"><div class="year-head"><h2 class="yr" id="y' + y.year + '" tabindex="-1">' + y.year + '</h2>' +
        '<span class="ym">' + y.books.length + ' books' + (flat.length ? " · " + flat.length + " unfinished" : "") + '</span>' +
        (CARDS.indexOf(y.year) >= 0 ? '<a class="cardlink" href="/books/' + y.year + '/">reading card →</a>' : "") +
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

  var dropIO = null;
  function dropIn() {
    if (reduceMotion.matches) return;
    var io = dropIO = new IntersectionObserver(function (entries) {
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

  /* "jump to" a year: the page glides there, and that shelf's books slide in from the right, one after another */
  var gliding = 0;
  function glideTo(target, done) {
    var y0 = window.scrollY, y1 = Math.max(0, Math.min(target, document.documentElement.scrollHeight - window.innerHeight));
    var dist = Math.abs(y1 - y0), ms = Math.min(1100, 450 + dist * 0.25), t0 = null, id = ++gliding;
    var ease = function (u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
    function stop() { gliding++; ["wheel", "touchstart", "keydown"].forEach(function (e) { window.removeEventListener(e, stop); }); }
    ["wheel", "touchstart", "keydown"].forEach(function (e) { window.addEventListener(e, stop, { passive: true, once: true }); });   // a visitor scrolling takes over
    (function frame(now) {
      if (id !== gliding) return;
      if (t0 === null) t0 = now;
      var u = Math.min(1, (now - t0) / ms);
      window.scrollTo(0, y0 + (y1 - y0) * ease(u));
      if (u < 1) requestAnimationFrame(frame); else { stop(); if (done) done(); }
    })(performance.now());
    return ms;
  }
  function slideShelf(sec, delay) {
    sec.querySelectorAll(".row").forEach(function (r, ri) {
      if (dropIO) dropIO.unobserve(r);   // it slides instead of dropping in
      var items = r.querySelectorAll(".slot, .pile, .bookend"), step = Math.min(28, 520 / Math.max(1, items.length));
      items.forEach(function (it, i) {
        it.animate([
          { transform: "translateX(120px)", opacity: 0 },
          { transform: "translateX(-4px)", opacity: 1, offset: 0.78 },
          { transform: "translateX(0)", opacity: 1 }
        ], { duration: dur(520), delay: dur(delay + ri * 90 + i * step), easing: "cubic-bezier(.25,.7,.35,1)", fill: "backwards" });
      });
    });
    var yr = sec.querySelector(".yr");
    if (yr) {   // the underline sweeps in once the shelf is on screen
      yr.classList.remove("arrived");
      setTimeout(function () { yr.classList.add("arrived"); setTimeout(function () { yr.classList.remove("arrived"); }, 1600); }, dur(delay) + 200);
    }
  }
  function jumpTo(id) {
    var h = document.getElementById(id), sec = h && h.closest(".year");
    if (!sec) return false;
    var top = sec.getBoundingClientRect().top + window.scrollY - 24;
    try { history.replaceState(null, "", "#" + id); } catch (e) {}
    if (reduceMotion.matches) { window.scrollTo(0, top); h.focus({ preventScroll: true }); return true; }
    var ms = glideTo(top, function () { h.focus({ preventScroll: true }); });
    slideShelf(sec, Math.max(0, ms - 380));   // the books start arriving as the glide settles
    return true;
  }
  document.getElementById("jump") && document.getElementById("jump").addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#y"]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (jumpTo(a.getAttribute("href").slice(1))) e.preventDefault();
  });

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
    document.addEventListener("garden:retro", rgb);   // retro mode switches the palette too
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

  /* ───────────── reading sheet + margin notes (API: PRD §7, unraveled.makes /site/*) ───────────── */
  var savedName = "";
  try { savedName = localStorage.getItem("books-note-name") || ""; } catch (err) {}
  function rememberName(n) { savedName = n; try { localStorage.setItem("books-note-name", n); } catch (err) {} }
  var AUTHOR = false;
  var live = document.getElementById("live");

  function api(path, opts) {
    opts = opts || {};
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 20000); // never leave "pin it" hanging
    return fetch(NOTES_API + path, {
      method: opts.method || "GET", credentials: "include", signal: ctrl ? ctrl.signal : undefined,
      headers: opts.body ? { "Content-Type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error((j.detail && j.detail.message) || "Something went wrong. Try again in a bit."); e.status = r.status; throw e; }
        return j;
      });
    }, function (e) {
      throw new Error(e && e.name === "AbortError" ? "The notes server is taking too long. Try again in a minute." : "Couldn't reach the notes right now. Try again in a bit.");
    }).finally(function () { if (timer) clearTimeout(timer); });
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (c) { return (c ^ (Math.random() * 16) >> (c / 4)).toString(16); });
  }
  function ago(iso) {
    var s = (Date.now() - Date.parse(iso)) / 1000;
    if (s < 90) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    if (s < 86400 * 2) return "yesterday";
    if (s < 86400 * 14) return Math.round(s / 86400) + " days ago";
    var d = new Date(iso);
    return MONTHS[d.getMonth()] + " " + d.getDate() + (d.getFullYear() !== new Date().getFullYear() ? ", " + d.getFullYear() : "");
  }
  function fullDate(iso) { var d = new Date(iso); return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear(); }
  function textHTML(s) { return esc(s).replace(/\n/g, "<br>"); }

  /* Your own not-yet-approved notes, kept in this browser so they survive a reload. */
  function localPending(bookId) {
    try {
      var all = JSON.parse(localStorage.getItem("books-pending") || "{}"), month = 30 * 86400000;
      return (all[bookId] || []).filter(function (n) { return n.key && Date.now() - Date.parse(n.created_at) < month; });
    } catch (err) { return []; }
  }
  function saveLocalPending(bookId, list) {
    try { var all = JSON.parse(localStorage.getItem("books-pending") || "{}"); all[bookId] = list; localStorage.setItem("books-pending", JSON.stringify(all)); } catch (err) {}
  }

  /* API/static list → { dana: [my top-level notes, newest first], threads: [visitor threads, oldest first] } */
  function splitThread(b, comments) {
    var dana = [], threads = [], seen = {};
    comments.forEach(function (c) {
      seen[c.id] = 1; (c.replies || []).forEach(function (r) { seen[r.id] = 1; });
      if (c.is_author) dana.push(c); else threads.push(c);
    });
    if (!AUTHOR) {
      var mine = localPending(b.id).filter(function (n) { return !seen[n.id]; });
      saveLocalPending(b.id, mine);
      mine.forEach(function (n) {
        var p = { id: n.id, name: n.name, body: n.body, created_at: n.created_at, reply_to_name: n.reply_to_name, status: "pending", mine: true, replies: [] };
        var top = n.parent_id && threads.filter(function (t) { return t.id === n.parent_id; })[0];
        if (top) top.replies.push(p); else if (!n.parent_id) threads.push(p);
      });
    }
    dana.sort(function (a, c) { return Date.parse(c.created_at) - Date.parse(a.created_at); });
    return { dana: dana, threads: threads };
  }

  function modButtons(n) {
    if (!AUTHOR || n.is_author) return "";
    if (n.status === "pending") return '<button type="button" class="linkish" data-mod="approve" data-id="' + n.id + '">approve</button> · <button type="button" class="linkish" data-mod="reject" data-id="' + n.id + '">reject</button>';
    return '<button type="button" class="linkish" data-mod="hide" data-id="' + n.id + '">hide</button>';
  }
  function noteHTML(n, top) {
    var pending = n.status === "pending";
    return '<article class="note' + (pending ? " pending" : "") + '" data-note="' + n.id + '">' + yarnBall(n.name) +
      '<div class="nh"><span class="who">' + esc(n.name) + '</span>' + (n.is_author ? '<span class="author-tag">author</span>' : "") +
      '<span class="ago" title="' + fullDate(n.created_at) + '">' + ago(n.created_at) + '</span></div>' +
      '<div class="body-wrap"><p>' + (n.reply_to_name ? '<span class="at">@' + esc(n.reply_to_name) + '</span> ' : "") + textHTML(n.body) + '</p></div>' +
      (pending && !AUTHOR ? '<div class="pending-tag">waiting for dana to read it ✎</div>' : "") +
      '<div class="actions">' + (!pending ? '<button type="button" class="linkish" data-reply="' + n.id + '" data-top="' + top.id + '" data-name="' + esc(n.name) + '">reply</button>' : "") +
        (modButtons(n) ? (!pending ? " · " : "") + modButtons(n) : "") +
        (AUTHOR && n.is_author ? ' · <button type="button" class="linkish" data-edit="' + n.id + '">edit</button> · <button type="button" class="linkish" data-del="' + n.id + '">delete</button>' : "") +
      '</div></article>';
  }
  function threadsHTML(t) {
    if (!t.threads.length) return '<p class="empty"><span class="hand">no margin notes yet</span>Be the first to leave one.</p>';
    return '<ol class="notes">' + t.threads.map(function (n) {
      var reps = n.replies || [];
      return '<li class="thread' + (reps.length ? " has-replies" : "") + '">' + noteHTML(n, n) +
        (reps.length ? '<ol class="replies">' + reps.map(function (r) { return '<li>' + noteHTML(r, n) + '</li>'; }).join("") + '</ol>' : "") + '</li>';
    }).join("") + '</ol>';
  }
  function danaCardHTML(b, t) {
    var entries = (t ? t.dana : []);
    if (!b.review && !entries.length) return "";
    return '<section class="review" aria-label="Dana\'s notes"><span class="tape" aria-hidden="true"></span><div class="card">' +
      '<div class="hand">dana\'s notes</div>' + (b.review ? '<div class="rv">' + b.review + '</div>' : "") +
      entries.map(function (n) {
        return '<article class="dn-entry" data-note="' + n.id + '"><div class="when">' + fullDate(n.created_at) + (n.edited_at ? " · edited" : "") + '</div>' +
          '<div class="dn-body"><p>' + textHTML(n.body) + '</p></div>' +
          (AUTHOR ? '<div class="actions"><button type="button" class="linkish" data-edit="' + n.id + '">edit</button> · <button type="button" class="linkish" data-del="' + n.id + '">delete</button></div>' : "") +
          '</article>';
      }).join("") + '</div></section>';
  }
  function composerHTML(idp, placeholder, btn) {
    return '<div class="composer"><label class="sr" for="' + idp + '-body">Your note</label>' +
      '<textarea id="' + idp + '-body" rows="1" maxlength="2000" placeholder="' + esc(placeholder) + '"></textarea>' +
      '<div class="row2">' + (AUTHOR ? '<span class="as-dana">as dana</span>' :
        '<label class="sr" for="' + idp + '-name">Your name</label><input type="text" id="' + idp + '-name" maxlength="40" placeholder="your name" value="' + esc(savedName) + '">') +
      '<div class="hp" aria-hidden="true"><input type="text" name="hp_margin_x" tabindex="-1" autocomplete="off" data-lpignore="true" data-1p-ignore aria-label="leave empty"></div>' +
      '<button type="submit" class="pin">' + btn + '</button></div></div><p class="err" role="alert" hidden></p>';
  }
  function autogrow(ta) { ta.addEventListener("input", function () { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; }); }

  function renderNotes(panel, b) {
    var t = b.thread;
    var dana = panel.querySelector(".dana-slot"), wrap = panel.querySelector(".notes-wrap"), count = panel.querySelector(".notes-head .count");
    if (dana) dana.innerHTML = danaCardHTML(b, t);
    if (!wrap) return;
    if (!t) { wrap.innerHTML = '<div class="skeleton" aria-hidden="true"><i></i><i></i><i></i></div>'; return; }
    wrap.innerHTML = threadsHTML(t);
    if (count) count.textContent = t.threads.filter(function (n) { return n.status !== "pending"; }).length;
  }

  /* Your pinned notes are kept in this browser until approved; ask the server whether they're still
     waiting, so a rejected or hidden note stops showing "waiting for dana". */
  function checkMine(panel, b, comments) {
    var local = localPending(b.id);
    if (!local.length) return;
    api("/books/comments/mine", { method: "POST", body: { keys: local.map(function (n) { return n.key; }) } }).then(function (j) {
      var known = j.notes || {};
      var still = local.filter(function (n) { return known[n.key] && known[n.key].status === "pending"; });
      if (still.length === local.length) return;
      saveLocalPending(b.id, still);
      b.thread = splitThread(b, comments);
      if (panel.isConnected) renderNotes(panel, b);
    }).catch(function () {});
  }

  function loadThread(panel, b) {
    if (b.staticNotes && !b.thread) b.thread = splitThread(b, b.staticNotes);
    renderNotes(panel, b);
    return api("/books/" + b.id + "/comments").then(function (j) {
      AUTHOR = !!j.author;
      b.thread = splitThread(b, j.comments || []);
      if (!AUTHOR) checkMine(panel, b, j.comments || []);
      b.noteCount = b.thread.threads.filter(function (n) { return n.status !== "pending"; }).length;
      if (panel.isConnected) { renderNotes(panel, b); syncComposer(panel, b); }
    }).catch(function (err) {
      if (!b.thread) b.thread = splitThread(b, []);
      if (!panel.isConnected) return;
      renderNotes(panel, b);
      var w = panel.querySelector(".notes-wrap");
      w.insertAdjacentHTML("afterbegin", '<p class="notes-err">' + esc(err.message) + ' <button type="button" class="linkish" data-retry>retry</button></p>');
    });
  }

  function syncComposer(panel, b) {
    var f = panel.querySelector("form.compose"); if (!f) return;
    var wasAuthor = f.dataset.author === "1";
    if (wasAuthor === AUTHOR && f.dataset.ready) return;
    f.innerHTML = composerHTML("note", AUTHOR ? "add to dana's notes…" : "leave a note in the margin…", AUTHOR ? "add" : "pin it") +
      '<p class="fine">' + (AUTHOR ? "your notes appear right away, pinned at the top" : "notes appear once dana approves them · be kind") + '</p>';
    f.dataset.author = AUTHOR ? "1" : "0"; f.dataset.ready = "1";
    autogrow(f.querySelector("textarea"));
  }

  function submitNote(form, b, panel, parentId, openedAt) {
    var ta = form.querySelector("textarea"), nameEl = form.querySelector('input[id$="-name"]'), err = form.querySelector(".err"), btn = form.querySelector(".pin");
    var body = ta.value.trim(), name = nameEl ? nameEl.value.trim() : "dana";
    if (!body || !name) { err.textContent = !body ? "Write something first." : "Add a name so Dana knows who it's from."; err.hidden = false; return; }
    err.hidden = true; btn.disabled = true;
    if (!form.dataset.key) form.dataset.key = uuid(); // same key on retry → never posted twice
    var sentKey = form.dataset.key;
    api("/books/" + b.id + "/comments", { method: "POST", body: {
      name: name, body: body, parent_id: parentId || null, client_key: form.dataset.key,
      website: form.querySelector('input[name="hp_margin_x"]').value, elapsed_ms: Date.now() - openedAt
    } }).then(function (j) {
      btn.disabled = false; delete form.dataset.key;
      if (!j.id) { // the server's spam check dropped it: say so instead of pretending it was pinned
        form.querySelector('input[name="hp_margin_x"]').value = ""; // in case autofill put something there
        err.textContent = "That note didn't go through. Wait a few seconds and press “pin it” again."; err.hidden = false; return;
      }
      if (!AUTHOR) rememberName(name);
      ta.value = ""; ta.style.height = "auto";
      var created = j.comment || { id: j.id, name: name, body: body, created_at: new Date().toISOString(), status: "pending", parent_id: parentId || null };
      if (j.status === "pending" && j.id) {
        var mine = localPending(b.id); mine.push({ id: j.id, key: sentKey, name: name, body: body, parent_id: parentId || null, created_at: new Date().toISOString() }); saveLocalPending(b.id, mine);
      }
      if (!b.thread) b.thread = splitThread(b, []);
      if (created.is_author && !created.parent_id) b.thread.dana.unshift(created);
      else {
        var n = Object.assign({ replies: [] }, created, { status: j.status });
        if (parentId) { var top = b.thread.threads.filter(function (t) { return t.id === parentId || (t.replies || []).some(function (r) { return r.id === parentId; }); })[0]; if (top) top.replies.push(n); }
        else b.thread.threads.push(n);
      }
      renderNotes(panel, b);
      var el = panel.querySelector('[data-note="' + created.id + '"]');
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: reduceMotion.matches ? "auto" : "smooth" });
        if (!reduceMotion.matches) el.animate([
          { transform: "translateY(-14px) rotate(-2deg) scale(1.02)", opacity: 0 },
          { transform: "translateY(3px) rotate(.5deg)", opacity: 1, offset: .65 },
          { transform: "none", opacity: 1 }
        ], { duration: 480, easing: "cubic-bezier(.3,.7,.4,1)" });
      }
      if (form.classList.contains("reply-form")) form.remove();
      live.textContent = j.status === "approved" ? "Note added." : "Note pinned. It will appear publicly once Dana approves it.";
    }, function (e) { btn.disabled = false; err.textContent = e.message; err.hidden = false; });
  }

  function buildPanel(b) {
    var el = document.createElement("aside");
    var openedAt = Date.now();
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
        '<div class="dana-slot">' + danaCardHTML(b, b.thread || (b.staticNotes ? splitThread(b, b.staticNotes) : null)) + '</div>' +
        (NOTES_API ?
          '<div class="notes-head"><h3>Margin notes</h3><span class="count">' + approvedCount(b) + '</span></div><div class="notes-wrap"></div>' :
          '<p class="notes-soon"><span class="hand">margin notes are coming soon</span>You\'ll be able to leave a note on any book here.</p>') +
      '</div>' +
      (NOTES_API ? '<form class="compose" novalidate></form>' : "");

    el.querySelector(".close").addEventListener("click", function () { closeBook(); });
    if (!NOTES_API) return el;
    syncComposer(el, b);
    loadThread(el, b);

    el.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      submitNote(f, b, el, f.classList.contains("reply-form") ? +f.dataset.parent : null, openedAt);
    });
    el.addEventListener("click", function (e) {
      var t;
      if ((t = e.target.closest("[data-retry]"))) { t.parentNode.remove(); loadThread(el, b); return; }
      if ((t = e.target.closest("[data-reply]"))) {
        var existing = el.querySelector(".reply-form"); if (existing) existing.remove();
        var f = document.createElement("form");
        f.className = "reply-form"; f.noValidate = true; f.style.gridColumn = "2"; f.dataset.parent = t.dataset.reply;
        f.innerHTML = composerHTML("reply", "reply to " + t.dataset.name + "…", "pin reply");
        t.closest(".note").appendChild(f);
        var ta = f.querySelector("textarea"); autogrow(ta); ta.focus();
        return;
      }
      if ((t = e.target.closest("[data-mod]"))) {
        var id = +t.dataset.id, action = t.dataset.mod;
        api("/books/comments/" + id + "/moderate", { method: "POST", body: { action: action } }).then(function () {
          b.thread.threads = b.thread.threads.filter(function (n) {
            if (n.id === id) { if (action === "approve") { n.status = "approved"; return true; } return false; }
            n.replies = (n.replies || []).filter(function (r) { if (r.id === id) { if (action === "approve") { r.status = "approved"; return true; } return false; } return true; });
            return true;
          });
          renderNotes(el, b); refreshAuthorBar();
          live.textContent = action === "approve" ? "Note approved." : action === "reject" ? "Note rejected." : "Note hidden.";
        }, function (err) { live.textContent = err.message; });
        return;
      }
      if ((t = e.target.closest("[data-del]"))) {
        if (!t.dataset.sure) { t.dataset.sure = "1"; t.textContent = "delete? tap again"; return; }
        var did = +t.dataset.del;
        api("/books/comments/" + did, { method: "DELETE" }).then(function () {
          b.thread.dana = b.thread.dana.filter(function (n) { return n.id !== did; });
          b.thread.threads.forEach(function (n) { n.replies = (n.replies || []).filter(function (r) { return r.id !== did; }); });
          renderNotes(el, b); live.textContent = "Note deleted.";
        }, function (err) { live.textContent = err.message; });
        return;
      }
      if ((t = e.target.closest("[data-edit]"))) {
        var eid = +t.dataset.edit, box = el.querySelector('[data-note="' + eid + '"] p');
        var all = b.thread.dana.concat.apply(b.thread.dana, b.thread.threads.map(function (n) { return n.replies || []; }));
        var note = all.filter(function (n) { return n.id === eid; })[0]; if (!box || !note) return;
        var ed = document.createElement("form"); ed.className = "edit-form";
        ed.innerHTML = '<div class="composer"><textarea rows="3" maxlength="2000">' + esc(note.body) + '</textarea><div class="row2"><button type="button" class="linkish" data-cancel>cancel</button><button type="submit" class="pin">save</button></div></div><p class="err" role="alert" hidden></p>';
        box.replaceWith(ed);
        ed.addEventListener("submit", function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          api("/books/comments/" + eid, { method: "PATCH", body: { body: ed.querySelector("textarea").value } }).then(function (j) {
            note.body = j.comment.body; note.edited_at = j.comment.edited_at; renderNotes(el, b); live.textContent = "Saved.";
          }, function (err) { var p = ed.querySelector(".err"); p.textContent = err.message; p.hidden = false; });
        });
        ed.querySelector("[data-cancel]").addEventListener("click", function () { renderNotes(el, b); });
      }
    });
    return el;
  }

  /* ───────────── author sign-in bar (bottom of the page) ───────────── */
  var authorBar = document.getElementById("authorBar");
  function refreshAuthorBar() {
    if (!authorBar || !NOTES_API) return;
    if (!AUTHOR) {
      authorBar.innerHTML = '<button type="button" class="linkish" id="signinOpen">sign in</button>';
      return;
    }
    authorBar.innerHTML = 'signed in as dana · <span id="pendingInfo"></span><button type="button" class="linkish" id="signout">sign out</button>';
    api("/books/comments/pending").then(function (j) {
      var n = j.comments.length, info = document.getElementById("pendingInfo");
      if (!info) return;
      if (!n) { info.innerHTML = "no notes waiting · "; return; }
      var ids = {}; j.comments.forEach(function (c) { ids[c.book_id] = (ids[c.book_id] || 0) + 1; });
      info.innerHTML = n + " note" + (n > 1 ? "s" : "") + " waiting: " + Object.keys(ids).map(function (id) {
        var bk = BOOKS[id]; return '<a href="#b-' + id + '" data-open="' + id + '">' + esc(bk ? bk.title : id) + (ids[id] > 1 ? " (" + ids[id] + ")" : "") + '</a>';
      }).join(", ") + " · ";
    }).catch(function () {});
  }
  if (authorBar && NOTES_API) {
    authorBar.addEventListener("click", function (e) {
      var t = e.target;
      if (t.id === "signinOpen") {
        authorBar.innerHTML = '<form id="signinForm" class="signin" novalidate><label for="signinEmail">your email</label> ' +
          '<input type="email" id="signinEmail" autocomplete="email" required> <button type="submit" class="pin">send sign-in link</button></form>';
        document.getElementById("signinEmail").focus();
      } else if (t.id === "signout") {
        api("/auth/logout", { method: "POST" }).then(function () { AUTHOR = false; refreshAuthorBar(); live.textContent = "Signed out."; });
      } else if (t.dataset && t.dataset.open) {
        e.preventDefault(); openBook(t.dataset.open);
      }
    });
    authorBar.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("signinEmail").value.trim();
      if (!email) return;
      api("/auth/request", { method: "POST", body: { email: email } }).then(function (j) {
        authorBar.textContent = j.message || "Check your inbox.";
      }, function (err) { authorBar.textContent = err.message; });
    });
    api("/me").then(function (j) {
      AUTHOR = !!j.author; refreshAuthorBar();
      if (AUTHOR && location.hash === "#signed-in") { live.textContent = "You're signed in."; try { history.replaceState(null, "", location.pathname); } catch (err) {} }
    }).catch(function () { refreshAuthorBar(); });
    api("/books/comments/counts").then(function (c) {
      Object.keys(BOOKS).forEach(function (id) { BOOKS[id].noteCount = c[id] || 0; });
      if (!openId) renderShelves();
    }).catch(function () {});
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
