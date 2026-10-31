// Credits for the study datasets bundled with the app (shown on the
// Copyright page). Add an entry whenever a new dataset is added.

export interface Credit {
  title: string
  text: string
  url?: string
}

export const CREDITS: Credit[] = [
  {
    title: 'Cross-references',
    text: 'Cross-reference data © OpenBible.info, licensed under Creative Commons Attribution 4.0 (CC BY 4.0). Derived mainly from the public-domain Treasury of Scripture Knowledge. Changes: reformatted for offline use and limited to references with at least one vote. Provided without warranty.',
    url: 'https://www.openbible.info/labs/cross-references/',
  },
  {
    title: 'Berean Standard Bible',
    text: 'The Holy Bible, Berean Standard Bible, BSB is produced in cooperation with Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible Translation Committee. This text of God’s Word has been dedicated to the public domain. Official files from BSB Publishing (release v5.19).',
    url: 'https://berean.bible',
  },
  {
    title: 'Lessons, glossary and timeline',
    text: 'Written for Foundations. Book introductions and lesson text are original to this app.',
  },
]
