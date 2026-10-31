# Foundations

A calm, phone-friendly app that teaches a new Christian the Bible from the ground up:

- **Four learning tracks** (45 short lessons with quizzes):
  - The Big Story
  - How We Got the Bible
  - How We Got Here (church history)
  - How to Read the Bible
- **Timeline** from Abraham to today. Tap an event to open its lesson.
- **Bible reader** with an introduction card for each of the 66 books. The KJV and WEB are built in and work offline. You can add your own NKJV (see below).
- **Passage study tool:** five guided questions, saved as notes.
- **Progress dashboard, glossary and further resources.**

There are no accounts and no server. Progress and notes are saved in your browser. Once the app has been opened, it works offline and can be installed on a phone's home screen.

---

## 1. Run it on your computer

You only need to do steps 1–3 once.

1. **Install Node.js.** Go to <https://nodejs.org> and download the version marked **LTS**. Install it like any other program.
2. **Get the project onto your computer.** On the GitHub page for this repository, click the green **Code** button, then **Download ZIP**. Unzip it somewhere easy, like your Documents folder. If you use Git, `git clone` works too.
3. **Open a terminal in the project folder.**
   - **Mac:** open the **Terminal** app, type `cd ` (with a space), drag the unzipped folder onto the Terminal window, and press Enter.
   - **Windows:** open the folder in File Explorer, click the address bar, type `cmd` and press Enter.

   Then type this and press Enter. It downloads the app's building blocks and takes a minute or two:

   ```
   npm install
   ```
4. **Start the app:**

   ```
   npm run dev
   ```

   The terminal will show an address like `http://localhost:5173`. Open it in your web browser. To stop the app, click in the terminal and press `Ctrl + C`.

Next time, just repeat steps 3 and 4. You don't need `npm install` again.

### Using it on your phone at home

1. Run this instead:

   ```
   npm run dev -- --host
   ```
2. The terminal shows a **Network** address, like `http://192.168.1.20:5173`. With your phone on the **same Wi-Fi**, open that address in the phone's browser.

Phones only allow **"Add to Home Screen" with offline use** for apps served over a secure (`https://`) address. So over home Wi-Fi the app works fine, but it needs Wi-Fi and your computer running. To install it properly on your phone, use one of the deploy options in section 3. Your NKJV and notes stay on your own phone either way.

---

## 2. Adding your NKJV (or ESV, NLT, CSB…)

The NKJV, ESV, NLT and CSB are copyrighted, so they can't be built into the app. You can import a copy **you already have** for your own personal study:

1. In the app, go to **More → Settings → Bible translations**.
2. Enter a short name (for example `NKJV`) and a full name.
3. Tap **Choose file(s)** and pick your Bible file.

The text is read on your device and stored only in that browser. It is never uploaded, and it is never added to the project's code. Once imported, it becomes your reading translation everywhere: the reader, lesson passages and the study tool. Any book missing from your file falls back to the KJV.

**File types that work:**

| Format | Example |
|---|---|
| USFM | `.usfm` / `.sfm` files, or a `.zip` of them |
| OSIS XML or Zefania XML | `.xml` |
| JSON | `[{"book":"John","chapter":3,"verse":16,"text":"…"}]` and several other common layouts |
| Text lines | `Genesis 1:1 In the beginning…` or tab-separated `Genesis⇥1⇥1⇥In the beginning…` |

If you get a file from Bible software you own, check that its license allows personal use. Keep the file in a folder called `private/` inside the project, or anywhere else outside the project. The `private/` folder is ignored by Git, so it can never be committed by accident.

Every passage also has an **Open in NKJV** button that opens it on Bible Gateway or YouVersion. You can change the translation and site for that button in Settings.

Each phone or browser keeps its own copy of what you import. Import it once on each device you use. To move your notes and progress between devices, use **Notes → Save backup** and **Restore**.

---

## 3. Putting it online (optional, free)

The project is ready for Netlify or Vercel. Either one gives you a secure `https://` address, so the app can be installed on a phone and used offline.

The NKJV is **not** part of the deployed app. Anyone who visits gets the KJV and WEB only. Your imported NKJV lives only on your own phone.

First, put the project on GitHub. If you're reading this on GitHub, it already is.

### Netlify

1. Sign up free at <https://www.netlify.com> using your GitHub account.
2. Click **Add new site → Import an existing project → GitHub**, and choose this repository.
3. Netlify reads `netlify.toml` and fills everything in: build command `npm run build`, publish folder `dist`. Click **Deploy**.
4. After about a minute you get an address like `https://something.netlify.app`.

### Vercel

1. Sign up free at <https://vercel.com> using your GitHub account.
2. Click **Add New → Project** and import this repository. Vercel detects **Vite** automatically.
3. Click **Deploy**.

### Installing on your phone

Open the `https://` address on your phone.

- **iPhone (Safari):** tap **Share → Add to Home Screen**.
- **Android (Chrome):** tap the **⋮** menu → **Install app** (or **Add to Home screen**).

After the first visit, everything works offline.

---

## 4. Editing or adding lessons

All the teaching content lives in the **`content/`** folder, separate from the code. You can edit it in any text editor. The free [VS Code](https://code.visualstudio.com) is a good choice.

| What | Where |
|---|---|
| Lessons | `content/lessons/<track>/NN-name.md` (one Markdown file each) |
| Glossary | `content/glossary.json` |
| Timeline | `content/timeline.json` |
| Book intro cards | `content/book-intros.json` |
| Further resources | `content/resources.json` |

**`content/CONTENT-GUIDE.md`** explains the lesson format, including quizzes, key passages and glossary links like `[[covenant]]`.

To check your edits, run:

```
npm run check-content
```

It explains any mistake in plain English, such as a quiz answer pointing to an option that doesn't exist. The same check runs automatically before every build. While `npm run dev` is running, the app updates as soon as you save a file.

---

## 5. Handy commands

| Command | What it does |
|---|---|
| `npm run dev` | Run the app locally while you work on it |
| `npm run check-content` | Check the lesson and content files for mistakes |
| `npm run build` | Make the finished, optimised app in the `dist/` folder |
| `npm run preview` | Run the finished app from `dist/`. This is the best way to test offline mode locally. |
| `npm run build-bible` | Re-download and re-convert the built-in KJV and WEB. Rarely needed. |

---

## About the Bible text

| Translation | License | Source |
|---|---|---|
| **King James Version** (1769 standard text) | Public domain, except in the UK, where Crown letters patent apply | [eBible.org](https://ebible.org/find/details.php?id=eng-kjv), `eng-kjv_usfm.zip` |
| **World English Bible** | Public domain. "World English Bible" is a trademark of eBible.org, so the name shouldn't be used for a changed text. The app shows it unchanged. | [eBible.org](https://ebible.org/find/details.php?id=eng-web), `eng-web_usfm.zip` |

Footnotes are removed, and only the 66 books of the Protestant canon are included. The converted files are in `public/bible/`.

## A note on the lessons

The lessons are a friendly introduction, not the final word. They try to follow mainstream historical scholarship, give approximate dates, and describe Protestant, Catholic and Orthodox views fairly where they differ. They are well worth talking over with a pastor or mentor.

## Tech

React, TypeScript, Vite, Tailwind CSS and vite-plugin-pwa. The code is in `src/`, and the build scripts are in `scripts/`.
