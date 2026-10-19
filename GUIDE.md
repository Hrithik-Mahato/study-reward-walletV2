# Import Backup: Guide

This guide explains the Import backup feature, how to install and test it, and the engineering ideas behind it.

Throughout, **[Browser fact]** means established, documented browser behaviour, and **[My recommendation]** means a design choice I made that you could reasonably do differently.

---

## 1. What changed (files and reasons)

| File | Change | Why |
|---|---|---|
| `app.js` | Added one block (≈245 lines) before the service-worker registration. Nothing existing was edited except that block being inserted. | Reads, validates, confirms and restores a backup. |
| `index.html` | Wrapped the Export button in a button row and added: **Import backup** button, a hidden file input, a help sentence, a message area, and a confirmation `<dialog>`. | The UI for the feature. |
| `style.css` | Appended styles at the end (button row, message box, dialog, mobile tweaks). | Keep the visual design consistent on desktop and phones. |
| `service-worker.js` | Cache name `v1` → `v2`, and precache files with `cache: "reload"`. | **Required.** The worker is cache-first, so devices that already cached the app would never see the new files otherwise. |
| `README.md` | Updated the backup/restore and update instructions. | It previously said import was not included. |
| `GUIDE.md` | New (this file). | Documentation. |
| `manifest.json`, `icons/` | **Unchanged.** | Nothing needed. |

Things I checked in your existing code and kept as they are:

- Storage key: `studyRewardWallet.v1`.
- State shape: `{ goalPerSubject, missedValuePerConcept, days: { "YYYY-MM-DD": { entries: [{ id, subject, name, reward, difficultyLabel, time }] } } }`.
- **The export format is unchanged.** It is the raw state with no wrapper, so every backup you already made still imports. The importer recognises a backup by its *structure*, not by a label.
- Your export can contain days with `entries: []` (viewing a date creates an empty day in memory). The importer accepts these.

Pre-existing details I noticed but did **not** change (outside the requested scope):

- `saveState()` has no error handling, so a full-storage error while adding a concept would not be reported. The import has its own safe write path.
- The text "Default goal: 5 concepts each" and "Paid Amount From Parents (rs. 400)" in `index.html` are fixed text and do not follow your saved goal/rules.
- "Recent daily totals" shows only the 7 most recent dates. Older imported days are there; pick them with **Study date**.

---

## 2. How import works (the flow)

```
Choose file → read as text → JSON.parse → validate EVERYTHING → confirm dialog
  → save recovery copy → write localStorage → read it back → only then update `state` and re-render
```

If any step fails, the flow stops, a plain-language message is shown, and the live data is unchanged.

What is validated: valid JSON; a Study Reward Wallet shape (`days`, `goalPerSubject`, `missedValuePerConcept` all present); goal is a whole number 0–100; missed value is a number 0–100000; every date is a real calendar date `YYYY-MM-DD`; every day has an `entries` array; every entry has a non-empty string `id` (unique within the day), one of your four subjects, a name (1–200 characters) and a reward that is a number between 0 and 100000. File size must be ≤ 4 MB.

Safety measures:

- **Untrusted data.** The file is parsed with `JSON.parse` (which cannot run code), and only known fields are copied into a *new* object, so extra or malicious fields are dropped. Names are shown with `textContent` or the app's existing `safe()` escaping, so `<script>` text is displayed as text.
- **Recovery copy.** Before writing, the current raw data is saved under `studyRewardWallet.v1.preImport`. If that copy cannot be saved (storage nearly full), the import is cancelled rather than risking your data.
- **Rollback.** If the write or read-back check fails (for example a quota error), the previous data is restored and the app keeps showing it.
- **Undo import** button appears after a successful import (this session only). The recovery copy stays in storage until the next import.

---

## 3. Explanations for a beginner

### 3.1 Why a file input instead of pasting JSON?
- A backup file can be thousands of characters. Pasting on a phone keyboard is error-prone (lost characters, autocorrect, truncated clipboard).
- A file picker lets you choose the exact file from your phone's storage. **[Browser fact]** `<input type="file">` is the standard, supported way for a web page to receive a file the user chooses.
- The page never gets access to your file system. It only receives the file *you* pick.

```html
<input id="importFile" type="file" accept=".json,application/json" hidden>
<button id="importBtn">Import backup</button>
```
```js
importBtn.addEventListener("click", () => importFile.click()); // the button opens the picker
```

### 3.2 How the File API reads a file
**[Browser fact]** When you pick a file, the input's `change` event gives you a `File` object. A `FileReader` reads its contents *locally*, on your device:

```js
const reader = new FileReader();
reader.onload  = () => console.log(reader.result);  // the file's text
reader.onerror = () => console.log("could not read");
reader.readAsText(file);
```
No network request is made.

