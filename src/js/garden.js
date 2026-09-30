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

  // the footer's "typing sounds: off" text button, or the home page's switch (role="switch")
  var toggles = Array.prototype.slice.call(document.querySelectorAll("#sound-toggle, [data-sound-switch]"));
  function label() {
    toggles.forEach(function (b) {
      if (b.getAttribute("role") === "switch") b.setAttribute("aria-checked", String(enabled));
      else b.textContent = "typing sounds: " + (enabled ? "on" : "off");
    });
  }
  label();
  toggles.forEach(function (b) {
    b.addEventListener("click", function () {
      enabled = !enabled;
      try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch (e) {}
      label();
      if (enabled) thock(false, true);
    });
  });

  // ── retro mode: the whole site goes dark and lamp-lit (html.retro in garden.css; base.njk applies a
  // remembered choice before the page paints). On the home page it also swaps the keyboard for the
  // typewriter. Switches: the home page's role="switch" buttons, or the footer's "retro mode: off".
  var RKEY = "garden-retro", root = document.documentElement;
  var retroToggles = Array.prototype.slice.call(document.querySelectorAll("[data-retro-switch], #retro-toggle"));
  function retroLabel() {
    var on = root.classList.contains("retro");
    retroToggles.forEach(function (b) {
      if (b.getAttribute("role") === "switch") b.setAttribute("aria-checked", String(on));
      else { b.textContent = "retro mode: " + (on ? "on" : "off"); b.setAttribute("aria-pressed", String(on)); }
    });
  }
  retroLabel();
  retroToggles.forEach(function (b) {
    b.addEventListener("click", function () {
      var on = !root.classList.contains("retro");
      root.classList.add("retro-fade");
      root.classList.toggle("retro", on);
      retroLabel();
      try { localStorage.setItem(RKEY, on ? "on" : "off"); } catch (e) {}
      setTimeout(function () { root.classList.remove("retro-fade"); }, 700);
      document.dispatchEvent(new CustomEvent("garden:retro", { detail: { on: on } }));
      // home page: whichever machine just appeared types the prompt again
      var ready = on ? (window.gardenTypewriter ? window.gardenTypewriter.start() : false) : true;
      if (ready && window.gardenRetype) setTimeout(window.gardenRetype, 450);
    });
  });

  window.gardenThock = thock; // the 3D keyboard plays the same sound when its keys are clicked
  // the typewriter makes its own sounds (clack, bell, ratchet) through the same switch and audio context
  window.gardenSound = { on: function () { return enabled; }, ctx: audio };

  var targets = Array.prototype.slice.call(document.querySelectorAll("[data-typed]"));
  var prompt = document.getElementById("typed");

  // The home page keyboard (keyboard.js) presses a key for every character of the prompt.
  // It loads after this file, so the prompt waits for it (or gives up after 2.5 s).
  var kb = document.querySelector("[data-kb]") ? "waiting" : "none";
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

  var promptBusy = false;
  function typeOut(el) {
    var chars = Array.from(el.getAttribute("data-text") || el.textContent);
    var isPrompt = el === prompt;
    if (isPrompt) promptBusy = true;
    var base = isPrompt ? 85 : 45;
    var jitter = isPrompt ? 95 : 40;
    el.textContent = "";
    el.classList.add("typing");
    var i = 0;
    (function step() {
      if (i < chars.length) {
        el.textContent += chars[i];
        if (isPrompt) kbKey(chars[i]);
        thock(chars[i] === " ", false);
        i++;
        setTimeout(step, base + Math.random() * jitter);
      } else if (isPrompt && kb === "ready") {
        // press enter, then the listing appears
        setTimeout(function () {
          kbKey("\n");
          thock(true, false);
          setTimeout(function () { document.body.classList.add("typed-done"); promptBusy = false; }, 180);
        }, 420);
      } else if (isPrompt) {
        document.body.classList.add("typed-done");
        promptBusy = false;
      } else {
        el.classList.remove("typing");
      }
    })();
  }

  // retro mode (retro.js) swaps the keyboard for the typewriter, which then types the prompt again
  window.gardenRetype = function () {
    if (!prompt || promptBusy) return;
    kb = "ready";
    typeOut(prompt);
  };

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
