// /blog topic filter (docs/prd-blog-tags.md). One topic at a time; "all" by default. The choice lives in the
// URL (?tag=books, spaces as "-") so a filtered list can be shared. Without this script every post is listed.
(function () {
  var nav = document.querySelector(".tag-filter");
  if (!nav) return;
  nav.hidden = false;
  var btns = Array.prototype.slice.call(nav.querySelectorAll(".tf-tag"));
  var arg = nav.querySelector("[data-arg]"), live = nav.querySelector("[data-tf-live]");
  var items = Array.prototype.slice.call(document.querySelectorAll(".post-cards li"));
  var known = btns.map(function (b) { return b.getAttribute("data-tag"); });
  var current = "", typing = null;

  function word(t) { return !t ? "*" : t.indexOf(" ") > -1 ? '"' + t + '"' : t; }
  function retype(text) { // the --topic word types itself, like the site's other typed text
    clearTimeout(typing);
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { arg.textContent = text; return; }
    var i = 0; arg.textContent = "";
    (function step() { if (i <= text.length) { arg.textContent = text.slice(0, i++); typing = setTimeout(step, 35 + Math.random() * 30); } })();
  }
  function set(t, fromUser) {
    if (known.indexOf(t) < 0) t = "";
    if (fromUser && t === current) t = "";   // clicking the selected topic again shows everything
    current = t;
    btns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-tag") === t)); });
    var shown = 0;
    items.forEach(function (li) {
      var hit = !t || (li.getAttribute("data-topics") || "").split("|").indexOf(t) > -1;
      if (hit && li.hidden) { li.classList.remove("tf-in"); void li.offsetWidth; li.classList.add("tf-in"); }
      li.hidden = !hit; if (hit) shown++;
    });
    Array.prototype.forEach.call(document.querySelectorAll(".year-head"), function (h) {
      var ol = h.nextElementSibling, any = ol && Array.prototype.some.call(ol.children, function (li) { return !li.hidden; });
      h.hidden = !any; if (ol) ol.hidden = !any;
    });
    if (fromUser) {
      retype(word(t));
      live.textContent = t ? shown + (shown === 1 ? " note" : " notes") + " about " + t : "all " + shown + " notes";
      if (window.gardenThock) try { window.gardenThock(false, true); } catch (e) {}
      try { history.replaceState(null, "", t ? "?tag=" + t.replace(/\s+/g, "-") : location.pathname); } catch (e) {}
    } else arg.textContent = word(t);
  }
  btns.forEach(function (b) { b.addEventListener("click", function () { set(b.getAttribute("data-tag"), true); }); });
  // the topic pills on each post filter in place instead of reloading
  Array.prototype.forEach.call(document.querySelectorAll(".post-meta a.topic"), function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      set(a.getAttribute("data-tag"), true);
      nav.scrollIntoView({ block: "nearest" });
    });
  });
  var q = new URLSearchParams(location.search).get("tag");
  set(q ? q.replace(/-/g, " ").toLowerCase() : "", false);
})();
