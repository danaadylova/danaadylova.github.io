// The "retro mode" switch on the home page: swaps the keyboard for the typewriter and turns the
// page dark (html.retro, see garden.css). The choice is remembered in this browser; base.njk
// applies it before the page paints so there's no flash of the light page.
(function () {
  var sw = document.querySelector("[data-retro-switch]");
  if (!sw) return;
  var root = document.documentElement, KEY = "garden-retro";
  function sync() { sw.setAttribute("aria-checked", String(root.classList.contains("retro"))); }
  sw.addEventListener("click", function () {
    var on = !root.classList.contains("retro");
    root.classList.add("retro-fade");
    root.classList.toggle("retro", on);
    sync();
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) {}
    var ready = on ? (window.gardenTypewriter ? window.gardenTypewriter.start() : false) : true;
    setTimeout(function () { root.classList.remove("retro-fade"); }, 700);
    // whichever machine just appeared types the prompt again
    if (ready && window.gardenRetype) setTimeout(window.gardenRetype, 450);
  });
  sync();
})();
