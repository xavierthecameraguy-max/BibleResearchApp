// Where the app lives. On Netlify or your computer it's the top of the site
// ("/"); on GitHub Pages it's a folder named after the repository
// ("/BibleResearchApp/"). Set by BASE_PATH when building (see vite.config.ts).

/** The folder the app is served from, always ending in "/". */
export const BASE = import.meta.env.BASE_URL

/** The address of a file in public/, such as "bible/kjv/JHN.json", wherever the app is served from. */
export const publicUrl = (path: string) => BASE + path.replace(/^\/+/, '')

/**
 * True for a copy built for hosting with no server part (GitHub Pages).
 * Licensed translations then use keys saved on the phone (Settings).
 */
export const STATIC_HOST = import.meta.env.VITE_STATIC_HOST === '1'
