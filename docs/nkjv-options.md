# NKJV in "Foundations": final research brief (as of 2026-10-31)

General information only, not legal advice.

## 1. Bottom line

Yes, the user can legitimately have the NKJV in their own personal app today, for free. The cleanest route is API.Bible, run by the American Bible Society. Its Terms of Service (last updated Sep 3, 2026) contain a clause titled "Availability restriction — New King James Version". It makes the NKJV available on the free Starter plan or the Pro plan to apps designated non-commercial with 5,000 or fewer Monthly End Users. API.Bible's own docs list "a personal study app with no ads" as an example of non-commercial use.

The text has to come from the API through a small Netlify Function, so the key stays hidden and the proxy is closed to everyone but the user. The app must show the required attributions and report each view through FUMS, API.Bible's usage-reporting script.

Offline reading inside the app is limited:
- Only chapters the user has actually opened may be cached.
- Every cached chapter must be refreshed or deleted within 30 days.
- The cache must stay under 500 consecutive verses.
- A full permanent offline NKJV inside the app needs written approval from API.Bible, or a licence from HarperCollins Christian Publishing (HCCP). HCCP publishes no self-serve or personal licence.

For full offline NKJV on the iPhone today, use a free licensed reader alongside the app: Blue Letter Bible's free NKJV download, or the Olive Tree NKJV app where the NKJV is listed at $0.00. Foundations can link into those apps by passage.

## 2. Ranked legitimate paths (best first)

### Path 1 (recommended): API.Bible Starter (free), NKJV through a Netlify Function, online reading plus a small rolling cache

**What it is:** a licensed API that already serves the NKJV.
- Catalog entry: bibleId `63097d2a0a2f7db3-01`, abbreviation NKJV, organization HarperCollins, "Standard License", 66 books.
- The NKJV only joined the catalog on 2026-04-09, so older write-ups that say it isn't available are out of date.
- Appendix B of the Terms names "New King James Version®, Copyright © 1982, Thomas Nelson."

**Steps the user must do:**
1. Sign up at https://api.bible/sign-up as an individual, with a real email. Disposable emails are banned, and use "by or for a business" counts as commercial. The Terms allow only one free-tier account or app per person, so do not create a test app.
2. Create the app:
   - Commercial use: No
   - Monthly end users: 0–1K
   - Overage budget: $0
   - Accept the Acceptable Use, Non-Commercial, Statement of Orthodoxy and Terms of Service agreements.
3. Add "New King James Version" as one of the 3 copyrighted Bibles. Do this on the "Customize Your App" step, or later under Plan > Edit Plan > Edit Bible Licenses.
   - Two API.Bible pages say copyrighted Bibles need a paid plan (the /bibles page and the docs Bibles guide). The binding Terms clause names Starter.
   - If NKJV can't be selected on Starter, email support@api.bible and quote the NKJV availability clause. Don't buy Pro just to test it.
4. Copy the app's API key into Netlify (Site configuration > Environment variables) as `API_BIBLE_KEY`. Also create `APP_ACCESS_TOKEN`, a long random passphrase.
5. After the developer deploys, enter the passphrase once in the app's Settings on the iPhone. Use the app from the home-screen install.
6. Optional but advised: send API.Bible the questions in section 5 and keep the replies.

**Cost:**
- API.Bible: $0 a month, 5,000 calls a month, up to 3 copyrighted Bibles. There is no overage on Starter: calls stop at the limit, so there is never a bill.
- One full read-through of the Bible is about 1,189 chapter calls.
- Netlify Free is $0 with 300 credits a month. At the published rates (3 credits per 10,000 requests, 5 credits per GB-hour of compute), one person's proxy traffic is negligible.

**Online or offline:**
- Online for new chapters.
- Offline for recently read chapters, within these limits:
  - Refresh at least every 30 days. This is contractual, and applies even if the text hasn't changed.
  - 14 days is the recommended refresh.
  - Keep the cache under 500 consecutive verses.
  - Use pagination rather than bulk downloads, and request only the passages users need.

  The developer docs, which hold the 500-verse and pagination rules, are made part of the Terms by reference (Section 15).

**iPhone:** works as an installed PWA. iOS Safari deletes a site's IndexedDB and caches after 7 days of Safari use without interaction, but home-screen web apps keep their own day counter. NKJV may then just need re-fetching.

