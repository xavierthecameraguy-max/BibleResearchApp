# Foundations

A calm, phone-friendly Bible study app for a new Christian. It installs on your iPhone's home screen, works offline, and keeps everything private on your device.

## What's inside

**Learn**
- **Six tracks, 65 short lessons** (5–7 minutes each) with a key passage, summary, quiz, "Talk it over" questions, a "Try this" step and a private reflections box. Some lessons include diagrams.
  - First Steps (for brand-new believers)
  - The Big Story
  - How We Got the Bible
  - How We Got Here (church history)
  - How to Read the Bible
  - Big Questions: doubt, the Gospels, the resurrection, suffering, science, other religions, hard passages, hell and knowing God is real
- **Listen** to any lesson read aloud.
- **Timeline** from Abraham to today; tap an event to open its lesson.
- **Glossary** of 110+ terms, linked from inside the lessons.

**Read**
- **Bible reader** with an intro card for every book, swipe to change chapter, and a quick chapter picker.
- **Built in and offline:** Berean Standard Bible (BSB, the default), King James Version (KJV) and World English Bible (WEB).
- **Online, licensed and free:** **NKJV** (through API.Bible), **ESV** (Crossway) and **NLT** (Tyndale). The NLT works with no sign-up. See section 3.
- **Tap any verse** to:
  - highlight it in 5 colours, bookmark it, add a note, copy it
  - memorize it
  - compare translations
  - see cross-references, the Hebrew/Greek words, topics and dictionary articles
  - listen to it read aloud
- **Interlinear mode:** Hebrew or Greek words with English glosses under every verse.
- **People and places in each chapter**, with a map.
- **Search** the whole Bible, plus lessons, topics, the dictionary, and people and places.
- **Ten reading plans**, from the Sermon on the Mount in 7 days and Psalms for hard times to the life of Jesus, the New Testament in 90 days and the whole Bible in a year.
- **A guided daily quiet time** (pray, read, reflect, pray, remember), about 10 minutes.

**Study**
- **Passage study tool:** five guided questions with smart hints (surrounding sections, cross-references, original audience). Saved as notes you can share with a mentor.
- **Word study:** every Hebrew and Greek word, with meaning, definition, grammar and every place it appears.
- **Bible dictionary:** Easton's, Smith's and Hitchcock's Bible Names.
- **Topical Bible:** Nave's, 5,000+ topics.
- **Commentary:** Matthew Henry's classic Concise Commentary on every chapter (1706), clearly labelled as an older Protestant voice.
- **People and places:** family trees, maps and every mention.
- **Memory verses** with spaced repetition (recall, first-letter hints, or type it out).
- **Prayer journal** and **My Bible** (all your highlights, bookmarks and verse notes).

**Your progress**
- A dashboard with a reading streak, verse of the day, today's plan reading and your next lesson.
- **Backup and restore** your notes and progress to a file.

**Comfort**
- Large type, light, dark and sepia themes, classic or modern fonts.
- Fully usable with one hand and with a screen reader.

No account, no ads, no tracking. Everything you write stays on your device.

---

## 1. Run it on your computer

You only need steps 1–3 once.

1. **Install Node.js.** Go to <https://nodejs.org> and download the **LTS** version. Install it like any other program.
2. **Get the project.** On this repository's GitHub page, choose the `foundations` branch, click the green **Code** button, then **Download ZIP**. Unzip it somewhere easy, like Documents.
3. **Open a terminal in the project folder.**
   - **Mac:** open **Terminal**, type `cd ` (with a space), drag the unzipped folder onto the window, and press Enter.
   - **Windows:** open the folder in File Explorer, click the address bar, type `cmd`, and press Enter.

   Then run this. It downloads the app's building blocks and takes a minute or two:
   ```
   npm install
   ```
4. **Start the app:**
   ```
   npm run dev
   ```
   Open the address it shows (like `http://localhost:5173`) in your browser. Press `Ctrl + C` in the terminal to stop.

Next time, just repeat steps 3 and 4.

---

## 2. Put it on your iPhone

An iPhone can only install an app to the home screen with offline use from a secure `https://` address, so the app needs to be online somewhere. There are two free ways.

### Option A: GitHub Pages (already set up)

Every time the `foundations` branch changes, GitHub builds the app and publishes it at:

**<https://xavierthecameraguy-max.github.io/BibleResearchApp/>**

1. Open that address in **Safari** on your iPhone.
2. Tap **Share → Add to Home Screen → Add**.
3. Open the app from its new icon while you're online once, so it saves itself for offline use.

