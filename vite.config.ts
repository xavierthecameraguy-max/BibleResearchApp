import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { readFileSync } from 'node:fs'
import { handleBibleApi } from './server/bibleApi.ts'
import { parseLesson } from './src/lib/lessonFormat.ts'

/**
 * Serves the Bible proxy at /api/bible/* while developing (`npm run dev`)
 * and previewing (`npm run preview`), using API keys from the .env file.
 * On Netlify the same code runs as a Function instead.
 */
function bibleApi(env: Record<string, string>): Plugin {
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    if (!req.url?.startsWith('/api/bible/')) return next()
    try {
      const response = await handleBibleApi(new Request(`http://localhost${req.url}`, { method: req.method }), env)
      res.statusCode = response.status
      response.headers.forEach((value, key) => res.setHeader(key, value))
      res.end(await response.text())
    } catch (e) {
      res.statusCode = 500
      res.end(String(e))
    }
  }
  return {
    name: 'foundations-bible-api',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  }
}

/**
 * Writes data-manifest.json listing every study-data file (public/data/**),
 * so Settings can offer "Save study data for offline" in one tap.
 */
function dataManifest(): Plugin {
  return {
    name: 'foundations-data-manifest',
    apply: 'build',
    generateBundle() {
      const root = join(process.cwd(), 'public', 'data')
      const files: { path: string; bytes: number }[] = []
      const walk = (dir: string) => {
        if (!existsSync(dir)) return
        for (const name of readdirSync(dir)) {
          const full = join(dir, name)
          if (statSync(full).isDirectory()) walk(full)
          else if (name.endsWith('.json')) files.push({ path: '/data/' + relative(root, full).split(sep).join('/'), bytes: statSync(full).size })
        }
      }
      walk(root)
      this.emitFile({ type: 'asset', fileName: 'data-manifest.json', source: JSON.stringify(files) })
    },
  }
}

/**
 * Lessons are read and checked when the app is built, not on the phone:
 * `virtual:lessons` gives every lesson's details, and each lesson's text is a
 * separate small file loaded when the lesson is opened.
 */
function lessons(): Plugin {
  const META = 'virtual:lessons'
  const BODY = 'virtual:lesson-body/'
  const dir = join(process.cwd(), 'content', 'lessons')
  const readAll = (ctx: { addWatchFile: (f: string) => void }) => {
    const glossary = JSON.parse(readFileSync(join(process.cwd(), 'content', 'glossary.json'), 'utf8')) as { id: string }[]
    const ids = new Set(glossary.map((g) => g.id))
    ctx.addWatchFile(join(process.cwd(), 'content', 'glossary.json'))
    const out = []
    for (const track of readdirSync(dir)) {
      const tdir = join(dir, track)
      if (!statSync(tdir).isDirectory()) continue
      for (const f of readdirSync(tdir).filter((x) => x.endsWith('.md'))) {
        const file = join(tdir, f)
        ctx.addWatchFile(file)
        const { lesson, problems } = parseLesson(readFileSync(file, 'utf8'), `lessons/${track}/${f}`, ids)
        if (problems.length) throw new Error(problems.join('\n'))
        if (lesson) out.push(lesson)
      }
    }
    return out
  }
  return {
    name: 'foundations-lessons',
    resolveId: (id) => (id === META || id.startsWith(BODY) ? '\0' + id : undefined),
    load(id) {
      if (id === '\0' + META) {
        const all = readAll(this)
        const meta = all.map(({ body: _body, ...rest }) => rest) // eslint-disable-line @typescript-eslint/no-unused-vars
        const loaders = all.map((l) => `${JSON.stringify(l.id)}: () => import(${JSON.stringify(BODY + l.id)})`).join(',\n')
        return `export const lessonMeta = ${JSON.stringify(meta)};\nexport const bodies = {\n${loaders}\n};`
      }
      if (id.startsWith('\0' + BODY)) {
        const lid = id.slice(BODY.length + 1)
        const l = readAll(this).find((x) => x.id === lid)
        return `export default ${JSON.stringify(l?.body ?? '')}`
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  // The lessons are bundled into the app so they work offline; that makes the main file large, which is fine.
  build: { chunkSizeWarningLimit: 1600 },
  plugins: [
    bibleApi(loadEnv(mode, process.cwd(), '')),
    dataManifest(),
    lessons(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Foundations: Learn the Bible',
        short_name: 'Foundations',
        description: 'Learn the Bible from the ground up: its story, how we got it, church history and how to read it.',
        theme_color: '#1c1917',
        background_color: '#fafaf9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Store the app and both bundled Bibles on the device so everything works offline.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}', 'bible/**/*.json'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Licensed translations are fetched live and never stored by the service worker.
        navigateFallbackDenylist: [/^\/api\//],
        // Study data (cross-references, word studies, dictionaries…) is saved on the
        // device the first time it's used, or all at once from Settings.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/data/'),
            handler: 'CacheFirst',
            options: { cacheName: 'study-data', expiration: { maxEntries: 2000 } },
          },
        ],
      },
    }),
  ],
}))