**Legal and terms status:** licensed, as long as the app stays non-commercial (no ads, fees, freemium or upsells) and every API.Bible term is followed. The duties:
- Show a visible link to https://api.bible.
- Have a copyright page with the NKJV notice.
- Implement FUMS (required for web apps; a PWA counts).
- Never change the text. Changing fonts and layout is fine.
- No text-to-speech without the rights holder's written consent.
- No AI training, and no sending NKJV to an LLM as prompt context.
- No NKJV in push notifications, email or SMS.
- DRM-style protections: restrict copying and distribution, restrict printing of more than 100 verses, limit use to the devices declared.
- Delete all content within 72 hours if the plan or account ends. An unpaid plan counts as deactivated.
- Change or delete content within 24 hours if asked.
- Give API.Bible or the rights holder access to the app on request (audits).

**What the developer builds:** see section 4.

### Path 2: free licensed offline NKJV readers on iPhone, opened from Foundations

**What it is:** the full NKJV, offline on the phone, inside a licensed app. Foundations stores only verse references and opens the passage in that app.

**Steps for the user:**
- **Blue Letter Bible:** install it, open its Bible manager and download the NKJV. It has been free through Thomas Nelson since May 15, 2025, "added as an offline Bible on your device".
- **Or Olive Tree:** install "NKJV Bible by Olive Tree" (App Store id287462072, seller Gospel Technologies LLC). Unlock the "New King James Version Bible" in-app item, listed at $0.00, and download it.
- Turn on Airplane Mode once to check it works offline.

**Cost:** $0. Paid alternatives:
- PocketBible NKJV: $9.99, explicitly "No Internet connection is required once they've been downloaded".
- Logos NKJV: $9.99 on sale (list $19.99).
- Accordance: about $14.90 (unconfirmed).
- e-Sword LT: $3.99, plus an NKJV module whose price is unconfirmed.
- Thomas Nelson NKJV eBook on Apple Books: $9.99, DRM-protected.

**Online or offline:** fully offline, but inside those apps.

**Legal status:** fully licensed. The text must not be copied out; the Olive Tree, Logos, Accordance and theWord terms all forbid copying or redistribution.

**What the developer builds:** a "Read in NKJV" button per passage that builds a link:
- `https://www.blueletterbible.org/nkjv/jhn/3/1/`
- `https://www.bible.com/bible/114/JHN.3.NKJV` (YouVersion; NKJV is version 114)
- `https://www.biblegateway.com/passage/?search=John+3&version=NKJV`

No NKJV text is stored. Whether these links open the installed apps rather than Safari, and whether either app has a URL scheme, is unconfirmed.

### Path 3 (conditional): API.Bible with written approval to keep the full NKJV on the device

**What it is:** the same setup as Path 1. The app downloads the whole NKJV into encrypted, non-exportable IndexedDB storage, re-checks it every 30 days or less, and locks the text if the lease expires.

**Steps:** after Path 1, email support@api.bible. Describe a single user, non-commercial, an installed PWA, the key held server-side, FUMS, and the attributions. Ask for written permission for a complete on-device copy, and what DRM would satisfy the Terms' Security section (Section 12).

**Cost:** $0 on Starter as far as known. About 1,189 calls for the first download and about 1,189 per refresh, which fits under 5,000 a month.

**Legal status:** do not build this without a written yes. Section 8 bans "systematically extracting data ... to populate databases". The docs ask for fewer than 500 consecutive verses cached and "Request only the passages required by users". No confirmed precedent exists: the one reported exception (the Sophia Scriptura repo) is unverified and covers development builds only.

**What the developer builds:** a chapter-by-chapter download through the same Function, encryption at rest, a 30-day lease, no export, and the same attributions and FUMS.

### Path 4: direct permission or licence from HarperCollins Christian Publishing

**What it is:** the only publisher-sanctioned route to a full NKJV text file the user could put into the existing importer.