### 3.3 Why `JSON.parse()`?
What you read from the file is just one long string of characters. `JSON.parse(text)` converts it into real JavaScript objects and arrays, and throws an error if the text is not valid JSON (we catch it and show a message).

```js
const data = JSON.parse('{"goalPerSubject":5}');
data.goalPerSubject; // 5
```
**[Browser fact]** `JSON.parse` only builds data. It does not run code. (By contrast, `eval()` would run code and must never be used on files you did not write.)

### 3.4 Why validate before touching localStorage?
Because writing is hard to undo. If you saved first and checked later, a bad file could overwrite your real history, and the app might crash on the next load. **[My recommendation]** Check everything first, build a clean new object, write once. This is sometimes called making the operation *atomic*: it either fully succeeds or nothing changes.

### 3.5 Why the existing storage key?
`loadState()` reads `studyRewardWallet.v1` every time the app opens. If the import wrote somewhere else, the restored data would not appear after a reload, and you would have two competing copies. Writing to the same key means every existing feature (add, delete, settings, export) works on the restored data without any changes. The only extra key is the temporary safety copy.

### 3.6 In-memory state vs storage, and re-rendering
Your app has two copies of the data:
1. `state`, a JavaScript variable (what the screen is drawn from).
2. `localStorage`, saved text (what survives closing the browser).

The existing pattern is: change `state` → `saveState()` → `render()`. Import follows the same idea, but safer: write storage first, and only if that works, set `state = importedState` and call `render()`. `render()` rebuilds the totals, subject cards and history from `state`, so everything updates at once.

### 3.7 Why offline import needs no internet
Everything happens inside your device: the file is read from local storage by `FileReader`, parsed by JavaScript already loaded in the page, and written to `localStorage`. No step asks a server for anything. The only requirement for *offline* use is that the app itself (HTML/CSS/JS) is available offline, which is the service worker's job.

### 3.8 Service worker vs localStorage
| | Service worker + Cache Storage | localStorage |
|---|---|---|
| Stores | The **app's files** (`index.html`, `app.js`, …) | **Your data** (study history, settings) |
| Purpose | Let the app *open* offline | Let the app *remember* things |
| Changed by | Deploying a new version | Using the app / importing |

Importing changes localStorage only. Deploying changes the cache. That is why bumping the cache name (v1 → v2) is needed for the new button to reach devices, and why your data is *not* lost when the cache updates (tested: data survived the update).

### 3.9 Why this is manual sync, not automatic
There is no server and no account. Each browser keeps its own private storage. **[Browser fact]** localStorage is per browser, per device and per origin (`https://you.github.io` is a different origin from `http://localhost:8000`), and nothing copies it elsewhere. A backup file is a snapshot at the moment you exported. Import *replaces* the target (it does not merge), so the last device you export from "wins" when you import. **[My recommendation]** Treat it as "move/restore", not "sync": always export from the device that has the newest data.

### 3.10 localStorage limits, and when to consider IndexedDB or the cloud
**[Browser fact]** localStorage typically allows about 5 MB per origin (varies by browser), stores only strings, is synchronous (blocks the page while writing), and can be cleared by the user or by the browser (for example "Clear site data", or low-storage cleanup). It is not encrypted and is shared by every script on your origin.

**[My recommendation]** For this app (a few KB per month) localStorage is fine. Consider:
- **IndexedDB** if the data becomes large (thousands of entries, attachments) or you need queries.
- **Cloud sync** (a backend with login) only if you want automatic syncing between devices. That adds accounts, security, hosting, and conflict handling, which is a big step for a personal tool.

---

## 4. Browser-specific limitations (Android)

I tested in Chromium (desktop and Pixel 7 emulation, including offline mode and the service worker). I could **not** test on a physical Android phone, so treat the points below accordingly.

- **[Browser fact]** Service workers and installation need HTTPS (or `localhost`). GitHub Pages gives you HTTPS. Opening `index.html` from a `file://` path does not enable offline caching.
- **[Browser fact]** `<dialog>` is supported by current Chrome, Edge, Firefox and Safari. If a browser lacks it, the app falls back to a standard confirm prompt.
- **File picker greys out the file** (reported behaviour, varies by phone/file manager): some Android pickers decide whether a file is selectable using its MIME type, not just its name. If your `.json` appears greyed out, try opening the picker's "Documents/Browse" or "Files" source instead of "Recent", or rename the file so it ends exactly in `.json` (not `.json.txt`). The app checks the file's *contents*, not its name.
- **Downloaded file names** may become `study-reward-wallet-backup (1).json` on repeated exports. That is fine.
- **Installed app vs browser tab** *(unverified on your device)*: on Android Chrome, an installed PWA normally uses the same site storage as Chrome for that address, but this can differ between browsers/launchers. After importing, open the app the way you will normally use it and check the data is there. If it is not, import again *from inside that installed app*.
- **Browsers can evict site data** if the device is very low on storage or if you clear browsing data. Export regularly. **[My recommendation]** Keep a backup in a place that is not the phone's browser (cloud drive, email to yourself, your PC).

