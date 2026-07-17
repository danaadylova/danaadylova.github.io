(function () {
  var KEY = "garden-sound";
  var enabled = localStorage.getItem(KEY) !== "off";
  var ctx = null;

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
    var dur = 0.07;
    var buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.2);
    }
    var noise = ac.createBufferSource();
    noise.buffer = buf;
    var lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = (deep ? 750 : 1500) + Math.random() * 500;
    var ng = ac.createGain();
    ng.gain.value = 0.2 + Math.random() * 0.08;
    noise.connect(lp);
    lp.connect(ng);
    ng.connect(ac.destination);
    noise.start(t);
    var osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime((deep ? 85 : 120) + Math.random() * 15, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.06);
    var og = ac.createGain();
    og.gain.setValueAtTime(0.25, t);
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

  var target = document.getElementById("typed");
  if (target) {
    var text = target.getAttribute("data-text") || target.textContent;
    var interacted = false;
    var mark = function () { interacted = true; };
    window.addEventListener("pointerdown", mark, { once: true });
    window.addEventListener("keydown", mark, { once: true });
    target.textContent = "";
    var i = 0;
    (function step() {
      if (i < text.length) {
        target.textContent += text[i];
        if (interacted && text[i] !== " ") thock(false, false);
        i++;
        setTimeout(step, 85 + Math.random() * 95);
      } else {
        document.body.classList.add("typed-done");
      }
    })();
  } else {
    document.body.classList.add("typed-done");
  }
})();