**Steps for the user:**
1. Open https://www.harpercollinschristian.com/sales-and-rights/permissions/. For a whole translation or an app, its FAQs ("...in its entirety?" and "...smartphone application or other digital product?") say to contact the licensing department.
2. That points to https://www.harpercollinschristian.com/sales-and-rights/licensing/, whose US/Canada intake is the "domestic licensing contact form": https://www.harpercollinschristian.com/sales-and-rights/licensing/domestic-licensing-form/
3. Policy questions can go to HCCPpermissions@HarperCollins.com, or by mail to HarperCollins Christian Publishing, Attn: Permissions Department, P.O. Box 141000, Nashville, TN 37214.
4. Fill in every field: incomplete requests "will not be considered". Don't call or send duplicates, and note "We cannot accept requests by telephone or fax." The stated average turnaround for permission requests is six to eight weeks.
5. Describe the use: one user, a personal PWA, text stored only on-device, never deployed or shared, no revenue, no AI or text-to-speech. Ask whether they can supply a licensed file.

**Cost:** unknown. No fee schedule is published.

**Online or offline:** whatever they grant.

**Legal status:** fully lawful if granted. The risk is that it isn't offered. The licensing page is framed around "revenue opportunities". Biblica's rule that full-Bible NIV licences go only to registered entities, not individuals, could not be verified, and nothing shows HCCP applies it to the NKJV.

**What the developer builds:** nothing new. Use the existing on-device IndexedDB importer for a licensed file, never the git-ignored bake folder that gets deployed.

### Path 5: up to 500 NKJV verses under the publisher's free-use rules

**What it is:** a curated set of memory or study verses stored in the app with the credit line "Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved."

**Conditions:** HCCP's own policy requires all of these:
- 500 verses or fewer.
- Scripture is no more than 25% of the total text.
- No more than 50% of any one book.
- Not quoted in "a commentary or any other Biblical Reference work".
- Properly cited.

Thomas Nelson's FAQ also frames free use as for non-commercial, non-commentary, non-reference works.

**Cost:** $0. Fully offline.

**Legal status:** uncertain for this app. A Bible study app that is mostly Scripture (it bundles KJV and WEB) could fail the 25% test or count as a "Biblical Reference work". Ask HCCP before relying on it.

**Source of the text:** type it from a print Bible the user owns. Bible Gateway's site terms forbid bulk copying, and vendor apps' terms forbid reproduction.

**What the developer builds:** a verse store with a hard 500 counter and a book-coverage check, kept out of the deployed bundle.

### Path 6: Bible Gateway's official Verse of the Day API in NKJV

**What it is:** a free official REST API, documented at https://www.biblegateway.com/votd/docs/. `https://www.biblegateway.com/votd/get/?format=json&version=NKJV` returned an NKJV verse on 2026-10-31.

**Limits:** online only, one verse a day. Show its permalink and copyright link. Do not use it in push notifications.

**Cost:** $0.

### Path 7: API.Bible Pro, non-commercial

**What it is:** the same as Path 1 with more headroom. The NKJV rules are unchanged.

**Cost:** from $29 USD a month for 150,000 calls and all eligible copyrighted Bibles. Optional overage is $1 per 1,000 calls.

**When to use it:** only if 5,000 calls a month or 3 copyrighted Bibles is too little. If a Pro plan is cancelled, re-subscribing needs a new app, and the 72-hour deletion rule applies.

### Path 8 (later, only if the app is ever monetized or passes 5,000 monthly users): API.Bible Commercial plan plus a commercial NKJV licence

**Cost:** from $29 a month plus a per-translation fee that depends on monthly users. The NKJV fee appears only at checkout and is unconfirmed.

**Rules:** switch the app's designation to commercial before adding any revenue (Terms §17.3.a), and remove content obtained under the non-commercial licence.

**Publishing for free:** under API.Bible's NKJV clause, a free, non-commercial public app with 5,000 or fewer monthly end users is already covered by API.Bible's licence. Update the end-user range within 30 days of a change. The user may still want HCCP's blessing.

### Not viable today
- **YouVersion Platform:** its live catalogue on 2026-10-31 had 1,478 Bibles, 22 in English, and no NKJV. No Thomas Nelson or HarperCollins appears among its organizations or licences.
- **Bible Brain:** no NKJV text was confirmed. Its licence also bans offline use except through its /download endpoint.
- **Digital Bible Library:** licensed content goes only to approved organizations.
- **Faithlife's Biblia API:** closed to new registrations, and it has no NKJV.
- **GloBible:** no API was found.
- **DRM-free NKJV ebook:** none was confirmed as buyable. Converting one would also be a legal gray area (see section 3).
- **Logos Reftagger:** it lists NKJV for hover previews, but its terms were not reviewed (unconfirmed).

## 3. What is not allowed, and why

