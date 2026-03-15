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

## Browser setup (use your existing browser)

This app can use your already-installed browser for auto-login (no Playwright browser download required).

Set one of these before `npm start`:

```bash
# Option A: use Chrome channel (recommended)
export PLAYWRIGHT_CHANNEL=chrome

# Option B: provide exact browser executable path (Chrome/Ulaa/Chromium)
export PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/google-chrome
# e.g. Ulaa path if installed:
# export PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/ulaa
```

Optional:

```bash
# Show browser UI during auto-login (default is headless=true)
export BROWSER_HEADLESS=false
```

## How auto-login works

For each site record, provide:

- `loginUrl`
- CSS selector for username (`usernameField`)
- CSS selector for password (`passwordField`)
- CSS selector for submit button (`submitSelector`)

If those are not provided, the app tries built-in default selectors (username/email/password/submit patterns) and also tries common OTP/TOTP inputs automatically. You can prefill these in UI with **Apply default selectors**.
- Optional `extraFieldSelectors` JSON map:
  - selector -> `"totp"` to auto-fill current TOTP code
  - selector -> custom field key from `otherFields`

The app executes a headless browser login and stores `storageState` in local JSON DB.

## Security note

This tool is local-only and intended for personal environments. Keep your machine secure and choose a strong master password.
