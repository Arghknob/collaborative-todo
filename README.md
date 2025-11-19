# Collaborative Todo

A small collaborative real-time todo app built on Firebase (Hosting, Firestore, Cloud Functions, FCM).

This repository contains a client (in `public/`) and Cloud Functions (in `functions/`) that send notifications when messages/tasks change. The client uses the Firebase web SDK to authenticate and read/write Firestore.

**Project Structure**
- `public/` — static site served by Firebase Hosting
  - `index.html`, `dashboard.html`, `room.html` and `js/`, `css/`
- `functions/` — Firebase Cloud Functions (notifications, helper HTTP endpoint)
- `firebase.json` — Firebase config for hosting, functions, rules
- `firestore.rules`, `firestore.indexes.json` — Firestore security and indexes

**What changed (notes)**
- The client now fetches its Firebase config from the `clientConfig` HTTPS function at `/__/clientConfig`. This keeps config out of source files.
- A `clientConfig` HTTP function was added to `functions/index.js`. It returns runtime config read from `functions.config().client` or from environment variables.
- A hosting rewrite was added to `firebase.json` to map `/__/clientConfig` to the `clientConfig` function.
- A `.env.example` and `DEPLOY.md` were added to help set environment values and deploy.

Why: While the Firebase `apiKey` used on the web is not a secret in practice, moving values out of source control helps centralize secret management and avoid accidentally committing other secrets.

---

**Prerequisites**
- Node.js (the `functions` package declares `node` engine 22)
- npm
- Firebase CLI installed and logged in (`npm install -g firebase-tools`)
- A Firebase project created (with Firestore, Hosting and Cloud Messaging enabled)

**Quick setup & deploy (recommended)**
1. Install function deps (from repo root):

```powershell
npm --prefix functions install
```

2. Select or add your Firebase project (one-time):

```powershell
firebase login
firebase use --add
```

3. Set the client config in Functions runtime (recommended). Replace values with your Firebase project's values. PowerShell example (use backticks as line continuation):

```powershell
firebase functions:config:set `
  client.apiKey="<API_KEY>" `
  client.authDomain="<AUTH_DOMAIN>" `
  client.projectId="<PROJECT_ID>" `
  client.storageBucket="<STORAGE_BUCKET>" `
  client.messagingSenderId="<MESSAGING_SENDER_ID>" `
  client.appId="<APP_ID>"
```

Alternatively you can set environment variables on your CI or server to populate `process.env.FIREBASE_*` used by the function fallback.

4. Deploy functions and hosting:

```powershell
firebase deploy --only functions,hosting
```

or deploy everything:

```powershell
firebase deploy
```

5. Local emulation (dev):

```powershell
firebase emulators:start --only functions,hosting
# visit http://localhost:5000 (port may vary or be printed by the emulator)
```

**Testing the client config endpoint locally**
- While emulators are running, you can open `http://localhost:5000/__/clientConfig` (or the printed local hosting URL) to confirm the function returns the expected Firebase client config.

**Notes about secrets and the Firebase API key**
- The Firebase web `apiKey` is used to configure the SDK in the browser and is not a private secret in the same way server API keys are. However, you should still avoid committing service account keys or other private credentials to the repo.
- For server-side credentials (service account keys), store them securely (secret manager, CI secrets, or environment variables) and never add them to the repository.
