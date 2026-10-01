// /blog when Dana is signed in (docs/prd-blog-tags.md, part B): the "signed in as dana" bar, the drafts box,
// edit links and "unpublished changes" badges. Visitors only ever see the small "sign in" link at the bottom.
// The session is the same as on /books (a cookie on the site API), so signing in on either page covers both.
(function () {
  var bar = document.querySelector("[data-blog-bar]");
  var API = bar && bar.getAttribute("data-api");
  var signinBox = document.querySelector("[data-blog-signin]");
  if (!API) { if (signinBox) signinBox.remove(); return; }
  var box = document.querySelector("[data-drafts]"), list = document.querySelector("[data-draft-list]");

  function api(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      method: opts.method || "GET", credentials: "include",
      headers: opts.body ? { "Content-Type": "application/json" } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error((j.detail && j.detail.message) || "Couldn't reach the site's server. Try again in a minute.");
        return j;
      });
    });
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function ago(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 90) return "just now";
    if (s < 3600) return Math.round(s / 60) + " minutes ago";
    if (s < 86400) { var h = Math.round(s / 3600); return h + (h === 1 ? " hour ago" : " hours ago"); }
    var d = Math.round(s / 86400); return d + (d === 1 ? " day ago" : " days ago");
  }
  function excerpt(md) {
    var t = String(md || "").replace(/\{%[\s\S]*?%\}/g, " ").replace(/<[^>]+>/g, " ").replace(/[#>*_`\[\]]/g, "").replace(/\(\S+\)/g, "").replace(/\s+/g, " ").trim();
    return t.length > 150 ? t.slice(0, 150).replace(/\s+\S*$/, "") + "…" : t;
  }
  // an action that asks once, inline ("publish now? yes · no"), instead of a browser dialog
  function confirmLink(label, question, cls, run) {
    var a = el("button", "act" + (cls ? " " + cls : ""), label); a.type = "button";
    a.addEventListener("click", function () {
      var ask = el("span", "ask"), yes = el("button", "act", "yes"), no = el("button", "act del", "no");
      yes.type = no.type = "button";
      ask.append(question + " ", yes, " ", no);
      a.replaceWith(ask); yes.focus();
      no.addEventListener("click", function () { ask.replaceWith(a); a.focus(); });
      yes.addEventListener("click", function () { ask.textContent = "…"; run(ask); });
    });
    return a;
  }

  function signedOut() {
    bar.hidden = true;
    if (!signinBox) return;
    signinBox.hidden = false;
    signinBox.addEventListener("click", function (e) {
      if (!e.target.closest("[data-signin-open]")) return;
      signinBox.innerHTML = '<form class="blog-signin-form" novalidate><label for="signinEmail">your email</label> ' +
        '<input type="email" id="signinEmail" autocomplete="email" required> <button type="submit" class="linkish">send sign-in link</button></form>';
      var form = signinBox.querySelector("form");
      form.querySelector("input").focus();
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var email = form.querySelector("input").value.trim();
        if (!email) return;
        api("/auth/request", { method: "POST", body: { email: email, next: location.pathname + location.search } }).then(function (j) {
          signinBox.textContent = j.message || "If that's Dana's address, a sign-in link is on its way.";
        }, function (err) { signinBox.textContent = err.message; });
      });
    });
  }

  function signedIn() {
    if (signinBox) signinBox.hidden = true;
    bar.innerHTML = "";
    var out = el("button", "linkish", "sign out"); out.type = "button";
    var add = el("a", "new-post", "+ new post"); add.href = "/blog/edit/";
    bar.append(el("span", "who", "signed in as dana"), add, out);
    bar.hidden = false;
    out.addEventListener("click", function () { api("/auth/logout", { method: "POST" }).then(function () { location.reload(); }); });
    if (location.hash === "#signed-in") try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    // edit links on every post
    Array.prototype.forEach.call(document.querySelectorAll(".post-cards li[data-slug]"), function (li) {
      var t = li.querySelector(".post-title"), a = el("a", "edit-link", "edit");
      a.href = "/blog/edit/?post=" + encodeURIComponent(li.getAttribute("data-slug"));
      t.after(a);
    });
    api("/drafts").then(function (j) { showDrafts(j.drafts || []); }, function () {});
  }

  function showDrafts(drafts) {
    list.innerHTML = "";
    var fresh = drafts.filter(function (d) { return !d.slug; });
    // changes to a live post: a badge on its card, and its edit link opens the draft
    drafts.filter(function (d) { return d.slug; }).forEach(function (d) {
      var li = document.querySelector('.post-cards li[data-slug="' + d.slug + '"]');
      if (!li) { fresh.push(d); return; }
      var edit = li.querySelector(".edit-link");
      var badge = el("a", "changes", "unpublished changes"); badge.href = "/blog/edit/?draft=" + d.id;
      badge.title = "edited " + ago(d.updated_at);
      edit.before(badge); edit.href = badge.href;
    });
    fresh.forEach(function (d) {
      var li = el("li"); li.setAttribute("data-topics", d.topics.join("|")); li.setAttribute("data-draft", d.id);
      var date = el("span", "date", "draft"), main = el("div");
      var title = el("a", "post-title", d.title); title.href = "/blog/edit/?draft=" + d.id;
      var meta = el("p", "post-meta");
      d.topics.forEach(function (t) { meta.append(el("span", "topic", t), " "); });
      meta.append((d.topics.length ? "· " : "") + "edited " + ago(d.updated_at) + " · ");
      var edit = el("a", "act", "edit"); edit.href = title.href;
      var pub = confirmLink("publish", "publish “" + d.title + "”? it'll be live in about a minute.", "", function (ask) {
        api("/posts/publish", { method: "POST", body: { draft_id: d.id, slug: d.slug, base_sha: d.base_sha, title: d.title, date: d.date, topics: d.topics, body: d.body } })
          .then(function (j) { ask.textContent = "published · live in about a minute"; li.classList.add("is-published"); title.href = j.url; },
                function (err) { ask.textContent = err.message; });
      });
      var del = confirmLink("delete draft", "delete this draft?", "del", function (ask) {
        api("/drafts/" + d.id, { method: "DELETE" }).then(function () { li.remove(); refresh(); }, function (err) { ask.textContent = err.message; });
      });
      meta.append(edit, " ", pub, " ", del);
      main.append(title, el("p", "excerpt", excerpt(d.body)), meta);
      li.append(date, main);
      list.append(li);
    });
    refresh();
  }
  function refresh() {
    box.setAttribute("data-count", String(list.children.length));
    box.hidden = !list.children.length;
    if (window.gardenBlog) window.gardenBlog.refresh();
  }

  api("/me").then(function (j) { if (j.author) signedIn(); else signedOut(); }, signedOut);
})();