GitHub Pages has no server part, so the NKJV and ESV keys are saved on your phone instead (section 3).

How it works, if you ever need it:
- The **Publish to GitHub Pages** action (`.github/workflows/pages.yml`) builds the app and puts it on the `gh-pages` branch.
- **Settings → Pages** on GitHub should show **Deploy from a branch → `gh-pages` / root**.
- To publish by hand, open the **Actions** tab, choose **Publish to GitHub Pages**, then **Run workflow**.
- Your own Bible files (section 4) are never included in this public copy.

### Option B: Netlify

Netlify can also run the small server part, which keeps your keys off your phone.

1. **Sign up at <https://www.netlify.com>** with your GitHub account.
2. Click **Add new project** (it may say **Add new site**), then **Import an existing project → GitHub**. Choose this repository and the **`foundations`** branch.
3. Netlify reads `netlify.toml` and fills everything in. Click **Deploy**. After a minute you'll get an address like `https://something.netlify.app`.
4. **On your iPhone, open that address in Safari.** Tap **Share → Add to Home Screen**.

> Use the GitHub import above, not Netlify's drag-and-drop "Drop" page. Drag-and-drop doesn't include the server part.

Either way, the home-screen app keeps its own storage, separate from Safari. Use **Notes → Save backup / Restore** to move notes and progress between devices.

---

## 3. NKJV, ESV and NLT (free, licensed)

These translations are copyrighted. The app reads them online, one chapter at a time, under each publisher's free non-commercial terms. It keeps a few recent chapters on your phone for a short time, as the terms allow. Your API keys are never put into the app's files or GitHub.

### NKJV: free through API.Bible
1. Sign up at <https://api.bible/sign-up> as an individual and choose the free **Starter** plan.
2. When you create the app, say:
   - **Commercial use:** No
   - **Monthly users:** 0–1K
   - **Overage budget:** $0
3. Add **New King James Version** as one of your (up to 3) Bibles. You can do this while setting up the app, or later under **Plan → Edit Plan → Edit Bible Licenses**.
   - If it won't let you pick the NKJV on Starter, email support@api.bible. Their terms make the NKJV available on Starter for non-commercial apps.
4. Copy your **API key**.

The free plan allows 5,000 chapter loads a month, plenty for one person. Rules the app follows for you:
- The NKJV can't be read aloud by the phone's voice.
- Copying is limited to small selections.
- A credit and link to API.Bible appear under the text.

### ESV: free key from Crossway
1. Create a free account at <https://api.esv.org>.
2. Choose **Create an API Application**. For intended use, say "personal study".
3. Copy the key.

### NLT: works now
The NLT already works with no sign-up, using Tyndale's free anonymous access. For higher limits, register at <https://api.nlt.to> for a free key.

### Where the keys go
- **On your phone (GitHub Pages, or any copy):**
  1. Open the app → **More → Settings → Licensed translations**.
  2. Paste each key under **Keys on this phone**, then tap **Save and check**. The app tells you if a key is wrong or the NKJV isn't on your API.Bible plan yet.

  The keys are saved only in this app on this phone and sent only to API.Bible, Crossway or Tyndale. They aren't in backups. Each phone or computer needs them typed in once. **Remove keys** deletes them, along with the chapters they loaded.
- **On Netlify:**
  1. Go to **Site configuration → Environment variables** and add:
     - `API_BIBLE_KEY`: your API.Bible key
     - `ESV_API_KEY`: your ESV key
     - `NLT_API_KEY`: optional
     - `APP_ACCESS_CODE`: a private passphrase you make up. It stops anyone who finds your site address from using your keys.
  2. Go to **Deploys → Trigger deploy**.
  3. On your iPhone, open the app → **More → Settings → Licensed translations**, type your access code, and tap **Save**.
- **On your computer:** copy the file `.env.example` to `.env`, paste the keys after the `=` signs, and restart `npm run dev`. The `.env` file is private: Git ignores it.

Once the NKJV is set up, it becomes your default translation automatically. When you're offline, the app shows the KJV (the NKJV's closest relative) for chapters it hasn't saved, and tells you it's done so.

**Want the NKJV fully offline on your phone too?** Blue Letter Bible and Olive Tree both offer the NKJV as a free, licensed offline download in their own apps. In Settings, set **"Open passages on" → Blue Letter Bible**, and every passage's "Open in NKJV" button will take you there. `docs/nkjv-options.md` explains every legitimate option in detail, and what isn't allowed.

---

## 4. Using a Bible file you own (advanced)

