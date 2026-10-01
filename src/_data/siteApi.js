// The site API (unraveled.makes on Railway, /site/*): margin notes on /books, and signing in, drafts and
// publishing on /blog. Same setting as lib/books/config.js (BOOKS_NOTES_API points both at a local API).
import config from "../../lib/books/config.js";

export default config.notesApi || null;
