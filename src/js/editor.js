// The blog editor at /blog/edit/ (docs/prd-blog-tags.md, part B).
//   ?post=<slug>  edit a live post (or, if it has unpublished changes, those)
//   ?draft=<id>   a draft
//   (nothing)     a new post
// "save as draft" keeps it on the site API, private. "publish" commits the post to the site's repo; the site
// redeploys it in about a minute. Every save names the version it started from, so nothing written elsewhere
// in the meantime is overwritten.
(function () {
  var root = document.querySelector("[data-editor]");
  if (!root) return;
  var API = root.getAttribute("data-api");
  var $ = function (s) { return root.querySelector(s); };
  var gate = $("[data-ed-gate]"), form = $("[data-ed-form]"), note = $("[data-ed-note]"), statusEl = $("[data-ed-status]");
  var title = $("#edTitle"), date = $("#edDate"), body = $("#edBody"), chips = $("[data-ed-chips]"), preview = $("[data-ed-preview]");
  var heading = $("[data-ed-heading]"), discardBtn = $("[data-ed-discard]");
  var known = [];
  try { known = JSON.parse(root.getAttribute("data-topics") || "[]").map(function (t) { return t.name; }); } catch (e) {}

  // what is being edited
  var state = { slug: null, base_sha: null, draft_id: null, topics: [], dirty: false, busy: false };
  var params = new URLSearchParams(location.search);

  function api(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      method: opts.method || "GET", credentials: "include",
      headers: opts.body ? { "Content-Type": "application/json" } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error((j.detail && j.detail.message) || "Couldn't reach the site's server. Try again in a minute."); e.code = j.detail && j.detail.code; throw e; }
        return j;
      });
    });
  }
  function say(html) { statusEl.innerHTML = html; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function today() { // the date in California, where the posts are dated
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); }
  }

  // ── topics: the site's topics as pills, plus any new one ──
  function drawChips() {
    chips.innerHTML = "";
    var all = known.concat(state.topics.filter(function (t) { return known.indexOf(t) < 0; }));
    all.sort().forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = t;
      b.setAttribute("aria-pressed", String(state.topics.indexOf(t) > -1));
      b.addEventListener("click", function () {
        var i = state.topics.indexOf(t);
        if (i > -1) state.topics.splice(i, 1); else state.topics.push(t);
        b.setAttribute("aria-pressed", String(i < 0)); changed();
      });
      chips.append(b);
    });
    var add = document.createElement("button");
    add.type = "button"; add.className = "chip add"; add.textContent = "+ new topic";
    add.addEventListener("click", function () {
      var input = document.createElement("input");
      input.type = "text"; input.className = "chip-input"; input.maxLength = 30; input.setAttribute("aria-label", "new topic");
      add.replaceWith(input); input.focus();
      function done(keep) {
        var t = input.value.toLowerCase().replace(/\s+/g, " ").trim();
        if (keep && /^[a-z0-9][a-z0-9 -]{0,29}$/.test(t) && state.topics.indexOf(t) < 0) { state.topics.push(t); changed(); }
        drawChips();
      }
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); done(true); } if (e.key === "Escape") done(false); });
      input.addEventListener("blur", function () { done(true); });
    });
    chips.append(add);
  }

  // ── write / preview ──
  var md = null;
  function showPreview(on) {
    root.querySelectorAll("[data-ed-tab]").forEach(function (t) { t.setAttribute("aria-selected", String((t.getAttribute("data-ed-tab") === "preview") === on)); });
    body.hidden = on; preview.hidden = !on;
    if (!on) { body.focus(); return; }
    if (!md && window.markdownit) md = window.markdownit({ html: true, typographer: true, linkify: false });
    var html = md ? md.render(body.value.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, function (_, s, label) { return "[" + (label || s) + "](/" + s + "/)"; })) : "<p>" + esc(body.value) + "</p>";
    preview.innerHTML = '<p class="note-meta">' + esc(date.value) + (state.topics.length ? " · " + state.topics.map(function (t) { return '<span class="topic">' + esc(t) + "</span>"; }).join(" ") : "") + "</p>" +
      "<h1>" + esc(title.value || "untitled") + "</h1>" + html +
      (/\{%/.test(body.value) ? '<p class="ed-hint">Shortcodes like {% frame %} show as text here; they render on the site after publishing.</p>' : "");
  }
  root.querySelectorAll("[data-ed-tab]").forEach(function (t) { t.addEventListener("click", function () { showPreview(t.getAttribute("data-ed-tab") === "preview"); }); });

  // ── loading ──
  function fill(p) {
    title.value = p.title || ""; date.value = (p.date || today()).slice(0, 10); body.value = p.body || "";
    state.topics = (p.topics || []).slice(); drawChips();
    state.dirty = false;
  }
  function open() {
    var draftId = params.get("draft"), slug = params.get("post");
    if (draftId) {
      return api("/drafts/" + encodeURIComponent(draftId)).then(function (d) {
        state.draft_id = d.id; state.slug = d.slug; state.base_sha = d.base_sha;
        heading.textContent = d.slug ? "edit note" : "new note";
        note.hidden = false; note.textContent = d.slug ? "These are unpublished changes to a live post. The post itself stays as it is until you publish." : "A draft: only you can see it.";
        discardBtn.hidden = false; fill(d);
      });
    }
    if (slug) {
      return api("/drafts").then(function (j) {
        var d = (j.drafts || []).filter(function (x) { return x.slug === slug; })[0];
        if (d) { location.replace("/blog/edit/?draft=" + d.id); return new Promise(function () {}); }
        return api("/posts/" + encodeURIComponent(slug)).then(function (p) {
          state.slug = p.slug; state.base_sha = p.sha; heading.textContent = "edit note"; fill(p);
        });
      });
    }
    heading.textContent = "new note"; fill({ date: today(), topics: [] });
    return Promise.resolve();
  }

  // ── saving ──
  function payload() {
    return { title: title.value.trim(), date: date.value, topics: state.topics, body: body.value,
             slug: state.slug, base_sha: state.base_sha, draft_id: state.draft_id };
  }
  function busy(on) { state.busy = on; root.querySelectorAll(".actions button").forEach(function (b) { b.disabled = on; }); }
  function saveDraft() {
    if (state.busy) return;
    if (!title.value.trim()) { title.focus(); say("Give the post a title first."); return; }
    busy(true); say("saving…");
    api("/drafts", { method: "POST", body: payload() }).then(function (d) {
      state.draft_id = d.id; state.dirty = false; discardBtn.hidden = false;
      try { history.replaceState(null, "", "/blog/edit/?draft=" + d.id); } catch (e) {}
      say('<span class="ok">saved as draft</span> · only you can see it');
    }, function (err) { say(esc(err.message)); }).then(function () { busy(false); });
  }
  var pubBtn = $("[data-ed-publish]"), armed = false;
  function publish() {
    if (state.busy) return;
    if (!title.value.trim()) { title.focus(); say("Give the post a title first."); return; }
    if (!armed) { // asks once
      armed = true; pubBtn.textContent = "publish now?";
      say("It'll be live in about a minute. Press again to publish.");
      setTimeout(function () { armed = false; pubBtn.textContent = "publish"; }, 6000);
      return;
    }
    armed = false; pubBtn.textContent = "publish"; busy(true);
    say('<span class="ok">~/dana $ git commit -m "' + esc(title.value.trim()) + '"</span> · publishing…');
    api("/posts/publish", { method: "POST", body: payload() }).then(function (j) {
      state.dirty = false; state.draft_id = null; discardBtn.hidden = true; note.hidden = true;
      say('<span class="ok">~/dana $ git commit -m "' + esc(title.value.trim()) + '"</span> · published · live in about a minute · <a href="' + esc(j.url) + '">' + esc(j.url.replace(/^https?:\/\//, "")) + "</a>");
      try { history.replaceState(null, "", "/blog/edit/?post=" + j.slug); } catch (e) {}
      // further edits continue from the version just published
      return api("/posts/" + j.slug).then(function (p) { state.slug = p.slug; state.base_sha = p.sha; heading.textContent = "edit note"; });
    }, function (err) {
      say(esc(err.message) + (err.code === "changed_elsewhere" ? ' <button type="button" class="linkish" data-reload>open the latest version</button>' : ""));
      var r = statusEl.querySelector("[data-reload]");
      if (r) r.addEventListener("click", function () { state.dirty = false; location.href = "/blog/edit/?post=" + state.slug; });
    }).then(function () { busy(false); });
  }
  var discardArmed = false;
  discardBtn.addEventListener("click", function () {
    if (!state.draft_id) return;
    if (!discardArmed) { discardArmed = true; discardBtn.textContent = "discard this draft? press again"; setTimeout(function () { discardArmed = false; discardBtn.textContent = "discard draft"; }, 6000); return; }
    busy(true);
    api("/drafts/" + state.draft_id, { method: "DELETE" }).then(function () {
      state.dirty = false;
      location.href = state.slug ? "/blog/edit/?post=" + state.slug : "/blog/";
    }, function (err) { say(esc(err.message)); busy(false); });
  });
  pubBtn.addEventListener("click", publish);
  $("[data-ed-draft]").addEventListener("click", saveDraft);
  function changed() { state.dirty = true; }
  [title, date, body].forEach(function (i) { i.addEventListener("input", changed); });
  document.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key === "s" && !form.hidden) { e.preventDefault(); saveDraft(); } });
  window.addEventListener("beforeunload", function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });

  // ── start: only for Dana ──
  function needSignIn() {
    gate.innerHTML = 'Writing here needs you to be signed in. <button type="button" class="linkish" data-ed-signin>send me a sign-in link</button>';
    gate.querySelector("[data-ed-signin]").addEventListener("click", function () {
      gate.innerHTML = '<form class="blog-signin-form" novalidate><label for="edEmail">your email</label> <input type="email" id="edEmail" autocomplete="email" required> <button type="submit" class="linkish">send sign-in link</button></form>';
      var f = gate.querySelector("form"); f.querySelector("input").focus();
      f.addEventListener("submit", function (ev) {
        ev.preventDefault();
        api("/auth/request", { method: "POST", body: { email: f.querySelector("input").value.trim(), next: location.pathname + location.search } })
          .then(function (j) { gate.textContent = j.message; }, function (err) { gate.textContent = err.message; });
      });
    });
  }
  if (!API) { gate.textContent = "The editor isn't connected to the site's server."; return; }
  api("/me").then(function (j) {
    if (!j.author) return needSignIn();
    $("[data-ed-who]").textContent = "signed in as dana";
    if (location.hash === "#signed-in") try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    return open().then(function () { gate.hidden = true; form.hidden = false; (title.value ? body : title).focus(); },
                       function (err) { gate.textContent = err.message; });
  }, function (err) { gate.textContent = err.message; });
})();
