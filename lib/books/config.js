// Settings for the /books page (see docs/prd-books.md §4; imported by src/_data/books.js).
export default {
  goodreadsUserId: "135558742",
  readShelf: "read",
  readingShelf: "currently-reading",
  // A book on any of these counts as "didn't finish". `dnf` is a Goodreads tag, `did-not-finish` a shelf.
  dnfShelves: ["did-not-finish", "dnf"],
  // Where covers and the last good snapshot are kept between builds (restored by actions/cache in CI).
  cacheDir: ".cache/books",
  // Years with more shelves than this fold to their top-rated books (PRD §6.0 "Big years").
  foldRows: 2,
};
