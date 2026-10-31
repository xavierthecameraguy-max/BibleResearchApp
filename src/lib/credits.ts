// Credits for the study datasets bundled with the app (shown on the
// Copyright page). Add an entry whenever a new dataset is added.

import { DICTIONARY_SOURCES, SOURCE_ORDER } from './data/dictionary.ts'

export interface Credit {
  title: string
  text: string
  url?: string
}

export const CREDITS: Credit[] = [
  {
    title: 'Hebrew, Aramaic and Greek word data',
    text: 'Original-language data from STEP Bible (www.STEPBible.org), created by Tyndale House Cambridge, licensed CC BY 4.0 (TAHOT, TAGNT, TBESH, TBESG, TEHMC, TEGMC). Reformatted for offline use, verse numbers mapped to the KJV, long definitions shortened. Greek glosses are based on the Berean Study Bible; Greek definitions are from Abbott-Smith’s Manual Greek Lexicon of the New Testament. Hebrew definitions are based on the Abridged BDB by Online Bible (Larry Pierce), included for personal use; ask Online Bible for permission before publishing the app.',
    url: 'https://github.com/STEPBible/STEPBible-Data',
  },
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
  ...SOURCE_ORDER.map((id) => ({ title: DICTIONARY_SOURCES[id].title, text: DICTIONARY_SOURCES[id].credit, url: DICTIONARY_SOURCES[id].url })),
]