---

## 5. Install the update (replace your project files)

1. Make a copy of your current project folder somewhere safe.
2. Unzip `study-reward-wallet-updated.zip`.
3. Copy these files into your project folder, replacing the old ones: `app.js`, `index.html`, `style.css`, `service-worker.js`, `README.md`, and add `GUIDE.md`. Leave `manifest.json` and `icons/` as they are.
4. Open the project and confirm `service-worker.js` starts with `study-reward-wallet-v2`.

## 6. Test locally

1. In the project folder run `python -m http.server 8000` (or use VS Code Live Server).
2. Open `http://localhost:8000` in Chrome or Edge.
3. If you previously opened this app on `localhost`, refresh two or three times, waiting a couple of seconds between refreshes (the new service worker downloads in the background and takes over on a later load). You can force it in DevTools → Application → Service Workers → "Unregister", then reload.
4. You should see **Export history** and **Import backup** side by side under "Concepts logged".

## 7. Deploy to GitHub Pages

1. Replace the files in your repository with the updated ones (upload through the GitHub web page, or `git add .`, `git commit -m "Add import backup"`, `git push`).
2. Wait 1–2 minutes for Pages to rebuild (Settings → Pages shows the status).
3. Open your Pages address **while online** and refresh two or three times, waiting a couple of seconds between refreshes. The Import button should appear (in my tests it took 2–3 refreshes). (**[Browser fact]** a service worker updates in the background and the new version is used on the next load.)
4. On your phone, open the same address while online and refresh the same way (or close and reopen the installed app a few times) so it caches the new version, then use it offline.

Reminder: `https://<you>.github.io/study-reward-wallet/` and `http://localhost:8000` are different origins and have different data. Use the same address you intend to keep using for real data.

## 8. Move a backup from PC to Android

1. On the PC, open the app at your real address and press **Export history**. A file `study-reward-wallet-backup.json` goes to your Downloads folder.
2. Transfer it: USB cable (copy into the phone's Download folder), or send it to yourself (email, messaging app, cloud drive) and download it on the phone.
3. On the phone, open the app (online once to load/cache the latest version; offline is fine afterwards).
4. Tap **Import backup** → choose the file (Downloads or wherever you saved it).
5. Read the confirmation (it shows the backup vs. what is on the phone now), then tap **Replace with backup**.
6. Check the totals, then use **Study date** to look at older days.

## 9. Everyday use

- **Backup habit:** after a study session, or at least weekly, press **Export history** and keep the file somewhere safe.
- **Switching device:** export on the device with the newest data, import on the other. Do not log new concepts on both devices between exports. The later import overwrites the other device's records.
- **Before importing onto a device that has records you want:** press Export history there first.
- **Mistake?** Press **Undo import** straight away. After you leave the page, the safety copy still exists in the browser but there is no button for it, so Export first when in doubt.

## 10. Manual testing checklist

Tick each item. (I ran automated versions of A–F plus extras in Chromium; run the real-phone ones yourself.)

**A. PC → phone**
- [ ] On the PC add several concepts on at least two dates, with Easy/Medium/Hard and one Custom reward.
- [ ] Change the daily goal and missed value, press Save rules.
- [ ] Export history; copy the file to the phone.
- [ ] On the phone, Import → confirm. Records, rewards, goal and missed value match the PC.

**B. Offline import**
- [ ] Open the app online once. Turn on airplane mode.
- [ ] Reopen the app (header shows "Offline mode"). Import the file. Data appears; reload and it is still there.

**C. Invalid backup**
- [ ] Import a text file renamed `.json`, an empty file, and a JSON file with `"reward": -5`. Each shows a clear red message and your data is unchanged.

**D. Cancelled import**
- [ ] Choose a valid backup, press Cancel (or Esc). "Import cancelled" appears; nothing changed.
- [ ] Open the picker and back out without choosing a file. Nothing changes.

**E. Existing data on the phone**
- [ ] Add a concept on the phone first. Import the PC backup. The dialog says the device already has records and shows both sets of numbers.
- [ ] After confirming, the phone-only concept is gone (replaced, not merged). Press **Undo import** and it returns.

**F. Dates and settings**
- [ ] Switch **Study date** across several days. Each shows the same entries and totals as the PC.
- [ ] Goal and missed-value inputs under "Goals and missed-day rules" match the PC.

**G. Regression**
- [ ] Add and delete a concept after importing. Change the date. Save rules. Export again. All still work.
- [ ] Refresh the page; data remains.
