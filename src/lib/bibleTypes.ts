// Shape of a Bible book as the app stores it (bundled JSON files and
// imported translations both use this).

export interface Verse {
  /** Verse number */
  v: number
  /** Verse text. Poetry line breaks are "\n". */
  t: string
  /** True when a new paragraph starts at this verse */
  p?: boolean
  /** A heading shown before this verse (e.g. a psalm title) */
  h?: string
}

export interface BookText {
  id: string
  /** chapters[0] is chapter 1 */
  chapters: Verse[][]
}
