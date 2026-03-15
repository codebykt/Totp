import { randomUUID } from "node:crypto";
import { authenticator } from "otplib";
import { chromium } from "playwright";
import { deriveKey, encryptJson, decryptJson, verifyMasterPassword } from "./crypto.js";
import { readDb, withDb } from "./store.js";
import { resolveLaunchOptions } from "./browserLaunch.js";

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

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(record.loginUrl, { waitUntil: "domcontentloaded" });

  if (record.usernameField) {
    await page.fill(record.usernameField, record.username ?? "");
  }
  if (record.passwordField) {
    await page.fill(record.passwordField, record.password ?? "");
  }

  if (record.extraFieldSelectors && typeof record.extraFieldSelectors === "object") {
    for (const [selector, fieldName] of Object.entries(record.extraFieldSelectors)) {
      const value = fieldName === "totp" ? (record.totpSecret ? authenticator.generate(record.totpSecret) : "") : record.otherFields?.[fieldName] ?? "";
      await page.fill(selector, value);
    }
  }

  if (record.submitSelector) {
    await Promise.all([
      page.waitForLoadState("networkidle").catch(() => undefined),
      page.click(record.submitSelector)
    ]);
  }

  const storageState = await context.storageState();
  await browser.close();

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
