# Dokodemo — handoff notes for a new Claude chat

> **For the user:** Start a new chat. Attach this file together with `dokodemo-v135.zip` (or the newest `index.html` from GitHub). Then write: "ဒီမှတ်စုအတိုင်း Dokodemo ကို ဆက်လုပ်ပေး". If the site is already live, you can attach the newest `index.html` from GitHub instead of the zip.
>
> **For Claude:** Read all of this before doing anything. Always reply in **Burmese (မြန်မာ)**. The user works from an **iPad (Safari) and an Android phone**, with no PC. Give one step at a time and ask for screenshots.

Last updated: 2026-10-25 · App version **1.0.135** (`sw.js` cache `myaing-v135`) · APK 1.0.120 (version code 120)

> ⚠️ First thing to ask: **has v1.0.121 been uploaded to GitHub yet?** (`index.html`, `sw.js`, `config.json` from `dokodemo-v135.zip`). If not, help the user upload it before anything else.

---

## 1. What the app is

| | |
|---|---|
| Name | **Dokodemo – どこでも日本語** ("Dok●demo": the second "o" is drawn as a red sun disc) |
| What it does | Japanese learning app for Myanmar speakers: Hiragana → JLPT N1, vocabulary, kanji, grammar, 18,500 dialog lines, dictionary, quizzes, songs, Myanmar calendar with Sabbath days, TextMe chat practice, Pro features |
| Format | **A single-file HTML PWA** (`index.html`, about 5 MB, all JS/CSS/data inline) plus `sw.js` (offline cache and push handler) |
| UI languages | Myanmar / 日本語 / English. Use `T(my, ja, en)` for every visible string. The language row in the menu shows a flag and the name (🇲🇲 🇯🇵 🇬🇧). Korean and Thai translations exist in `I18N` but are switched off; add them to `LANGS` to enable them. |
| Owner team name | "Dokodemo Team" (never put real names in the app) |

### Addresses (the app is being moved — see §6)
- **Live site:** https://dokodemojapanese.github.io/ (GitHub account `dokodemojapanese`, repo `dokodemojapanese.github.io`). Live since 2026-10-22.
- **Old site:** https://myaingstudy.github.io/ (GitHub account `myaingstudy`). Now a moving page (index/sw/download/404 redirect with `#migrate=` data). Its notification workflow was deleted. **Never delete this repo** (old Home Screen icons and the old APK still point here).
- The user is signed in to two GitHub accounts on the iPad. Use the profile picture → Switch account. A "You need to fork" message means the wrong account is signed in.
- Contact: **JapaneseDokodemo@gmail.com** · Telegram admin **@DokodemoOfficial** · Telegram channel **t.me/DokodemoJapanese** · Facebook **facebook.com/DokodemoJapanese** · YouTube **@DokodemoJapanese**
- APK short link: bit.ly/dokodemoapk (QR: `qr-apk.png`) points to **https://myaingstudy.github.io/Dokodemo.apk** (old repo). The Bitly free plan cannot change the destination, so **every new APK must be uploaded as `Dokodemo.apk` to BOTH repos** (new repo for `download.html`, old repo for bit.ly/QR).
- Claude artifact preview of the app: https://claude.ai/artifact/8o9qTrAeY9d39MQvwo729d
- Play Store listing doc (Claude Docs): "Dokodemo — Google Play Store Listing"

---

## 2. Files in the new repo (repo root)

| File | Purpose |
|---|---|
| `index.html` | The whole app |
| `sw.js` | Offline cache. **Bump `myaing-vNNN` on every release**, and set the matching `APP.ver` 1.0.NNN inside `index.html` |
| `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon.png`, `icon.svg`, `og-image.jpg` | PWA and sharing assets |
| `Dokodemo.apk` | Sideload APK (1.0.120, host dokodemojapanese.github.io). `download.html` links to it |
| `config.json` | Remote switches `{"share":true,"website":true,"copyright":true,"tester":true}` (`tester` = the "Tester လိုနေပါတယ်" menu row; set false when enough testers) (the user may set "website":false). The user edits this file on GitHub to show or hide menu rows for everyone. Admin mode sees every row. |
| `download.html` | APK / iPhone install page (shows the QR on desktop) |
| `privacy.html`, `delete-account.html` | Required by Google Play (3 languages) |
| `push.js`, `mmcal.js` | Notification sender run by GitHub Actions (`mmcal.js` = Myanmar calendar library, MIT, Yan Naing Aye) |
| `.nojekyll` | Required so that `.well-known` is served |
| `.well-known/assetlinks.json` | Digital Asset Links for the TWA/APK (copied from the old repo) |
| `.github/workflows/sabbath-push.yml` | Uses checkout@v5, setup-node@v5, Node 22 (updated 2026-10-23). Cron jobs: 22:00 UTC (07:00 JST, Sabbath) and 11:00 UTC (20:00 JST, study reminder). `workflow_dispatch` modes: auto / study / test. Runs `node push.js`. Needs the secret **`FIREBASE_SA`** |

