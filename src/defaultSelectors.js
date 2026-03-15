export const DEFAULT_SELECTORS = {
  usernameField: [
    'input[name="username"]',
    'input[name="email"]',
    'input[type="email"]',
    '#username',
    '#email',
    'input[id*="user"]',
    'input[id*="email"]'
  ],
  passwordField: [
    'input[name="password"]',
    'input[type="password"]',
    '#password',
    'input[id*="pass"]'
  ],
  submitSelector: [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[id*="login"]',
    'button[name*="login"]',
    'button:has-text("Sign in")',
    'button:has-text("Log in")'
  ],
  totpField: [
    'input[name="otp"]',
    'input[name="totp"]',
    'input[name="code"]',
    'input[id*="otp"]',
    'input[id*="totp"]',
    'input[id*="2fa"]',
    'input[id*="mfa"]'
  ]
};

export async function pickFirstAvailableSelector(locatorCountFn, configured, candidates) {
  if (configured && String(configured).trim()) {
    return configured;
  }

  for (const selector of candidates) {
    const count = await locatorCountFn(selector);
    if (count > 0) {
      return selector;
    }
  }
  return null;
}