**Downloading unauthorized NKJV copies.** This covers GitHub JSON dumps, "free NKJV download" sites and unofficial NKJV APIs; they exist and were excluded. Downloading and keeping unauthorized copies is not fair use (BMG v. Gonzalez, 7th Cir. 2005).

**Scraping or bulk-copying Bible Gateway.** Its terms grant only personal viewing. They forbid copying, downloading or archiving beyond the quotation allowance, and forbid scripts and bots. Bible Gateway is operated by HCCP, the NKJV's publisher.

**Stripping DRM** from the Apple Books, Kindle, Christianbook or Kobo NKJV, or from Bible-app modules.
- 17 U.S.C. §1201(a)(1)(A) bans circumvention in itself, separately from infringement. The Ninth Circuit in Disney v. VidAngel held that buying a copy is not authority to decrypt it.
- No current §1201 exemption covers personal format-shifting of ebooks, and the 2027-cycle proposed rule (Oct 28, 2026) adds none.
- The Kindle terms, Logos terms, Olive Tree EULA, theWord licence and Accordance terms also forbid it.
- Amazon also removed Kindle's "Download & Transfer via USB" option on Feb 26, 2025 (secondary source).

**Copying text out of licensed Bible apps** into Foundations. Their EULAs forbid reproduction or copying.

**Converting even a DRM-free NKJV ebook into the app.** §1201 doesn't apply, but the conversion is a reproduction (Capitol Records v. ReDigi). The Register of Copyrights in 2015 and 2021, and the VidAngel court, found no precedent that format-shifting is fair use. Retailer licences are also personal and non-transferable. It is a gray area, not clearly lawful.

**Putting NKJV text in any public deploy.** Never use the build-time "bake" folder for NKJV. A public URL serving the text is a public display or transmission (17 U.S.C. §101; ABC v. Aereo). Netlify's terms ban "stolen copyrighted material".

**Breaking API.Bible's terms:**
- bulk-prefetching the whole NKJV, or baking API text into the build (Section 8 and the incorporated docs);
- keeping cache older than 30 days;
- exposing the API key in client code, or running an open proxy (Section 12; §9.5(e) bans "service bureau" use and mirroring);
- a second free account;
- monetizing on Starter or a non-commercial Pro plan;
- changing the text;
- text-to-speech, AI or LLM use, or NKJV in notifications.

## 4. Recommended implementation (Path 1, plus Path 2 deep links)

Build this now. It switches on as soon as the user finishes the Path 1 steps.

### A. Netlify Function (`netlify/functions/nkjv.mjs`, served at `/api/nkjv`)

**Environment variables:**
- `API_BIBLE_KEY`: never in the Vite bundle or git.
- `APP_ACCESS_TOKEN`: a passphrase the user enters once in Settings. It is stored on the device, not in the bundle.

**Request handling:**
- **Gate:** reject requests unless the `x-foundations-token` header matches `APP_ACCESS_TOKEN` (constant-time compare). Optionally also check the Origin header against the site URL. The Terms forbid letting others use the API through you.
- **Validate:** `chapter` must match `^[0-9A-Z]{3}\.\d{1,3}$`, a USFM chapter id such as `JHN.3`. Allow nothing else: no passage ranges and no batch requests.
- **Upstream call:**
  - URL: `GET https://rest.api.bible/v1/bibles/63097d2a0a2f7db3-01/chapters/{chapter}?content-type=html&include-titles=true&include-verse-numbers=true&include-notes=false&fums-version=3`
  - Header: `api-key: <API_BIBLE_KEY>`
  - Defaults: `content-type=html`, `include-titles=true`, `include-verse-numbers=true`, `include-notes=false`, `include-verse-spans=false`.
- **Response to the client:** return `data.content`, `data.reference`, `data.copyright`, `data.verseCount`, `data.next`, `data.previous` and `meta.fumsToken`, with `Cache-Control: private, no-store`. Netlify's CDN must not cache NKJV.
- **Errors:** pass 401 and 403 through. The client treats them as "licence or key revoked" and purges every cached NKJV chapter.
- **Logging:** don't log the text.