If you have a Bible file you're licensed to use, you can add it in two ways:
- **In the app:** Settings → **Add a translation**. The file is stored only on that device.
- **Built into your copy of the app:**
  ```
  npm run add-bible -- ABBR "Full name" private/your-file.zip
  ```
  The file and the converted text are kept out of GitHub automatically.

Supported formats:
- USFM (or a zip of USFM files)
- OSIS or Zefania XML
- JSON
- plain text lines like `Genesis 1:1 In the beginning…`

---

## 5. Editing the lessons and other content

All the teaching content is in the **`content/`** folder, separate from the code. You can edit it in any text editor; the free [VS Code](https://code.visualstudio.com) is good.

| What | Where |
|---|---|
| Lessons | `content/lessons/<track>/NN-name.md` |
| Tracks (titles, order, colours) | `content/tracks.json` |
| Glossary | `content/glossary.json` |
| Timeline | `content/timeline.json` |
| Book intro cards | `content/book-intros.json` |
| Verse of the day list | `content/verses-of-the-day.json` |
| Further resources | `content/resources.json` |

`content/CONTENT-GUIDE.md` explains the lesson format: quizzes, "Talk it over" questions, key passages and glossary links like `[[covenant]]`. After editing, run `npm run check-content`. It explains any mistake in plain English, and the same check runs before every build.

---

## 6. Handy commands

| Command | What it does |
|---|---|
| `npm run dev` | Run the app on your computer while you work on it |
| `npm run check-content` | Check the lessons and content files for mistakes |
| `npm run build` | Build the finished app into `dist/` |
| `npm run preview` | Run the finished app from `dist/` (best for testing offline mode) |
| `npm run add-bible -- …` | Build your own Bible file into the app (section 4) |
| `BASE_PATH=/BibleResearchApp/ VITE_STATIC_HOST=1 npm run build` | Build the GitHub Pages version (the action does this for you) |
| `npm run build-bible` | Re-download and convert the built-in KJV, WEB and BSB |
| `node scripts/data/<name>.mjs` | Rebuild one study dataset: `xrefs`, `original`, `dictionary`, `people`, `topics` or `commentary` |

---

## 7. Where everything comes from

| Content | Source | License |
|---|---|---|
| Berean Standard Bible | BSB Publishing (official files, release v5.19) | Public domain |
| King James Version | eBible.org (1769 text) | Public domain (Crown rights apply in the UK only) |
| World English Bible | eBible.org | Public domain |
| NKJV | API.Bible, Thomas Nelson | Licensed, free non-commercial plan |
| ESV | ESV API, Crossway | Licensed, free non-commercial use |
| NLT | NLT API, Tyndale | Licensed, free non-commercial use |
| Cross-references | OpenBible.info | CC BY 4.0 |
| Hebrew and Greek words, lexicons, grammar | STEP Bible / Tyndale House Cambridge | CC BY 4.0 |
| Bible dictionaries (Easton, Smith, Hitchcock) | CrossWire SWORD modules | Public domain |
| Topical Bible (Nave's) | CrossWire SWORD module | Public domain |
| Matthew Henry's Concise Commentary | CrossWire SWORD module (and CCEL) | Public domain |
| People, places, events | Theographic Bible Metadata | CC BY-SA 4.0 |
| Map coordinates | OpenBible.info Bible Geocoding | CC BY 4.0 |
| Lessons, glossary, book intros, timeline | Written for this app | |

The in-app **Copyright** page (More → Copyright) shows every required notice.

**If you ever publish the app publicly:**
- The licensed translations need licences that allow it.
- The Hebrew definitions (from the Online Bible's Abridged BDB) need the Online Bible's permission. Run `node scripts/data/original.mjs --no-hebrew-meanings` to leave them out.
- The people and places data is share-alike (CC BY-SA), so changes to that data must be shared under the same licence.

## A note on the lessons

The lessons are a friendly introduction, not the final word. They follow mainstream scholarship, give approximate dates, and describe Protestant, Catholic and Orthodox views fairly. Every lesson was fact-checked and independently reviewed, but they're still well worth talking over with a pastor or mentor.

## Tech

- React, TypeScript, Vite and Tailwind CSS
- vite-plugin-pwa for offline use and installing
- Leaflet for maps
- One small Netlify Function (`netlify/functions/bible.mts`, code in `server/`) for the licensed translations. On GitHub Pages the same code runs inside the app, with keys saved on the phone.

Lesson content is in `content/`, data build scripts in `scripts/`, and the app in `src/`.
