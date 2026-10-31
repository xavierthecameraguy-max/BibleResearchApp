// The 66 books of the Protestant canon, in order, with USFM codes and the
// names / abbreviations used to recognise references like "1 Cor 13:4".

export interface BookInfo {
  id: string
  name: string
  chapters: number
  testament: 'OT' | 'NT'
  aliases: string[]
}

const RAW: [string, string, number, string[]][] = [
  ['GEN', 'Genesis', 50, ['gen', 'ge', 'gn']],
  ['EXO', 'Exodus', 40, ['exod', 'exo', 'ex']],
  ['LEV', 'Leviticus', 27, ['lev', 'le', 'lv']],
  ['NUM', 'Numbers', 36, ['num', 'nu', 'nm']],
  ['DEU', 'Deuteronomy', 34, ['deut', 'deu', 'dt']],
  ['JOS', 'Joshua', 24, ['josh', 'jos']],
  ['JDG', 'Judges', 21, ['judg', 'jdg', 'jg']],
  ['RUT', 'Ruth', 4, ['ruth', 'rut', 'ru']],
  ['1SA', '1 Samuel', 31, ['1 sam', '1sam', '1 sa', '1sa', 'i samuel', 'first samuel']],
  ['2SA', '2 Samuel', 24, ['2 sam', '2sam', '2 sa', '2sa', 'ii samuel', 'second samuel']],
  ['1KI', '1 Kings', 22, ['1 kgs', '1kgs', '1 ki', '1ki', 'i kings', 'first kings']],
  ['2KI', '2 Kings', 25, ['2 kgs', '2kgs', '2 ki', '2ki', 'ii kings', 'second kings']],
  ['1CH', '1 Chronicles', 29, ['1 chron', '1chron', '1 chr', '1chr', '1 ch', 'i chronicles', 'first chronicles']],
  ['2CH', '2 Chronicles', 36, ['2 chron', '2chron', '2 chr', '2chr', '2 ch', 'ii chronicles', 'second chronicles']],
  ['EZR', 'Ezra', 10, ['ezra', 'ezr']],
  ['NEH', 'Nehemiah', 13, ['neh', 'ne']],
  ['EST', 'Esther', 10, ['esth', 'est', 'es']],
  ['JOB', 'Job', 42, ['job', 'jb']],
  ['PSA', 'Psalms', 150, ['psalm', 'ps', 'psa', 'pss', 'psalms']],
  ['PRO', 'Proverbs', 31, ['prov', 'pro', 'pr', 'prv']],
  ['ECC', 'Ecclesiastes', 12, ['eccl', 'eccles', 'ecc', 'ec', 'qoheleth']],
  ['SNG', 'Song of Songs', 8, ['song of solomon', 'song', 'sos', 'canticles', 'sng', 'song of sol']],
  ['ISA', 'Isaiah', 66, ['isa', 'is']],
  ['JER', 'Jeremiah', 52, ['jer', 'je', 'jr']],
  ['LAM', 'Lamentations', 5, ['lam', 'la']],
  ['EZK', 'Ezekiel', 48, ['ezek', 'eze', 'ezk']],
  ['DAN', 'Daniel', 12, ['dan', 'da', 'dn']],
  ['HOS', 'Hosea', 14, ['hos', 'ho']],
  ['JOL', 'Joel', 3, ['joel', 'jl', 'jol']],
  ['AMO', 'Amos', 9, ['amos', 'am', 'amo']],
  ['OBA', 'Obadiah', 1, ['obad', 'ob', 'oba']],
  ['JON', 'Jonah', 4, ['jonah', 'jon', 'jnh']],
  ['MIC', 'Micah', 7, ['mic', 'mi']],
  ['NAM', 'Nahum', 3, ['nah', 'na', 'nam']],
  ['HAB', 'Habakkuk', 3, ['hab', 'hb']],
  ['ZEP', 'Zephaniah', 3, ['zeph', 'zep', 'zp']],
  ['HAG', 'Haggai', 2, ['hag', 'hg']],
  ['ZEC', 'Zechariah', 14, ['zech', 'zec', 'zc']],
  ['MAL', 'Malachi', 4, ['mal', 'ml']],
  ['MAT', 'Matthew', 28, ['matt', 'mat', 'mt']],
  ['MRK', 'Mark', 16, ['mark', 'mrk', 'mk', 'mr']],
  ['LUK', 'Luke', 24, ['luke', 'luk', 'lk']],
  ['JHN', 'John', 21, ['john', 'jhn', 'jn']],
  ['ACT', 'Acts', 28, ['acts', 'act', 'ac']],
  ['ROM', 'Romans', 16, ['rom', 'ro', 'rm']],
  ['1CO', '1 Corinthians', 16, ['1 cor', '1cor', '1 co', '1co', 'i corinthians', 'first corinthians']],
  ['2CO', '2 Corinthians', 13, ['2 cor', '2cor', '2 co', '2co', 'ii corinthians', 'second corinthians']],
  ['GAL', 'Galatians', 6, ['gal', 'ga']],
  ['EPH', 'Ephesians', 6, ['eph', 'ephes']],
  ['PHP', 'Philippians', 4, ['phil', 'php', 'pp']],
  ['COL', 'Colossians', 4, ['col', 'co']],
  ['1TH', '1 Thessalonians', 5, ['1 thess', '1thess', '1 th', '1th', 'i thessalonians', 'first thessalonians']],
  ['2TH', '2 Thessalonians', 3, ['2 thess', '2thess', '2 th', '2th', 'ii thessalonians', 'second thessalonians']],
  ['1TI', '1 Timothy', 6, ['1 tim', '1tim', '1 ti', '1ti', 'i timothy', 'first timothy']],
  ['2TI', '2 Timothy', 4, ['2 tim', '2tim', '2 ti', '2ti', 'ii timothy', 'second timothy']],
  ['TIT', 'Titus', 3, ['titus', 'tit']],
  ['PHM', 'Philemon', 1, ['philem', 'phm', 'phlm']],
  ['HEB', 'Hebrews', 13, ['heb']],
  ['JAS', 'James', 5, ['jas', 'jm']],
  ['1PE', '1 Peter', 5, ['1 pet', '1pet', '1 pe', '1pe', '1 pt', 'i peter', 'first peter']],
  ['2PE', '2 Peter', 3, ['2 pet', '2pet', '2 pe', '2pe', '2 pt', 'ii peter', 'second peter']],
  ['1JN', '1 John', 5, ['1 jn', '1jn', '1 jhn', '1john', 'i john', 'first john']],
  ['2JN', '2 John', 1, ['2 jn', '2jn', '2 jhn', '2john', 'ii john', 'second john']],
  ['3JN', '3 John', 1, ['3 jn', '3jn', '3 jhn', '3john', 'iii john', 'third john']],
  ['JUD', 'Jude', 1, ['jude', 'jud', 'jd']],
  ['REV', 'Revelation', 22, ['rev', 're', 'revelations', 'apocalypse']],
]

export const BOOKS: BookInfo[] = RAW.map(([id, name, chapters, aliases], i) => ({
  id,
  name,
  chapters,
  testament: i < 39 ? 'OT' : 'NT',
  aliases,
}))

export const BOOK_IDS = BOOKS.map((b) => b.id)

const byId = new Map(BOOKS.map((b) => [b.id, b]))

const byName = new Map<string, BookInfo>()
for (const b of BOOKS) {
  byName.set(b.name.toLowerCase(), b)
  byName.set(b.id.toLowerCase(), b)
  for (const a of b.aliases) byName.set(a, b)
}

export function getBook(id: string): BookInfo | undefined {
  return byId.get(id.toUpperCase())
}

/** Find a book from a name, abbreviation or USFM code ("1 Cor", "Psalm", "JHN"). */
export function findBook(name: string): BookInfo | undefined {
  const key = name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/^(1st|2nd|3rd)\s*/, (m) => m[0] + ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return byName.get(key) ?? byName.get(key.replace(/^(\d) /, '$1'))
}

/** Every name/alias, longest first, for building reference-matching regexes. */
export function allBookNames(): string[] {
  return [...byName.keys()].filter((k) => k.length > 2 || /^\d/.test(k)).sort((a, b) => b.length - a.length)
}