**Sketch:**
```js
import { timingSafeEqual } from "node:crypto";
const NKJV = "63097d2a0a2f7db3-01";
const ok = (a = "", b = "") => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export default async (req) => {
  if (!ok(req.headers.get("x-foundations-token") || "", process.env.APP_ACCESS_TOKEN || "")) return new Response("Forbidden", { status: 403 });
  const ch = new URL(req.url).searchParams.get("chapter") || "";
  if (!/^[0-9A-Z]{3}\.\d{1,3}$/.test(ch)) return new Response("Bad request", { status: 400 });
  const r = await fetch(`https://rest.api.bible/v1/bibles/${NKJV}/chapters/${ch}?content-type=html&include-titles=true&include-verse-numbers=true&include-notes=false&fums-version=3`,
    { headers: { "api-key": process.env.API_BIBLE_KEY } });
  if (!r.ok) return new Response(JSON.stringify({ error: r.status }), { status: r.status });
  const { data, meta } = await r.json();
  return Response.json({ id: data.id, reference: data.reference, content: data.content, copyright: data.copyright,
    verseCount: data.verseCount, next: data.next, previous: data.previous, fumsToken: meta?.fumsToken },
    { headers: { "Cache-Control": "private, no-store" } });
};
export const config = { path: "/api/nkjv" };
```

**Once, after setup:** call `GET https://rest.api.bible/v1/bibles` with the key. It lists only the Bibles the key can access. Confirm the NKJV id, its abbreviation and its copyright string; the Terms (§4) require using the abbreviation and copyright from API metadata.

### B. Client cache (IndexedDB store `nkjv_cache`)

- **Entry fields:** `{chapterId, content, copyright, verseCount, fumsToken, fetchedAt, lastReadAt}`.
- **Fetch only on demand:** when the user opens a chapter. No prefetching of the next chapter, and no "download NKJV" button.
- **Age:**
  - 14 days or less: serve from cache.
  - Over 14 days and online: re-fetch.
  - Over 30 days: delete, even if offline. The 30-day refresh is contractual.
  - Run a purge on every launch.
- **Size:** keep total cached NKJV verses at or below 450, evicting least recently read first. That guarantees fewer than 500 consecutive verses. Psalm 119, the longest chapter at 176 verses, still fits.
- **Service worker:** exclude `/api/nkjv` from Workbox/vite-plugin-pwa runtime caching, so only the expiring IndexedDB layer holds NKJV. Leave the bundled KJV and WEB precache as it is.
- **Exports:** the NKJV store must be excluded from any app backup, export or sync feature.
- **Never mix NKJV with the importer or bake paths:** the existing importer and the build-time bake folder must never receive NKJV data.
- **Offline or expired:** show an "NKJV needs a connection" state. Never silently show KJV or WEB in its place.
- Add a "Delete all NKJV data" button in Settings, for the 72-hour and 24-hour removal duties.

### C. FUMS (required for web apps)

- Add the stub first:
  ```js
  window.fumsData = window.fumsData || [];
  window.fums = window.fums || function(){ window.fumsData.push(arguments); };
  ```
  Then load `<script src="https://pkg.api.bible/fumsV3.min.js"></script>`.
- Each time NKJV text is shown, including from cache, call `fums('trackView', fumsToken)` with the token stored with that chapter. The help centre says a token "can be reused whenever that content is displayed, including from cache".
- **Offline:** persist pending tokens in IndexedDB and replay them when back online with `GET https://fums.api.bible/f3?t=<token>&dId=<device id>&sId=<session id>`.
  - `dId`: a random UUID stored on the device, with nothing personal in it.
  - `sId`: random per session.
  - `uId`: optional. Omit it, or use a SHA-256 hash.
  - Whether offline replay is required or acceptable is unconfirmed; ask API.Bible.

### D. Attribution

- **Copyright page** (for example `/copyright`):
  - the API's `data.copyright` string, verbatim;
  - "New King James Version®, Copyright © 1982, Thomas Nelson. All rights reserved." with the link http://harpercollins.com (as given in Terms Appendix B);
  - "Scripture content provided by API.Bible", linked to https://api.bible.
- Every NKJV view shows "(NKJV)" linked to the copyright page.
- The reader footer has a visible API.Bible link, which is mandatory on Starter.
- The first time NKJV is opened, show the full citation once (§7).

### E. Content integrity and copy protection (Terms Section 12)

- Render `data.content` as returned: style it with CSS, and sanitize only for script injection without changing text. If parsing it into the app's own verse model, keep every character.
- On NKJV text:
  - `user-select: none` and a copy-event block;
  - hide NKJV in print CSS (the limit is no printing of more than 100 verses);
  - no share or export of NKJV passages.
