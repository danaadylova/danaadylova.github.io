(function () {
  var KEY = "garden-sound";
  var enabled = false;
  try { enabled = localStorage.getItem(KEY) === "on"; } catch (e) {}
  var ctx = null;

  var P = {
    filter: "lowpass",
    cutoff: 1500,
    q: 0.7,
    dur: 0.07,
    envPow: 2.2,
    noiseGain: 0.24,
    clickGain: 0,
    thumpGain: 0.25,
    deepScale: 0.5,
  };

  function audio() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function thock(deep, fromUser) {
    if (!enabled) return;
    var ac = audio();
    if (ac.state === "suspended") {
      if (!fromUser) return;
      ac.resume();
    }
    var t = ac.currentTime;
    var cutoff = (deep ? P.cutoff * P.deepScale : P.cutoff) + Math.random() * 300;

    var buf = ac.createBuffer(1, Math.floor(ac.sampleRate * P.dur), ac.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, P.envPow);
    }
    var noise = ac.createBufferSource();
    noise.buffer = buf;
    var f = ac.createBiquadFilter();
    f.type = P.filter;
    f.frequency.value = cutoff;
    f.Q.value = P.q;
    var ng = ac.createGain();
    ng.gain.value = P.noiseGain + Math.random() * 0.06;
    noise.connect(f);
    f.connect(ng);
    ng.connect(ac.destination);
    noise.start(t);

    if (P.clickGain > 0) {
      var cbuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.004), ac.sampleRate);
      var cd = cbuf.getChannelData(0);
      for (var j = 0; j < cd.length; j++) cd[j] = (Math.random() * 2 - 1) * (1 - j / cd.length);
      var click = ac.createBufferSource();
      click.buffer = cbuf;
      var cg = ac.createGain();
      cg.gain.value = P.clickGain;
      click.connect(cg);
      cg.connect(ac.destination);
      click.start(t);
    }

    var osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime((deep ? 85 : 120) + Math.random() * 15, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.06);
    var og = ac.createGain();
    og.gain.setValueAtTime(P.thumpGain, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(og);
    og.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  document.addEventListener("keydown", function (e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    thock(e.code === "Space" || e.key === "Enter", true);
  });

  var btn = document.getElementById("sound-toggle");
  function label() {
    if (btn) btn.textContent = "typing sounds: " + (enabled ? "on" : "off");
  }
  if (btn) {
    label();
    btn.addEventListener("click", function () {
      enabled = !enabled;
      try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch (e) {}
      label();
      if (enabled) thock(false, true);
    });
  }

  window.gardenThock = thock; // the 3D keyboard plays the same sound when its keys are clicked

  var targets = Array.prototype.slice.call(document.querySelectorAll("[data-typed]"));
  var prompt = document.getElementById("typed");

  // The 3D keyboard (keyboard.js, on the home and blog pages) presses a key for every character
  // of the text marked data-kb-type. It loads after this file, so typing waits for it (or gives up
  // after 2.5 s); meanwhile that text is blanked so it doesn't show, vanish and type again.
  var kb = document.querySelector("[data-kb]") ? "waiting" : "none";
  if (kb === "waiting") targets.forEach(function (el) {
    if (!el.hasAttribute("data-kb-type")) return;
    if (!el.hasAttribute("data-text")) el.setAttribute("data-text", el.textContent);
    el.textContent = "";
    el.classList.add("typing");
  });
  var kbQueued = null;
  function kbSettled(state) {
    if (kb !== "waiting") return;
    kb = state;
    if (kbQueued) { var go = kbQueued; kbQueued = null; go(); }
  }
  if (kb === "waiting") {
    document.addEventListener("kb:ready", function () { kbSettled("ready"); });
    document.addEventListener("kb:skip", function () { kbSettled("none"); });
    setTimeout(function () { kbSettled("none"); }, 2500);
  }
  function kbKey(ch) {
    if (kb === "ready") document.dispatchEvent(new CustomEvent("garden:key", { detail: { ch: ch } }));
  }

  function typeOut(el) {
    var chars = Array.from(el.getAttribute("data-text") || el.textContent);
    var isPrompt = el === prompt;
    var withKb = el.hasAttribute("data-kb-type");
    var base = isPrompt || withKb ? 85 : 45;
    var jitter = isPrompt || withKb ? 95 : 40;
    el.textContent = "";
    el.classList.add("typing");
    var i = 0;
    (function step() {
      if (i < chars.length) {
        el.textContent += chars[i];
        if (withKb) kbKey(chars[i]);
        thock(chars[i] === " ", false);
        i++;
        setTimeout(step, base + Math.random() * jitter);
      } else if (isPrompt && kb === "ready") {
        // press enter, then the listing appears
        setTimeout(function () {
          kbKey("\n");
          thock(true, false);
          setTimeout(function () { document.body.classList.add("typed-done"); }, 180);
        }, 420);
      } else if (isPrompt) {
        document.body.classList.add("typed-done");
      } else {
        el.classList.remove("typing");
      }
    })();
  }

  if (!targets.length) {
    document.body.classList.add("typed-done");
  } else {
    var started = false;
    function startTyping() {
      if (started) return;
      if (kb === "waiting") { kbQueued = startTyping; return; }
      started = true;
      targets.forEach(typeOut);
    }
    function unlock() {
      audio().resume();
      startTyping();
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    if (!enabled) {
      startTyping();
    } else {
      var ac = audio();
      var p = ac.resume();
      if (p && p.then) p.then(function () { if (ac.state === "running") startTyping(); });
      setTimeout(startTyping, 1000);
    }
  }
})();
