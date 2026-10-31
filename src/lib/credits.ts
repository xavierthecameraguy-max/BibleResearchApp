// Credits for the study datasets bundled with the app (shown on the
// Copyright page). Add an entry whenever a new dataset is added.

export interface Credit {
  title: string
  text: string
  url?: string
}

export const CREDITS: Credit[] = [
  {
    title: 'Lessons, glossary and timeline',
    text: 'Written for Foundations. Book introductions and lesson text are original to this app.',
  },
]
