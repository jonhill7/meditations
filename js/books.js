// Canonical book list. Codes are USFM ids, which the data files and the
// commentary service both use.
export const BOOKS = [
  ['GEN', 'Genesis', 50], ['EXO', 'Exodus', 40], ['LEV', 'Leviticus', 27],
  ['NUM', 'Numbers', 36], ['DEU', 'Deuteronomy', 34], ['JOS', 'Joshua', 24],
  ['JDG', 'Judges', 21], ['RUT', 'Ruth', 4], ['1SA', '1 Samuel', 31],
  ['2SA', '2 Samuel', 24], ['1KI', '1 Kings', 22], ['2KI', '2 Kings', 25],
  ['1CH', '1 Chronicles', 29], ['2CH', '2 Chronicles', 36], ['EZR', 'Ezra', 10],
  ['NEH', 'Nehemiah', 13], ['EST', 'Esther', 10], ['JOB', 'Job', 42],
  ['PSA', 'Psalms', 150], ['PRO', 'Proverbs', 31], ['ECC', 'Ecclesiastes', 12],
  ['SNG', 'Song of Songs', 8], ['ISA', 'Isaiah', 66], ['JER', 'Jeremiah', 52],
  ['LAM', 'Lamentations', 5], ['EZK', 'Ezekiel', 48], ['DAN', 'Daniel', 12],
  ['HOS', 'Hosea', 14], ['JOL', 'Joel', 3], ['AMO', 'Amos', 9],
  ['OBA', 'Obadiah', 1], ['JON', 'Jonah', 4], ['MIC', 'Micah', 7],
  ['NAM', 'Nahum', 3], ['HAB', 'Habakkuk', 3], ['ZEP', 'Zephaniah', 3],
  ['HAG', 'Haggai', 2], ['ZEC', 'Zechariah', 14], ['MAL', 'Malachi', 4],
  ['MAT', 'Matthew', 28], ['MRK', 'Mark', 16], ['LUK', 'Luke', 24],
  ['JHN', 'John', 21], ['ACT', 'Acts', 28], ['ROM', 'Romans', 16],
  ['1CO', '1 Corinthians', 16], ['2CO', '2 Corinthians', 13], ['GAL', 'Galatians', 6],
  ['EPH', 'Ephesians', 6], ['PHP', 'Philippians', 4], ['COL', 'Colossians', 4],
  ['1TH', '1 Thessalonians', 5], ['2TH', '2 Thessalonians', 3], ['1TI', '1 Timothy', 6],
  ['2TI', '2 Timothy', 4], ['TIT', 'Titus', 3], ['PHM', 'Philemon', 1],
  ['HEB', 'Hebrews', 13], ['JAS', 'James', 5], ['1PE', '1 Peter', 5],
  ['2PE', '2 Peter', 3], ['1JN', '1 John', 5], ['2JN', '2 John', 1],
  ['3JN', '3 John', 1], ['JUD', 'Jude', 1], ['REV', 'Revelation', 22],
].map(([code, name, chapters], index) => ({ code, name, chapters, index, testament: index < 39 ? 'OT' : 'NT' }));

export const BOOK = Object.fromEntries(BOOKS.map(b => [b.code, b]));

export function bookName(code) {
  return BOOK[code]?.name ?? code;
}

// Parses 'JHN 3:16', 'PSA 23:1-3', 'GEN 1:1-2:3' or 'ROM 8'.
export function parseRef(ref) {
  const m = /^(\w{3}) (\d+)(?::(\d+)(?:-(?:(\d+):)?(\d+))?)?$/.exec(ref.trim());
  if (!m || !BOOK[m[1]]) return null;
  const chapter = +m[2];
  const verse = m[3] ? +m[3] : null;
  return {
    book: m[1],
    chapter,
    verse,
    endChapter: m[4] ? +m[4] : chapter,
    endVerse: m[5] ? +m[5] : verse,
  };
}

export function formatRef(ref) {
  const r = typeof ref === 'string' ? parseRef(ref) : ref;
  if (!r) return String(ref);
  let s = `${bookName(r.book)} ${r.chapter}`;
  if (r.verse) {
    s += `:${r.verse}`;
    if (r.endChapter !== r.chapter) s += `–${r.endChapter}:${r.endVerse}`;
    else if (r.endVerse && r.endVerse !== r.verse) s += `–${r.endVerse}`;
  }
  return s;
}

// Sort key for canonical order.
export function refKey(ref) {
  const r = parseRef(ref);
  if (!r) return 0;
  return BOOK[r.book].index * 1e6 + r.chapter * 1e3 + (r.verse ?? 0);
}

// Common abbreviations that a prefix match alone gets wrong or can't decide.
const ALIASES = {
  gn: 'GEN', ex: 'EXO', lv: 'LEV', nm: 'NUM', dt: 'DEU', jdg: 'JDG', judg: 'JDG', jg: 'JDG',
  ps: 'PSA', psa: 'PSA', psalm: 'PSA', pss: 'PSA', prv: 'PRO', song: 'SNG', sos: 'SNG', songofsolomon: 'SNG',
  canticles: 'SNG', eze: 'EZK', ezk: 'EZK', jl: 'JOL', jon: 'JON', mt: 'MAT', mk: 'MRK', mrk: 'MRK',
  lk: 'LUK', jn: 'JHN', jhn: 'JHN', phil: 'PHP', php: 'PHP', phm: 'PHM', philem: 'PHM',
  jas: 'JAS', jude: 'JUD', jd: 'JUD', rv: 'REV', revelations: 'REV',
};

// Parses what people type: 'John 3:16', 'phil 4:6-7', '1 Cor 13', 'Ps 23:1–3'.
// Returns a ref string like 'PHP 4:6-7', or null.
export function parseTypedRef(input) {
  const m = /^\s*([1-3]?\s*[a-z][a-z .]*?)\.?\s*(\d+)(?:\s*:\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?\s*$/i.exec(input);
  if (!m) return null;
  const key = m[1].toLowerCase().replace(/^(i{1,3})\s+/, (_, r) => String(r.length)).replace(/[\s.]/g, '');
  let code = ALIASES[key] ?? (BOOK[key.toUpperCase()] ? key.toUpperCase() : null);
  if (!code) {
    const hits = BOOKS.filter(b => b.name.toLowerCase().replace(/\s/g, '').startsWith(key));
    if (hits.length !== 1) return null;
    code = hits[0].code;
  }
  const chapter = +m[2];
  if (chapter < 1 || chapter > BOOK[code].chapters) return null;
  if (!m[3]) return `${code} ${chapter}`;
  if (m[4] && +m[4] > +m[3]) return `${code} ${chapter}:${m[3]}-${m[4]}`;
  return `${code} ${chapter}:${m[3]}`;
}
