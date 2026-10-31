import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, existsSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { readFileSync } from 'node:fs'
import { handleBibleApi } from './server/bibleApi.ts'
import { parseLesson } from './src/lib/lessonFormat.ts'

/**
 * Serves the Bible proxy at /api/bible/* while developing (`npm run dev`)
 * and previewing (`npm run preview`), using API keys from the .env file.
 * On Netlify the same code runs as a Function instead.
 */
function bibleApi(env: Record<string, string>, base: string): Plugin {
  const prefix = `${base}api/bible/`
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    if (!req.url?.startsWith(prefix)) return next()
    try {
      const url = `http://localhost/${req.url.slice(base.length)}`
      const code = req.headers['x-access-code']
      const headers: Record<string, string> = typeof code === 'string' ? { 'x-access-code': code } : {}
      const response = await handleBibleApi(new Request(url, { method: req.method, headers }), env)
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
          else if (name.endsWith('.json')) files.push({ path: 'data/' + relative(root, full).split(sep).join('/'), bytes: statSync(full).size })
        }
      }
      walk(root)
      this.emitFile({ type: 'asset', fileName: 'data-manifest.json', source: JSON.stringify(files) })
    },
  }
}

/**
 * GitHub Pages (STATIC_HOST builds): 404.html is a copy of the app, so a link
 * straight to a page like /bible/JHN/3 still opens the app; .nojekyll stops
 * GitHub from processing the files; and private Bible files are left out.
 */
function staticHost(): Plugin {
  return {
    name: 'foundations-static-host',
    apply: 'build',
    // After the files are written, so index.html exists.
    writeBundle(options) {
      const dir = options.dir ?? join(process.cwd(), 'dist')
      copyFileSync(join(dir, 'index.html'), join(dir, '404.html'))
      writeFileSync(join(dir, '.nojekyll'), '')
      // A GitHub Pages site is public: never publish a Bible built from your own file.
      const priv = join(dir, 'bible', 'private')
      if (existsSync(priv)) {
        rmSync(priv, { recursive: true, force: true })
        this.warn('Left out public/bible/private/: your own Bible files are never published to GitHub Pages.')
      }
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // The folder the app is served from: "/" normally, "/BibleResearchApp/" on GitHub Pages.
  const base = `/${(env.BASE_PATH ?? '').replace(/^\/+|\/+$/g, '')}/`.replace(/\/+/g, '/')
  const isStatic = env.VITE_STATIC_HOST === '1'
  return {
    base,
    // The lessons are bundled into the app so they work offline; that makes the main file large, which is fine.
    build: { chunkSizeWarningLimit: 1600 },
    plugins: [
      bibleApi(env, base),
      dataManifest(),
      ...(isStatic ? [staticHost()] : []),
      lessons(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['icons/*.png', 'icons/*.svg'],
        manifest: {
          name: 'Foundations: Learn the Bible',
          short_name: 'Foundations',
          description: 'Learn the Bible from the ground up: its story, how we got it, church history and how to read it.',
          theme_color: '#1c1917',
          background_color: '#fafaf9',
          display: 'standalone',
          orientation: 'portrait',
          id: base,
          start_url: base,
          scope: base,
          icons: [
            { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
            { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
            { src: `${base}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Store the app and both bundled Bibles on the device so everything works offline.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}', 'bible/**/*.json'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback: `${base}index.html`,
          // Take charge of the page on the very first visit, so offline saving works straight away.
          clientsClaim: true,
          // Licensed translations are fetched live and never stored by the service worker.
          navigateFallbackDenylist: [/\/api\//],
          // Study data (cross-references, word studies, dictionaries…) is saved on the
          // device the first time it's used, or all at once from Settings.
          runtimeCaching: [
            {
              // A pattern, not a function: it's copied into the service worker as written.
              urlPattern: new RegExp(`^https?://[^/]+${base.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}data/`),
              handler: 'CacheFirst',
              options: { cacheName: 'study-data', expiration: { maxEntries: 2000 } },
            },
          ],
        },
      }),
    ],
  }
})
