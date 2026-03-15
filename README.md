# Local Password + Session Manager

A local-first Node.js application to manage:

- Site credentials (`username`, `password`)
- TOTP seeds and generated codes
- Custom fields for any site
- Automated login runs with Playwright
- Saved browser storage/session snapshots for quick re-use

## Features

1. **Encrypted local vault**: A master password unlocks records encrypted with AES-256-GCM.
2. **Credential records**: Save site URL, login URL, credentials, selectors, and additional fields.
3. **TOTP support**: Store a TOTP secret and generate codes on demand.
4. **Background auto-login**: Use Playwright to fill login forms and submit.
5. **Session dashboard**: View stored login session snapshots.

## Quick start

```bash
npm install
npm start
```

Open: `http://localhost:3000`

## How auto-login works

For each site record, provide:

- `loginUrl`
- CSS selector for username (`usernameField`)
- CSS selector for password (`passwordField`)
- CSS selector for submit button (`submitSelector`)
- Optional `extraFieldSelectors` JSON map:
  - selector -> `"totp"` to auto-fill current TOTP code
  - selector -> custom field key from `otherFields`

The app executes a headless browser login and stores `storageState` in local JSON DB.

## Security note

This tool is local-only and intended for personal environments. Keep your machine secure and choose a strong master password.
