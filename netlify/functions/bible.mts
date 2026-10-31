// Netlify Function that serves /api/bible/* (see the redirect in netlify.toml).
// API keys come from the site's environment variables, set in the Netlify
// dashboard: Site configuration → Environment variables.

import { handleBibleApi } from '../../server/bibleApi.ts'

export default (req: Request) => handleBibleApi(req, process.env)