**Never upload:** `adm-mz7k.html` (the private admin / Pro-code generator page; the user keeps it on the phone and Google Drive), `signing.keystore`, keystore passwords, the Firebase service-account JSON, or anything with `PRO_SECRET`.

---

## 3. How the app code is organised (inside `index.html`)

- **State:** `S` (UI state), `SET` (settings, saved in `localStorage['myaing.set']`). `render()` redraws everything, and the click handler on `#app` dispatches `data-a="action"` buttons through an actions map.
- **localStorage keys** all start with `myaing.`. Examples: set, fav, words, jprog, jexam, jlv, hw, review, tlist, dict.recent, uid (6-character User ID that Pro codes are tied to), pro, proexp, adult, push, push.sb, push.st, acct, synced, sid, statd, play, betax, cfg, admui.
- **Helpers:** `T()` for 3-language text; `LC()` for the content language (my/ja/en); `esc()`; `toast()`; `CFG()` reads the remote switches; `IS_IOS()`; `PLAY()` is true when the app was opened with `?src=play`; `ADMUI()` is true in admin mode (tap the Version row 7 times; it is in Menu → App အကြောင်း).
- **Menu (drawer):** the main page has Personalization (Language, Dark, Theme, Font size, 🔔 Notifications ›, ⚙️ More settings ›), Explore, Social (round FB/YT/TG icons plus Share), 👑 Pro, and ℹ️ App အကြောင်း ›. Sub-pages are switched with `S.dsub` = noti / more / app.
- **Notifications:** Firebase Cloud Messaging (Web Push). The client saves the token in Firestore `pushTokens/{token}` with `{token, lang, ts, sb, st}`. The server is the GitHub Actions job `push.js`.
- **Google login (optional):** Firebase Auth. It backs up the `SYNC_KEYS` to Firestore `users/{uid}` `{d: JSON string, ts}`. "Account ဖျက်ရန်" deletes the backup and the account.
- **Usage count:** writes an anonymous daily record to `stats/{random id}`. Admin can see the numbers with the 📊 row in admin mode (admin account: japanesedokodemo@gmail.com).
- **Google Analytics** (`G-RML4B2XTPV`) can be turned off in the menu.
- **Play mode (`?src=play`):** hides prices, payment methods and purchase wording, the 18+ section, and the APK links. Only a Pro code field is left. The Play Store build must use start_url `/?src=play`.
- **Beta notice:** a red marquee inside the search box on the Discovery / Dialog / Pro tabs (`betaOn()`, `betaTxt()`). The ✕ button hides it for 3 days.
- **Prices** (`PAY.plans`): Myanmar UI shows Ks, 日本語 shows ¥, English shows ¥ with Ks underneath. Payments are KBZ Pay / AYA Pay / Wave Pay (manual), then the admin sends an activation code.
- **Migration import:** the first `<script>` reads `#migrate=<base64 JSON>` sent by the old site and writes the old `myaing.*` keys, then shows a toast.

### Firebase (project "Dokodemo Push", id `dokodemo-push`, Spark plan)
- These values are public and fine to embed: apiKey `AIzaSyD9P_ur4AeKnTChUpc90IKb3cVO2siNNxE`, authDomain `dokodemo-push.firebaseapp.com`, messagingSenderId `942835095638`, appId `1:942835095638:web:e62989a4ab6692f22543f7`, VAPID `BH58AGt-SrANZspF1kkAcxEPLVOkZYNnwftR9Gq-xPe7SIgX2uGz5GDgcVepZ8u6Xyy1hixthhIVxRGsyU5Li7w`
- Auth: Google provider is enabled. Authorized domains: myaingstudy.github.io and dokodemojapanese.github.io (added 2026-10-22).
- Service-account key: a new key was generated on 2026-10-22 and saved as the `FIREBASE_SA` secret in the new repo. The JSON file was deleted from the iPad.
- Firestore rules allow: `pushTokens` (create/update with keys token, lang, ts, sb, st; delete; no read); `users/{uid}` (owner only, keys d and ts); `stats/{sid}` (create/update with keys d, l, p, a, v; read only by the admin email); everything else is denied.