- Hard-exclude NKJV from read-aloud/text-to-speech, any AI or "explain" feature, and verse-of-the-day notifications. Use KJV or WEB for those.
- Ask API.Bible whether these measures satisfy Section 12.

### F. Hosting

Only KJV, WEB and the code are deployed; NKJV arrives at runtime through the licensed API. Optionally set the Netlify project to Private (owner-only on the Free and Personal plans; password protection needs Pro at $20 a month). Whether a Netlify-login-gated project works as an installed iOS PWA is unconfirmed, so the passphrase gate is the primary control.

### G. Path 2 links

Every passage view gets "Open NKJV in Blue Letter Bible / Bible.com / Bible Gateway" links, using the URL formats in Path 2, for full offline NKJV outside the app.

## 5. Open questions to send

**To API.Bible (support@api.bible):**
1. Can NKJV be selected as one of the 3 copyrighted Bibles on the free Starter plan? The Terms say yes, but https://api.bible/bibles and https://docs.api.bible/guides/bibles/ say licensed Bibles come with a paid or Pro plan.
2. Is the "fewer than 500 consecutive verses" cache request binding, given the Terms incorporate the docs (Section 15)? May a single-user, non-commercial PWA keep the complete NKJV encrypted on one device with a 30-day refresh? Please confirm in writing.
3. What satisfies the Section 12 DRM duty for a browser PWA: copy restriction, the 100-verse print limit, and the device count? What device count applies to this app?
4. Must FUMS views of cached or offline chapters be queued and replayed through `fums.api.bible/f3`? Is that acceptable?
5. Is a passphrase-gated Netlify Function proxy acceptable under §9.5(e) and Section 12?
6. What exact copyright string does bibleId `63097d2a0a2f7db3-01` return? Are footnotes and section headings included?
7. If the app is later published free and non-commercial with 5,000 or fewer monthly users, is API.Bible's NKJV licence sufficient on its own? What is the commercial NKJV fee, and does it have a user cap?
8. How would one request the rights holder's consent for text-to-speech?

**To HCCP (licensing form or HCCPpermissions@HarperCollins.com):**
1. Do you grant an individual a private, single-user, non-distributed full-text NKJV permission? At what fee?
2. Do you supply licensed text files, for example USX or XML, or name an approved source?
3. Does the gratis policy apply to a personal Bible-study app: the 25%-of-total-text test and the "Biblical Reference work" exclusion?
4. Will you consent to text-to-speech, or to a permanent offline copy?
5. What would you require before a public release?

**Unconfirmed items to check in the apps:**
- Is NKJV still $0.00 in Olive Tree, and is Blue Letter Bible's free NKJV still offered?
- Do the YouVersion Bible App and the Bible Gateway app offer NKJV offline downloads?
- Do the Path 2 links open the installed apps?

## 6. Sources

**HarperCollins Christian Publishing, Thomas Nelson and Bible Gateway**
- https://www.harpercollinschristian.com/sales-and-rights/permissions/
- https://www.harpercollinschristian.com/sales-and-rights/licensing/
- https://www.harpercollinschristian.com/sales-and-rights/licensing/domestic-licensing-form/
- https://www.cognitoforms.com/HarperCollinsChristianPublishing/PermissionsForm
- https://www.thomasnelsonbibles.com/nkjv-bible/
- https://www.biblegateway.com/versions/New-King-James-Version-NKJV-Bible/
- https://www.biblegateway.com/legal/terms/
- https://www.biblegateway.com/support/KA-01452
- https://www.biblegateway.com/support/KA-01492
- https://www.biblegateway.com/votd/docs/
- https://biblia.com/books/nkjv/article/TITLE
- https://www.biblica.com/permissions/ (unverifiable, 403)

**API.Bible terms, plans and help centre**
- https://api.bible/terms-and-conditions
- https://api.bible/
- https://api.bible/sign-up
- https://api.bible/bibles
- https://api.bible/api/trpc/public.publicBibles.list?input=%7B%22json%22%3A%7B%22search%22%3A%22NKJV%22%2C%22page%22%3A1%7D%7D
- https://care.api.bible/article/378-comparing-api-bible-plans
- https://care.api.bible/article/385-how-to-use-an-express-license
- https://care.api.bible/article/392-how-to-create-a-new-app
- https://care.api.bible/article/396-licensing-policies-quick-reference
- https://care.api.bible/article/401-caching-content
- https://care.api.bible/article/405-express-licensing-faqs
- https://care.api.bible/article/409-express-licensing-for-commercial-use
- https://care.api.bible/article/411-common-integration-patterns
- https://care.api.bible/article/417-understanding-fums

