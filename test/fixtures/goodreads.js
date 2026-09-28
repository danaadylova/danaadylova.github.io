// Builds RSS pages in the same shape Goodreads' /review/list_rss/<user>?shelf=<shelf> returns.
export function item({
  id,
  title,
  author = "Test Author",
  rating = 0,
  readAt = "",
  addedAt = "Mon, 06 Jan 2025 10:00:00 -0800",
  shelves = "",
  pages = "320",
  image = `https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1600000000i/${id}._SY475_.jpg`,
}) {
  return `
    <item>
      <guid><![CDATA[https://www.goodreads.com/review/show/9${id}?utm_medium=api&utm_source=rss]]></guid>
      <pubDate><![CDATA[${addedAt}]]></pubDate>
      <title>${title.replace(/&/g, "&amp;")}</title>
      <link><![CDATA[https://www.goodreads.com/review/show/9${id}?utm_medium=api&utm_source=rss]]></link>
      <book_id>${id}</book_id>
      <book_image_url><![CDATA[${image.replace("._SY475_", "._SY75_")}]]></book_image_url>
      <book_small_image_url><![CDATA[${image.replace("._SY475_", "._SY75_")}]]></book_small_image_url>
      <book_medium_image_url><![CDATA[${image.replace("._SY475_", "._SX98_")}]]></book_medium_image_url>
      <book_large_image_url><![CDATA[${image}]]></book_large_image_url>
      <book_description><![CDATA[A description.]]></book_description>
      <book id="${id}">
        <num_pages>${pages}</num_pages>
      </book>
      <author_name>${author}</author_name>
      <isbn>0316229296</isbn>
      <user_name>Dana</user_name>
      <user_rating>${rating}</user_rating>
      <user_read_at><![CDATA[${readAt}]]></user_read_at>
      <user_date_added><![CDATA[${addedAt}]]></user_date_added>
      <user_date_created><![CDATA[${addedAt}]]></user_date_created>
      <user_shelves>${shelves}</user_shelves>
      <user_review></user_review>
      <average_rating>4.29</average_rating>
      <book_published>2015</book_published>
      <description><![CDATA[<a href="https://www.goodreads.com/book/show/${id}">cover</a>]]></description>
    </item>`;
}

export function page(items, shelf = "read") {
  return `<?xml version="1.0"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <xhtml:meta xmlns:xhtml="http://www.w3.org/1999/xhtml" name="robots" content="noindex" />
    <title>Dana's bookshelf: ${shelf}</title>
    <copyright><![CDATA[Copyright (C) 2026 Goodreads Inc. All rights reserved.]]></copyright>
    <link><![CDATA[https://www.goodreads.com/review/list_rss/135558742?shelf=${shelf}]]></link>
    <atom:link href="https://www.goodreads.com/review/list_rss/135558742?shelf=${shelf}" rel="self" type="application/rss+xml"/>
    <description><![CDATA[Dana's bookshelf: ${shelf}]]></description>
    <language>en-US</language>
    <lastBuildDate>Mon, 28 Sep 2026 13:00:00 -0700</lastBuildDate>
    <ttl>60</ttl>
    <image>
      <title>Dana's bookshelf: ${shelf}</title>
      <link><![CDATA[https://www.goodreads.com/review/list_rss/135558742?shelf=${shelf}]]></link>
      <width>144</width>
      <height>41</height>
      <url>https://s.gr-assets.com/images/layout/goodreads_logo_144.jpg</url>
    </image>
    ${items.join("\n")}
  </channel>
</rss>`;
}