---

## 4. Rules the user set (must follow)

- Reply in **Burmese**. Keep explanations short and step by step for iPad.
- **Never ask for or accept** passwords, the admin key, 2FA codes, the keystore, or the service-account JSON.
- Do **not** put the user's personal email or real names in the app. Do not re-add the Viber number.
- No copyrighted lyrics, articles or art. Do not copy the official Facebook/YouTube/Telegram logos exactly; use simple look-alike icons. Credit CIC and I.G.M. Use only the user's own photos (pagoda photos pg0, pg2, pg3 are the user's).
- Adult content stays in the 18+ Pro section behind the age gate, and is hidden in Play mode.
- Do not delete or rename Google Form questions.
- **Do not suggest or mention Huawei AppGallery** (the user said no). Google Play only.
- Credits: the user removed the CIC (N5 grammar) and I.G.M (N3 chapter) credits on purpose. The new N5 vocabulary is **Osaka City Japanese Language Center by Dokodemo** = the user's own material → no credit line needed.
- "ဖြုတ်ပြီး X ထဲထည့်" usually means *copy/extract into X*, not delete the original. Ask if unsure before removing a section.
- Before a big change, show a preview or screenshot and let the user choose.
- Every release must include: the changed files, `sw.js` with its version bumped, and the artifact republished.

---

## 5. Status of current work

**Done:** push notifications (Sabbath 07:00 + study 20:00); Google login and cloud backup; usage count; Play mode; privacy and delete-account pages; simpler menu; social links; beta notice; prices by language; moving files for the new address.

**Move to dokodemojapanese.github.io — DONE 2026-10-22:** 16 files (v1.0.119), `.nojekyll`, `.well-known/assetlinks.json` (verified live), `.github/workflows/sabbath-push.yml` (manual test run succeeded), `FIREBASE_SA` secret, Firebase domain, moving page on the old repo, and the old workflow deleted.

**v1.0.119 (2026-10-21) — Thadingyut decorations:** oil lamps and paper lanterns (no hot-air balloons; the user asked for that). They appear on the splash/header logo, the header title (lanterns beside the title, lamps beside the subtitle) and on top of each bottom-nav icon. They turn on automatically from Thadingyut waxing 10 to waning 5 (`THD()` in index.html, uses `mmDay`). In 2026 that is Oct 21–31 (full moon Oct 26). Test override: localStorage `myaing.thd` = '1' or '0'. The Home Screen PNG icons were not changed on purpose: iOS never updates them.

**v1.0.120 (2026-10-23):** manifest now has `shortcuts` (Discovery / Dialog / Pro → `./index.html?tab=words|talk|practice`; `index.html` reads `?tab=` into `S.tab`), plus `dir`, `launch_handler`, `handle_links`, `edge_side_panel`, `related_applications` (play, com.dokodemo.japanese). PWABuilder manifest score 22 → 31/46. The only warning left is screenshots (take them on Android for Play).


