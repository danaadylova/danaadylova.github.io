// Photo posts: each photo "develops" (pale, warm print → full color, see essay.css) the first time it scrolls
// into view. Without IntersectionObserver, or with reduced motion, they are simply shown.
(function () {
  var frames = Array.prototype.slice.call(document.querySelectorAll(".frame"));
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!("IntersectionObserver" in window) || still) {
    frames.forEach(function (f) { f.classList.add("seen"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var f = e.target, img = f.querySelector("img");
      var go = function () { f.classList.add("seen"); };
      // wait for the pixels, so it develops the photo and not an empty box
      if (img && !img.complete) { img.addEventListener("load", go, { once: true }); img.addEventListener("error", go, { once: true }); } else go();
      io.unobserve(f);
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.15 });
  frames.forEach(function (f) { io.observe(f); });
})();
