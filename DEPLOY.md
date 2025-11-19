Steps to hide secrets and deploy

1) Local .env (optional)
- Copy `.env.example` to `.env` and fill values.

2) Recommended: set Functions runtime config (so values are available to `clientConfig` function)
- Run (PowerShell):

```powershell
firebase functions:config:set \
  client.apiKey="<API_KEY>" \
  client.authDomain="<AUTH_DOMAIN>" \
  client.projectId="<PROJECT_ID>" \
  client.storageBucket="<STORAGE_BUCKET>" \
  client.messagingSenderId="<MESSAGING_SENDER_ID>" \
  client.appId="<APP_ID>"
```

3) Deploy functions and hosting

```powershell
# Deploy functions and hosting (recommended)
firebase deploy --only functions,hosting

# Or deploy everything
firebase deploy
```

4) Notes
- The client fetches `/__/clientConfig` (hosting rewrites route to the function). The function returns the public firebase config for the client. The client API key will still be visible to the browser (Firebase apiKey is not a secret in the usual sense), but this moves credentials out of source files.
- If you prefer using environment variables in the Functions runtime instead of functions config, you can set the OS environment variables on your CI system or use `process.env.*`.
- If you make changes to `functions/index.js`, run `npm --prefix functions run lint` or `npm --prefix functions run deploy` as needed.