**v1.0.121 (2026-10-23 → 25, ready in `dokodemo-v135.zip`, not yet confirmed uploaded):**
1. Thadingyut tiles: during `THD()` every Discovery/Dialog/Pro tile gets a string of 5 swinging lanterns on top and 5 oil lamps at the bottom (`thTile()`, CSS `.tgar` / `.tlmp`).
2. In-app Privacy text rewritten to match `privacy.html` (Google login, cloud backup, notifications, usage count, GA, Delete account) + link to full page. Last updated 2026-10-23.
3. **Google Play reviewer Pro code `PLAYREV-SQ4AXE`** (`PRO_REV`, `proFixed()`): never expires, works on any phone, **only in Play mode (`?src=play`)**. Put it in Play Console → App access. Can be removed after approval.
4. Menu → Social: "🙋 Tester လိုနေပါတယ် · 🎁 Pro ၁ လ အခမဲ့ + ဒေတာဖိုး/ဖုန်းဘေလ် လက်ဆောင်" row → t.me/DokodemoOfficial. Shown only on Android/PC, not iOS, not Play mode. Remote switch `config.json` `tester`.
5. **JLPT N5 Grammar removed** (data deleted; `JHIDE={5:['grammar']}`, `jHid()`). N5 exam = Kotoba 8 + Kanji 7 + Reading 3 + Listening 2 (`JXN`, `jxSecs()`). N4–N1 grammar unchanged. CIC credit removed.
6. N3 Kotoba tab kept (was removed by mistake, restored). All 3,246 N3 words (incl. I.G.M chapter list `IGM3`) are also in the Dictionary. I.G.M credit removed. Typo fixed ジャスチャー→ジェスチャー.
7. Dictionary renamed **"ど Dictionary"** (tile label + page header; `TILE_JP['辞書']`). Dictionary now ≈12,185 entries.
8. V Forms (活用): 333 → **365 verbs** (+32 N5/N4 verbs, `KV_RAW` lines may have a 6th English field). Readings with no humble form added to `KEN_NA`.
9. PDF list (`PDFS`, `pdfRows()`, `pdfN5()`) shown at the top of JLPT N5 Kotoba as well as in the PDF tile.
10. Home marquee: greeting → **moon-phase picture + Myanmar date** (e.g. "သီတင်းကျွတ်လဆန်း ၁၃ ရက်") → Sabbath text. `moonP()`, `moonSVG()` (30 computed shapes), `homeMarq()`.
11. **JLPT N5 Kotoba replaced** with the user's PDF "N5 Vocab by Dokodemo Osaka City" (Minna no Nihongo 第1–25課): 1,044 entries, 3 languages (JP / Myanmar / English), lesson chips (`S.j5l`, `data-j5l`), sections 練習C / 会話 / names, verb group badges I/II/III. Data `N5L_RAW` → `N5L`, `N5W`; renderer `n5Body()`. `jWords(5)` now returns these words (exam, progress). Old N5 words stay in the Dictionary. The PDF was a scan, typed by hand → the user may report typos ("သင်ခန်းစာ X ၊ word").

**v1.0.122 (2026-10-24, made by the user / another chat):** 漢字 tile in Discovery (`KALL()`, `renderKall()`, view `kall`, action `kall`): every kanji in the app, N5→N1 chips, search (kanji / kana / romaji / Myanmar), tap = speak example. 五十音 now lists all Dictionary words in kana order (`GJD()`). "Beta" badge on 歌 / 有名人 / TextMe tiles (`BETA_T`, CSS `.betab`); the crown is hidden on those tiles, but **tapping them without Pro still opens the Pro box** (user has not decided yet: free during beta, or show the crown again). MYAING tile in Pro is free. Acknowledgements text rewritten (Triple Gem, parents, teachers, friends, users). Known small issue: Latin-letter words (ATM, USB, Wi-Fi…) fall under 「あ」 in 五十音.

**v1.0.123 (2026-10-25):** **JLPT N3 Kanji now has 2 versions** with a switch at the top of the N3 Kanji tab (`S.k3v`, localStorage `myaing.k3v`, `k3vBar()`, `data-k3v`; default Version 2):
- **Version 2** = the user's PDF "N3 Kanji by Dokodemo" (scan, 9 units × 5 lessons; lesson 1-1 was sent later as a photo). **45 lessons, 405 kanji**, same lesson UI as N5/N4 (`KL3_RAW` → `KL3`, `KLA()` returns KL3 when `S.jl===3`). Each kanji: strokes, 音/訓, Myanmar + English meaning (`KEN`), 2–4 example words (JP / reading / Myanmar / English). Readings and strokes checked against the open kanji-data set (MIT). Only the kanji list and order come from the PDF; meanings and example words were written by Claude (the PDF looks like a scan of a published book, so its word lists, translations, drills and pictures were not copied). The user may report fixes as "N3 Kanji သင်ခန်းစာ X ၊ kanji".
- **Version 1** = the previous N3 list (`JK[3]` → `JKD[3]`, 373 rows, grid UI), kept unchanged.
- Lessons 1–2 of V2 are free, the rest need Pro. Both versions feed the 漢字 tile, Dictionary and `dictKanji()`. Progress totals and the N3 mock exam use V2.
- **N3 Kotoba "Version 2" was NOT made:** the user sent "N3_Kotoba_by_Dokodemo_.pdf" (197 pages), which is a scan of the commercial book 「はじめての日本語能力試験 N3 単語2000」 (Myanmar/Indonesian/Tagalog edition, CD tracks). Copying its words, translations and example sentences into the app was declined. Offered instead: an original N3 Kotoba V2 written by Dokodemo/Claude.

