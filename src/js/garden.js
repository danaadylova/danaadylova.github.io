(function () {
  var KEY = "garden-sound";
  var enabled = localStorage.getItem(KEY) !== "off";
  var ctx = null;

  var P = {
    filter: "lowpass",
    cutoff: 3500,
    q: 0.7,
    dur: 0.05,
    envPow: 3.0,
    noiseGain: 0.22,
    clickGain: 0.12,
    thumpGain: 0.16,
    deepScale: 0.45,
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

  document.addEventListener("pointerdown", function () {
    thock(false, true);
  });

  var btn = document.getElementById("sound-toggle");
  function label() {
    if (btn) btn.textContent = "sound: " + (enabled ? "on" : "off");
  }
  if (btn) {
    label();
    btn.addEventListener("click", function () {
      enabled = !enabled;
      localStorage.setItem(KEY, enabled ? "on" : "off");
      label();
      if (enabled) thock(false, true);
    });
  }

  var targets = Array.prototype.slice.call(document.querySelectorAll("[data-typed]"));
  var prompt = document.getElementById("typed");

  function typeOut(el) {
    var chars = Array.from(el.getAttribute("data-text") || el.textContent);
    var isPrompt = el === prompt;
    var base = isPrompt ? 85 : 45;
    var jitter = isPrompt ? 95 : 40;
    el.textContent = "";
    el.classList.add("typing");
    var i = 0;
    (function step() {
      if (i < chars.length) {
        el.textContent += chars[i];
        thock(chars[i] === " ", false);
        i++;
        setTimeout(step, base + Math.random() * jitter);
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
