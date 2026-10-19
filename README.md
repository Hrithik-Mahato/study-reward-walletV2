# Study Reward Wallet

A beginner-friendly, offline-capable study tracker that rewards completed concepts with **virtual motivation money**.

## What it does

- Tracks four subjects: MERN Stack, System Command, MLT, and BDM.
- Starts with a goal of 5 concepts per subject per day (20 total).
- Lets you log a concept and choose Easy (₹10), Medium (₹20), Hard (₹30), or a custom reward.
- Shows earned value, missed-goal value, net motivation score, subject progress, and recent daily totals.
- Lets you change the daily target and the virtual value of each unfinished concept.
- Saves data in this browser using `localStorage`.
- Exports a JSON backup of your history and imports it again on any device (**Export history** / **Import backup**).
- Caches the app shell so it can load offline after the first successful visit.
- Can be installed as a PWA in supported browsers.

## Reward rules

Default rewards are ₹10 / ₹20 / ₹30. For example, completing 5 concepts in each of the 4 subjects at an average reward of ₹20 gives **₹400 earned**.

The “missed-goal value” is not real money and nothing is deducted from an actual balance. It is a score showing the virtual reward value of concepts remaining below your goal. With a goal of 5 per subject, each subject is evaluated separately. If you complete 3 concepts in one subject and 5 in each of the others, 2 concepts remain below goal.

## Run locally

A service worker requires `localhost` or HTTPS; opening `index.html` directly with `file://` will not enable offline caching.

### Option A: VS Code + Live Server
1. Extract this folder.
2. Open it in VS Code.
3. Install the **Live Server** extension if needed.
4. Right-click `index.html` and choose **Open with Live Server**.

### Option B: Python local server
From this folder, run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy to GitHub Pages

1. Create a new GitHub repository, for example `study-reward-wallet`.
2. Upload all files and folders from this project to the repository root.
3. In GitHub, open **Settings → Pages**.
4. Under the build/deployment source, choose **Deploy from a branch**.
5. Choose `main` and `/ (root)`, then save.
6. Wait for the published URL and open it once while online.

GitHub Pages serves the static app over HTTPS, which supports service workers. No backend or account is required.

## Test offline

1. Open the app online and wait for it to finish loading.
2. Add a test concept.
3. In browser DevTools, open **Application → Service Workers** (Chrome/Edge) and confirm the worker is active.
4. Turn off your internet or choose DevTools **Network → Offline**, then reload.
5. Confirm the app still opens and the saved concept is still there.

## Backup and restore (moving data between devices)

Your data lives only in the browser on each device, so devices do **not** sync automatically. Use a backup file to move or protect your data:

1. On the device that has your data, press **Export history**. A file named `study-reward-wallet-backup.json` is downloaded.
2. Copy that file to the other device (USB cable, a file-transfer app, email to yourself, etc.).
3. On the other device, open Study Reward Wallet and press **Import backup**, then choose the file.
4. The app checks the whole file first. If it is valid, it shows what will change and asks you to confirm.
5. After you confirm, **all data on that device is replaced** by the backup (it is not merged): history, rewards, goals and missed-goal rules.

Safety behaviour:

- An invalid, damaged or unrelated file is rejected and your current data is left untouched.
- Cancelling at any point changes nothing.
- Before replacing anything, the app keeps a copy of the data it is about to replace (browser key `studyRewardWallet.v1.preImport`). If saving fails, the old data is put back automatically. Right after a successful import, an **Undo import** button is shown.
- The file is only read and parsed as data. Nothing inside it is ever executed, and nothing is uploaded anywhere.
- Backups made by earlier versions of this app can still be imported.

Browser data can be cleared by the browser or by you, and each browser/profile/origin has its own separate storage (for example `localhost` and your GitHub Pages address do not share data). Export regularly.

## Updating an already-installed copy

The service worker caches the app files. After you deploy a new version, open the app while online and refresh it two or three times, waiting a couple of seconds between refreshes (the new version is downloaded in the background and used from the next load). The cache name in `service-worker.js` (`study-reward-wallet-v2`) must be changed every time you change app files, otherwise devices keep serving the old files.

## Why these engineering choices?

- **Vanilla HTML, CSS, and JavaScript:** keeps the first version readable and easy to learn without a framework build step.
- **`localStorage`:** fits a small personal tracker that needs to remember entries on one device without a server. It is not a cloud database.
- **Service worker:** caches the app's static files so the interface can open when the network is unavailable.
- **Web app manifest:** tells compatible browsers the app's name, colors, icon, and standalone display preference for installation.
- **Virtual rewards instead of real money:** keeps this a safe motivation tool; no payment, bank, or wallet integration exists.
- **Separate subject goals:** prevents progress in one subject from hiding a missed target in another.

## Possible next upgrades

- Weekly/monthly charts and streaks.
- Edit an existing concept entry.
- A “rest day” or grace-day option so missed targets encourage reflection instead of guilt.
- Optional reminders, if you later want notifications.