**API.Bible developer docs**
- https://docs.api.bible/quick-start/licensing-and-access
- https://docs.api.bible/quick-start/authentication
- https://docs.api.bible/quick-start/rate-limiting
- https://docs.api.bible/common-questions
- https://docs.api.bible/guides/chapters
- https://docs.api.bible/guides/passages
- https://docs.api.bible/guides/fair-use
- https://docs.api.bible/guides/bibles/

**Other Bible platforms**
- https://platform.youversion.com/bibles
- https://platform.youversion.com/terms
- https://developers.youversion.com/error-codes
- https://www.faithcomesbyhearing.com/bible-brain/license
- https://library.bible/
- https://bibliaapi.com/docs/Available_Bibles
- https://reftagger.com/customize/

**Licensed reader apps and ebooks**
- https://blogs.blueletterbible.org/blb/2025/05/15/free-nkjv-download/
- https://apps.apple.com/us/app/id287462072
- https://www.frontgatemedia.com/?p=37891
- https://www.olivetree.com/eula
- https://apps.apple.com/us/app/id436998224
- https://www.laridian.com/catalog/products/PCDNKJV.asp
- https://www.logos.com/product/317/the-new-king-james-version-bible
- https://www.logos.com/terms
- https://www.accordancebible.com/product/new-king-james-version/ (unconfirmed)
- https://accordancefiles1.com/helpfiles/Mobile2/Content/Topics/01_Welcome-About/about_accord_app.htm
- https://www.e-sword.net/iphone/faq.htm
- https://www.thewordbooks.com/index.php/license-and-copyright/
- https://www.bible.com/bible/114/JHN.3.NKJV
- https://www.bible.com/versions/114-nkjv-new-king-james-version
- https://books.apple.com/us/book/nkjv-holy-bible/id614754111
- https://www.christianbook.com/holy-bible-nkjv-ebook/9781418568504/pd/9707EB
- https://www.ebooks.com/Information/CustomerLicense
- https://digprjsurvey.amazon.com/csad/help/node/201014950 (Kindle Store Terms)
- https://goodereader.com/blog/kindle/amazon-removing-download-and-transfer-on-the-kindle-feb-26th

**US law and the Copyright Office**
- https://www.law.cornell.edu/uscode/text/17/1201
- https://www.law.cornell.edu/uscode/text/17/1203
- https://www.law.cornell.edu/uscode/text/17/1204
- https://www.law.cornell.edu/uscode/text/17/101
- https://www.law.cornell.edu/uscode/text/17/107
- https://www.law.cornell.edu/cfr/text/37/201.40
- https://www.copyright.gov/1201/2015/registers-recommendation.pdf
- https://cdn.loc.gov/copyright/1201/2021/2021_Section_1201_Registers_Recommendation.pdf
- https://www.copyright.gov/policy/1201/section-1201-full-report.pdf
- https://www.copyright.gov/1201/2027/
- https://www.govinfo.gov/content/pkg/FR-2026-10-28/pdf/2026-21939.pdf
- https://cdn.ca9.uscourts.gov/datastore/opinions/2017/08/24/16-56843.pdf (Disney v. VidAngel)
- https://www.copyright.gov/fair-use/summaries/bmg-gonzalez-7thcir2005.pdf
- https://www.copyright.gov/fair-use/summaries/capitol-records-llc-redigi-inc-no.16-2321-2nd-cir.dec.12.2018.pdf
- https://law.resource.org/pub/us/case/reporter/F3/086/86.F3d.1447.96-1139.html (ProCD v. Zeidenberg)
- https://www.law.cornell.edu/supremecourt/text/13-461 (ABC v. Aereo)

**Netlify and iOS**
- https://www.netlify.com/legal/terms-of-use/
- https://www.netlify.com/pricing/
- https://www.netlify.com/changelog/netlify-pricing-update-introducing-credit-based-plans/
- https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/
- https://docs.netlify.com/manage/security/secure-access-to-sites/password-protection/
- https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
