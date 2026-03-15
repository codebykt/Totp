import { randomUUID } from "node:crypto";
import { authenticator } from "otplib";
import { chromium } from "playwright";
import { deriveKey, encryptJson, decryptJson, verifyMasterPassword } from "./crypto.js";
import { readDb, withDb } from "./store.js";
import { resolveLaunchOptions } from "./browserLaunch.js";
import { DEFAULT_SELECTORS, pickFirstAvailableSelector } from "./defaultSelectors.js";

authenticator.options = { step: 30, window: 1 };

const activeSessions = new Map();

function requireSession(token) {
  const session = activeSessions.get(token);
  if (!session) {
    throw new Error("Unauthorized: unlock vault first.");
  }
  return session;
}

function sanitizeRecord(record) {
  return {
    id: record.id,
    label: record.label,
    siteUrl: record.siteUrl,
    loginUrl: record.loginUrl,
    usernameField: record.usernameField,
    passwordField: record.passwordField,
    submitSelector: record.submitSelector,
    extraFieldSelectors: record.extraFieldSelectors,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export function createSession(masterPassword) {
  const db = readDb();
  if (!db.vault.salt || !db.vault.verifier) {
    throw new Error("Vault is not initialized.");
  }
  if (!verifyMasterPassword(masterPassword, db.vault.salt, db.vault.verifier)) {
    throw new Error("Invalid master password.");
  }

  const token = randomUUID();
  const key = deriveKey(masterPassword, db.vault.salt);
  activeSessions.set(token, { key, createdAt: Date.now() });
  return token;
}

export function destroySession(token) {
  activeSessions.delete(token);
}

export function listRecords(token) {
  const { key } = requireSession(token);
  const db = readDb();
  return db.records.map((record) => {
    const decrypted = decryptJson(record.secretBlob, key);
    return {
      ...sanitizeRecord(record),
      username: decrypted.username,
      hasPassword: Boolean(decrypted.password),
      hasTotp: Boolean(decrypted.totpSecret),
      otherFieldCount: Object.keys(decrypted.otherFields ?? {}).length
    };
  });
}

export function getRecord(token, id) {
  const { key } = requireSession(token);
  const db = readDb();
  const record = db.records.find((item) => item.id === id);
  if (!record) {
    throw new Error("Record not found");
  }
  return {
    ...sanitizeRecord(record),
    ...decryptJson(record.secretBlob, key)
  };
}

export function upsertRecord(token, input) {
  const { key } = requireSession(token);
  const now = new Date().toISOString();
  return withDb((db) => {
    const id = input.id || randomUUID();
    const existing = db.records.find((r) => r.id === id);
    const secretBlob = encryptJson(
      {
        username: input.username ?? "",
        password: input.password ?? "",
        totpSecret: input.totpSecret ?? "",
        otherFields: input.otherFields ?? {}
      },
      key
    );

    if (existing) {
      Object.assign(existing, {
        label: input.label,
        siteUrl: input.siteUrl,
        loginUrl: input.loginUrl,
        usernameField: input.usernameField,
        passwordField: input.passwordField,
        submitSelector: input.submitSelector,
        extraFieldSelectors: input.extraFieldSelectors ?? {},
        secretBlob,
        updatedAt: now
      });
      return db;
    }

    db.records.push({
      id,
      label: input.label,
      siteUrl: input.siteUrl,
      loginUrl: input.loginUrl,
      usernameField: input.usernameField,
      passwordField: input.passwordField,
      submitSelector: input.submitSelector,
      extraFieldSelectors: input.extraFieldSelectors ?? {},
      secretBlob,
      createdAt: now,
      updatedAt: now
    });

    return db;
  });
}

export function deleteRecord(token, id) {
  requireSession(token);
  return withDb((db) => {
    db.records = db.records.filter((item) => item.id !== id);
    return db;
  });
}

export function generateTotp(token, id) {
  const record = getRecord(token, id);
  if (!record.totpSecret) {
    throw new Error("No TOTP secret configured for this record");
  }
  return authenticator.generate(record.totpSecret);
}

export async function autoLogin(token, id) {
  const record = getRecord(token, id);
  if (!record.loginUrl) {
    throw new Error("Login URL is required for auto-login");
  }

  const launchOptions = resolveLaunchOptions();
  let browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (error) {
    throw new Error(`Failed to launch browser for auto-login. Set PLAYWRIGHT_EXECUTABLE_PATH to your installed browser (Chrome/Ulaa/Chromium) or PLAYWRIGHT_CHANNEL=chrome. Root error: ${error.message}`);
  }
  let storageState;
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(record.loginUrl, { waitUntil: "domcontentloaded" });

    const countFor = async (selector) => page.locator(selector).count().catch(() => 0);

    const usernameSelector = await pickFirstAvailableSelector(countFor, record.usernameField, DEFAULT_SELECTORS.usernameField);
    const passwordSelector = await pickFirstAvailableSelector(countFor, record.passwordField, DEFAULT_SELECTORS.passwordField);
    const submitSelector = await pickFirstAvailableSelector(countFor, record.submitSelector, DEFAULT_SELECTORS.submitSelector);

    if (usernameSelector) {
      await page.locator(usernameSelector).first().fill(record.username ?? "");
    }
    if (passwordSelector) {
      await page.locator(passwordSelector).first().fill(record.password ?? "");
    }

    const extraSelectors = record.extraFieldSelectors && typeof record.extraFieldSelectors === "object"
      ? { ...record.extraFieldSelectors }
      : {};

    if (record.totpSecret && !Object.values(extraSelectors).includes("totp")) {
      const detectedTotpSelector = await pickFirstAvailableSelector(countFor, null, DEFAULT_SELECTORS.totpField);
      if (detectedTotpSelector) {
        extraSelectors[detectedTotpSelector] = "totp";
      }
    }

    for (const [selector, fieldName] of Object.entries(extraSelectors)) {
      const value = fieldName === "totp" ? (record.totpSecret ? authenticator.generate(record.totpSecret) : "") : record.otherFields?.[fieldName] ?? "";
      if (await countFor(selector)) {
        await page.locator(selector).first().fill(value);
      }
    }

    if (submitSelector) {
      await Promise.all([
        page.waitForLoadState("networkidle").catch(() => undefined),
        page.locator(submitSelector).first().click()
      ]);
    }

    storageState = await context.storageState();
  } finally {
    await browser.close().catch(() => undefined);
  }

  withDb((db) => {
    const snapshot = db.sessions.find((s) => s.recordId === id);
    if (snapshot) {
      snapshot.storageState = storageState;
      snapshot.updatedAt = new Date().toISOString();
      return db;
    }
    db.sessions.push({
      recordId: id,
      storageState,
      updatedAt: new Date().toISOString()
    });
    return db;
  });

  return { success: true, message: `Auto-login completed for ${record.label}` };
}

export function sessionSnapshots(token) {
  requireSession(token);
  const db = readDb();
  return db.sessions;
}
