// Builds a Goodreads custom_widget response with exactly the markup Goodreads sent on 2026-11-10
// (JS string with \" and \/ escapes, class names suffixed with the widget id, five star images per book).
const STAR = { 1: "gr_flat_red_star_active", 0.5: "gr_flat_red_star_50pct", 0: "gr_flat_red_star_inactive" };

function stars(rating) {
  let out = "";
  for (let i = 1; i <= 5; i++) {
    const kind = rating >= i ? STAR[1] : rating >= i - 0.5 ? STAR[0.5] : STAR[0];
    out += `<img style=\\"width:15px;height:15px\\"${i > 1 ? ' alt=\\"\\"' : ""} src=\\"https:\\/\\/s.gr-assets.com\\/images\\/layout\\/${kind}.png\\" \\/>`;
  }
  return out;
}

/** book: { id, title (with series), author, rating, review, stamp } */
export function widgetBook(b, wid = "w1") {
  const review = `https:\\/\\/www.goodreads.com\\/review\\/show\\/${b.review ?? 9000000000 + +b.id}?utm_medium=api&amp;utm_source=custom_widget`;
  const short = b.title.replace(/ \(.*\)$/, "");
  const cover = b.cover ?? `https:\\/\\/i.gr-assets.com\\/images\\/S\\/compressed.photo.goodreads.com\\/books\\/${b.stamp ?? "1700000000"}l\\/${b.id}._SY75_.jpg`;
  return (
    `      <div class=\\"gr_custom_each_container_${wid}\\">\\n` +
    `          <div class=\\"gr_custom_book_container_${wid}\\">\\n` +
    `            <a title=\\"${b.title}\\" rel=\\"nofollow\\" href=\\"${review}\\"><img alt=\\"${short}\\" border=\\"0\\" src=\\"${cover}\\" \\/><\\/a>\\n` +
    `          <\\/div>\\n` +
    `          <div class=\\"gr_custom_rating_${wid}\\">\\n            <span class=\\" staticStars notranslate\\">${stars(b.rating ?? 0)}<\\/span>\\n          <\\/div>\\n` +
    `          <div class=\\"gr_custom_title_${wid}\\">\\n            <a rel=\\"nofollow\\" href=\\"${review}\\">${short}<\\/a>\\n          <\\/div>\\n` +
    `          <div class=\\"gr_custom_author_${wid}\\">\\n            by <a rel=\\"nofollow\\" href=\\"https:\\/\\/www.goodreads.com\\/author\\/show\\/1.X\\">${b.author ?? "A. Writer"}<\\/a>\\n          <\\/div>\\n` +
    `      <\\/div>\\n`
  );
}

export function widget(books, { shelf = "read", wid = "w1", user = "135558742-dana" } = {}) {
  return (
    `  var widget_code = '  <div class=\\"gr_custom_container_${wid}\\">\\n` +
    `    <h2 class=\\"gr_custom_header_${wid}\\">\\n    <a style=\\"text-decoration: none;\\" rel=\\"nofollow\\" href=\\"https:\\/\\/www.goodreads.com\\/review\\/list\\/${user}?shelf=${shelf}&amp;utm_medium=api&amp;utm_source=custom_widget\\">Dana&#39;s books<\\/a>\\n    <\\/h2>\\n` +
    books.map((b) => widgetBook(b, wid)).join("") +
    `  <\\/div>\\n'\n` +
    `  var widget_div = document.getElementById('gr_custom_widget_${wid}')\n  if (widget_div) {\n    widget_div.innerHTML = widget_code\n  }\n  else {\n    document.write(widget_code)\n  }\n`
  );
}