**v1.0.124 (2026-10-25):** **JLPT N3 Kotoba now has 2 versions** (switch at the top of the N3 Kotoba tab; `S.w3v`, localStorage `myaing.w3v`, `w3vBar()`, `data-w3v`; default Version 2):
- **Version 2** = the user's own typed list "N3 KOTOBA Standard 2400" (file N3_Kotoba_by_Dokodemo.pdf, 61 pages; hiragana / kanji / Myanmar meaning, no example sentences). **2,402 words**: Part 1 = 54 units (1,548), Part 2 = 19 units (854; Part 2 Unit 8 is marked "မရိုက်ထားပါ" in the file, so it is skipped). Data `N3K2_RAW` → `N3K2` (`{p,u,w:[{no,r,k,m}|{note}]}`), renderer `n3k2Body()` with Part buttons (`data-w3p`) and Unit chips (`data-w3u`). Row types kept from the file: numbered rows, `*` rows (related word, shown with ＊ and indented), unnumbered sub-rows under a group header (e.g. 出る → 授業に出る…, かける → かぎをかける…), yellow section labels (Part 2 Unit 11). Words also go into the Dictionary (lv 3). Progress total uses V2 when V2 is selected; the N3 mock exam still uses V1 (`jWords(3)`).
- The text was extracted from the PDF (Myanmar font glyphs decoded through the font's own tables, visual-order ေ/ြ fixed). The user's typing was kept as is, including small typos (e.g. 先年月日 for 生年月日, 指名 for 氏名 in Part 1 Unit 5).
- **Version 1** = the previous N3 list (`jWords(3)`, 3,246 words, IGM3 chapter chips), unchanged.
- The earlier PDF "N3_Kotoba_by_Dokodemo_.pdf" (197-page scan of the commercial book) was NOT used.

**v1.0.125 (2026-10-25):**
1. **N3 Kanji Version 1/2 switch removed** (user's choice): `k3vBar()` returns '' and `S.k3v` is always 2, so N3 Kanji shows only the 45 lessons / 405 kanji. The old list `JKD[3]` stays in the data (Dictionary, 漢字 tile).
2. **Abhidhamma Day text** (`ABD_TXT` my/ja/en, `isAbd()`, `abdToday()`): on every Thadingyut full moon (`mm===7 && mp===1`; 2026-10-26, 2027-10-15 …) the Sabbath marquee in the Myanmar-calendar card (`SBT()`, `.sbmq`) first shows a detailed text (Buddha's 7th vassa in Tavatimsa, teaching the 7 Abhidhamma books to his mother, summary to Sariputta, descent to Sankassa by the 3 staircases, 3-day festival of lights, gadaw to parents/teachers/elders, Pavarana, public holiday, good deeds), then the usual 8-precept text. The top Home marquee (`sbMsg()`) also shows a short Abhidhamma Day line on that day.

**v1.0.126 (2026-10-25) — JLPT 模試 full mock exam** (idea from studying jlptburmese.com: timed full test + section scores; only the feature idea was used, none of their content). The JLPT Exam page now has 2 modes (`data-jxm`, localStorage `myaing.jxmode`, default full):
- **📝 Full mock (本番形式)** — `jxfBuild/jxfStart/jxfBody/jxfSetup/jxfScore/jxfFinish/jxfShare` (code block "Full mock exam" before `startQuiz`). 44–48 questions: 漢字読み, 表記 (reading → kanji, new type), 語彙, 語彙② (Myanmar meaning → Japanese word, new type), 文法, 読解, 聴解. Time = sum per question (30 s / 45 s / 150 s / 120 s) ≈ 41–44 min; countdown timer (`#jxt`, red under 5 min, auto-submit at 0). No answers shown while testing; answers can be changed; prev/next + number grid (`data-jxgo`, `data-jxq`); submit with in-page confirm (`data-jxsub`). Kanji/表記 questions have no sound until review (it would give the answer away).
- Result card "Dokodemo 模試 · 結果": JLPT-style scaled score out of 180 (N1–N3: 言語知識 / 読解 / 聴解 each 0–60; N4–N5: 言語知識・読解 0–120 + 聴解 0–60), official pass lines (N1 100, N2 90, N3 95, N4 90, N5 80) and section minimums (19 / 38). Clearly marked as an estimate, not an official JLPT score or certificate. Review list with your answer, correct answer, Myanmar note, transcripts (`data-jxrev`); Share text (`data-jxshare`, Web Share or copy). History (last 30) in localStorage `myaing.jxhist`, last 5 per level shown on the setup screen.
- **⚡ Quick practice** = the old 20-question mode with instant answers (unchanged).
- Content is still small: reading 5–6 and listening 5 passages per level, N1/N2 grammar 6–8, N1/N2 kanji few. Writing more original reading/listening/grammar items is the next way to make the mock exam stronger.

**v1.0.127 (2026-10-25) — 過去問 (official past questions):** new free Discovery tile 「過去問 · မေးခွန်းဟောင်း」 (`data-a="kako"`, view `kako`, `renderKako()`; also a button on the JLPT Exam setup screen). It only **links** to the free official "JLPT Official Practice Workbook" on jlpt.jp (Vol.2 2018 = `sample2018`, Vol.1 2012 = `sample2012`; Vol.1 listening Q2 MP3 is under `sample2017`): per level the question PDFs (V/G/R/L), MP3 問題1–5 (N4/N5: 1–4), answer sheet, answers, script, plus the jlpt.jp sample-questions page. Nothing from the workbook is copied into the app (JLPT forbids reprinting questions). Myanmar "how to use" steps, and a ⏱ timer per test section with the real JLPT times (N1 110+55, N2 105+50, N3 30+70+40, N4 25+55+35, N5 20+40+30 min; `KAKO_SEC`), kept in localStorage `myaing.kkt` so it keeps running when the user opens the PDF outside the app (vibrate + toast at 0). Level/volume: `S.kkL`, `S.kkV`.
- Context: the user compared with jlptburmese.com (free mock tests, grammar dictionary, kanji flashcards/game) and Yurui Nihongo (sells N3 "old question" vocab/kanji + grammar e-books with videos, ¥3,000). Dokodemo Pro (¥4,000/year for N5–N1) is cheaper; ideas noted: "frequently tested" lists with Dokodemo's own examples, short grammar videos on the YouTube channel, use the owl mascot in ads.

**v1.0.128 (2026-10-25) — notification sound:**
1. `sw.js` push handler: `renotify:true`, `silent:false`, `vibrate`, `timestamp`. Before, every push reused the same tag (`dokodemo-sabbath`), so a new notification could silently replace the old one. It also `postMessage`s `{t:'push',title,body}` to open app windows.
2. App: `playChime()` (Web Audio bell, made in code, no sound file), `chimeOn()` (localStorage `myaing.chime`, default on), `notiTest()` (chime + a local test notification via the service worker). On a push message while the app is visible: chime + toast.
3. Menu → 🔔 Notifications: new rows "🔊 ခေါင်းလောင်းသံ" (on/off, `data-a="chime"`) and "▶️ အသံ စမ်းနားထောင်မယ်" (`data-a="notitest"`), plus a help box: when the app is closed, the sound is set by the phone (Android: Settings → Apps → Dokodemo/Chrome → Notifications → Sound; iPhone: Settings → Notifications → Dokodemo → Sounds; turn off Silent/DND). Web push cannot use a custom sound file.

**v1.0.129 (2026-10-25) — TextMe in-app message notification** (the user meant the in-app "Noti", not phone notifications): before, a chat reply appeared as text only, and the TextMe settings "Noti" (`SET.tmNoti`) and "Receive messages automatically" (`SET.tmSent`, `SET.tmSentT`) did nothing.
- `msgTone()` = short two-note message sound (Web Audio, made in code) + short vibrate.
- `tmArrive(c,jp,mm)` = every incoming message (chat replies and auto messages): adds the message and time; if `SET.tmNoti`: plays `msgTone()`, and if the user is not in that chat shows `tmBanner()` (top banner like a phone message: avatar, name, Japanese text, Myanmar line if `SET.tmMM`; tap opens the chat; hides after 5 s) and marks it unread.
- `tmAuto()` (every 30 s while the app is visible): if `SET.tmSent`, after `SET.tmSentT` minutes (30/60/180; last time in localStorage `myaing.tmlast`) a random contact sends a message from `TM_POOL` (20 casual lines, JP + Myanmar) or `TM_BOSS` (polite lines for 田中部長).
- TextMe settings row "Noti" now reads "အသိပေးချက် · 📩 message အသံ + စာ".

**v1.0.130 (2026-10-25) — iPhone bottom strip fix:** on the iPhone Home Screen app a darker grey band showed under the bottom nav (the page background `html,body` was #DDE3EE and `#app` did not reach the bottom of the screen). Now `html,body` = #F3F5F9 (same as `--bg`), `html:has(body.dark)` = #0B0F17, and `#app` uses `height:100dvh`.

**v1.0.131 (2026-10-25)** (user showed another app "Do Do" as the model):
1. **Splash** = one big 「ど」 drawn with SVG paths (navy strokes, red dakuten = the brand's red), on white, grows in (`dmkIn`) and the dakuten pop (`dmkDot`); no text; closes after 1.5 s or on tap. Old book/globe splash removed.
2. **Font size** = bottom sheet (`prefSheet('fsz')`): 115 / 110 / 105 / 100 / 95 / 90 / 85 / 80 % (old 120/130 → 115).
3. **Theme** = bottom sheet of 16 colour circles (`THEME_C`, `THEME_MM` Myanmar names): navy, sky, teal, forest, green, lime, gold, sunset, orange, red, sakura, pink, purple, violet, brown, black. Menu rows `data-c="fsz"` / `data-c="theme"` open the sheet instead of cycling.
4. **"Share with friends" and "Website" menu rows removed** (always hidden now, even in admin mode; `config.json` share/website no longer used).
5. User asked to stop people downloading the app from links shared earlier: the app no longer shows any download link. To make the old links stop working, the user must delete `Dokodemo.apk` (and optionally replace `download.html`) in BOTH repos on GitHub — bit.ly/dokodemoapk points to myaingstudy.github.io/Dokodemo.apk. Installed apps keep working.

**v1.0.132 (2026-10-25):** splash re-matched to the Do Do screen recording: the ど stays the same size (84 px, no grow/pop), fades in and "breathes" twice (opacity 1 → .35 → 1), very light lavender background #FCFAFE, closes after 2.3 s. Google login: the user is NOT doing the OAuth Branding / Play Store work yet.

**v1.0.133 (2026-10-25) — splash = old logo + new ど, in the user's order:** navy rounded square → book opens (`.bk`, 0.2 s) → globe rises out of the book (`.gl`, 0.65 s) → yellow orbit is drawn, back half then front half (`.orb`, 1.1 / 1.3 s) → red sun pops and glows (`.sun`, 1.7 s) → white ど is written stroke by stroke (`.ch1/.ch2`, 2.05 / 2.3 s) and the dakuten appear (`.ch3`, 2.75 s) → the old texts come in as before (Dokodemo, どこでも日本語, Learn Japanese Anywhere, dots; 3.0–3.3 s). Closes at 4.2 s or on tap. ど is drawn with SVG paths (no font needed). The Do Do-style breathing splash of v1.0.131–132 was replaced.

**v1.0.134 (2026-10-25) — removals (user's choice):**
1. Menu "🙋 Tester လိုနေပါတယ်" row removed (always hidden; `config.json` tester unused).
2. About page (Menu → App အကြောင်း, Pro → MYAING tile): simple text only — what the app is, what it covers (hiragana → N1, 3 languages), contact via Telegram/Email buttons. Removed the "Admin is not a sensei / gathered from books" text, the "Team" box and "ကျေးဇူးတင်ပါတယ်".
3. Acknowledgements box (ကျေးဇူးတင်လွှာ) removed.
4. Copyright / Credits row (`ab-credits`) removed from the menu (always hidden; `config.json` copyright unused). The © line at the bottom of About stays. (MIT notices inside the code comments of the Myanmar calendar library stay; they are not visible.)
5. **Songs removed:** 歌 tiles gone from Discovery and Pro; `UTA` and `UTA_LINK` data emptied (`[]`); `BETA_T` now only 有名人 / TextMe. `renderUta()` code is still there but unreachable.

**v1.0.135 (2026-10-25) — Telegram icon + Do Do-style motion:**
1. Telegram icon: About page button showed the ✈️ airplane emoji → now a round paper-plane icon. One helper `TGI(size, bg, fg)` is used everywhere (About button, Contact row, Menu → Social, Pro box, PDF note). The old simple path `M21 4L3 11…` is gone.
2. Motion copied from the user's Do Do screen recording (`FX` block before `fxKey()`):
   - Tab switch (bottom nav): **push slide** — old page (snapshot `FX.tabSnap`, without nav) slides out, new header + main slide in from the tab direction (280 ms).
   - Tiles: appear **row by row** with fade + scale (.86 → 1); CSS vars `--r` (row) / `--c` (column) on each tile.
   - Tile open: zoom from the tile is faster (360 ms) and a **skeleton shimmer** (`fxSkel()`, CSS `.fxsk`) shows during the zoom, then list rows fade in one by one. No extra waiting.
   - Back / push pages faster (300–330 ms). Drawer opens in 260 ms and its rows slide in one by one.
   - Pro box popup grows from small (scale .35 → 1).
   - Press feedback: tiles shrink to .94 when pressed, list rows darken; `html{touch-action:manipulation}` removes the tap delay.
   - Splash was NOT changed (user chose the v1.0.133 logo order). Reduced-motion users get no animation (`fxOK()`).

**Done 2026-10-23:**
1. APK rebuilt in PWABuilder for the new host: package `com.dokodemo.japanese`, version 1.0.120 / code 120, "Use mine" keystore (alias `my-key-alias`), notification delegation ON, Play billing OFF, start URL `/index.html`. Signing SHA-256 verified = `EA:A2:50:73…E3:94` (matches assetlinks). Uploaded as `Dokodemo.apk` to both repos.
2. Secret-scanning alert (Google API Key = public Firebase apiKey, index.html) on the **old** repo: harmless. The new repo shows the same ① alert; it can be closed as "Won't fix" or left alone.
3. Workflow updated to checkout@v5 / setup-node@v5 / Node 22; manual test run done.
4. Notifications: the user chose to keep only 07:00 and 20:00.

**Lessons learned (iPad):**
- PWABuilder zip timestamps are in UTC (JST − 9 h), so a build made in the morning in Japan shows yesterday's date.
- A URL bar inside the APK on Android meant the **old** APK (1.0.0.0, host myaingstudy → redirect) was still installed. Check Settings → Apps → Dokodemo → version first.
- To verify an APK, the user can attach it to the chat; Claude reads package, version, host and signing SHA-256 from the file.
- "Signing key: New" shows Key organization/country fields. If those fields are visible, the wrong option is selected.

**Next — Google Play Store** (details are in the Docs listing). Status 2026-10-25: Play Console account **not opened yet**; no testers yet (recruit post drafted with gifts: Pro 1 month + data/phone-bill gift, for testers who stay 14 days; never tie gifts to ratings/reviews):
- Play Console personal account ($25). ID check with the 在留カード (residence card).
- Recruit 15–20 Android testers for the closed test (12 testers for 14 days). The user has no testers yet; a recruiting post was drafted.
- Rebuild in PWABuilder: package ID unchanged, start_url `/?src=play`, notification delegation ON, "Use mine" keystore, target API 36, **version code 121 or higher** (APK already used 120). Upload the `.aab` to Play. After the first upload, add the Play app-signing SHA-256 to `assetlinks.json`.
- Before submitting: in-app privacy text and non-expiring reviewer Pro code (`PLAYREV-SQ4AXE`) → both DONE in v1.0.121.
- Store assets are ready: `feature-graphic-1024x500.png`, profile and cover images. Screenshots still need to be taken on the Android phone.

**Bitly:** bit.ly/dokodemoapk shows a Bitly "preview / security check" page when opened from Facebook (free plan, links to a .apk). Not an error. Suggest `https://dokodemojapanese.github.io/download.html` in posts instead. Offered to change the in-app Share/website rows to download.html — user has not answered yet.

**Other ideas the user mentioned:** 警察 (police) dialog phrases; more PDF links (format `PDFS=[{t,my,ja,en,lv,u}]`); a "become a tester" button.
