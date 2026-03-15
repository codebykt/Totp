import express from "express";
import { createSalt, buildVerifier } from "./crypto.js";
import { readDb, withDb } from "./store.js";
import {
  createSession,
  destroySession,
  listRecords,
  getRecord,
  upsertRecord,
  deleteRecord,
  generateTotp,
  autoLogin,
  sessionSnapshots
} from "./vaultService.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(new URL("../public", import.meta.url).pathname));

function authToken(req) {
  return req.headers["x-vault-session"] || req.query.session;
}

function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };
}

app.get("/api/status", (req, res) => {
  const db = readDb();
  res.json({ initialized: Boolean(db.vault.salt && db.vault.verifier) });
});

app.post("/api/init", wrap(async (req, res) => {
  const { masterPassword } = req.body;
  if (!masterPassword || masterPassword.length < 10) {
    throw new Error("Master password must have at least 10 characters");
  }

  const db = readDb();
  if (db.vault.salt && db.vault.verifier) {
    throw new Error("Vault is already initialized");
  }

  const salt = createSalt();
  const verifier = buildVerifier(masterPassword, salt);
  withDb((current) => {
    current.vault.salt = salt;
    current.vault.verifier = verifier;
    return current;
  });
  res.json({ success: true });
}));

app.post("/api/unlock", wrap(async (req, res) => {
  const { masterPassword } = req.body;
  const token = createSession(masterPassword);
  res.json({ session: token });
}));

app.post("/api/lock", wrap(async (req, res) => {
  destroySession(authToken(req));
  res.json({ success: true });
}));

app.get("/api/records", wrap(async (req, res) => {
  res.json(listRecords(authToken(req)));
}));

app.get("/api/records/:id", wrap(async (req, res) => {
  res.json(getRecord(authToken(req), req.params.id));
}));

app.post("/api/records", wrap(async (req, res) => {
  upsertRecord(authToken(req), req.body);
  res.json({ success: true });
}));

app.delete("/api/records/:id", wrap(async (req, res) => {
  deleteRecord(authToken(req), req.params.id);
  res.json({ success: true });
}));

app.post("/api/records/:id/totp", wrap(async (req, res) => {
  res.json({ code: generateTotp(authToken(req), req.params.id) });
}));

app.post("/api/records/:id/auto-login", wrap(async (req, res) => {
  res.json(await autoLogin(authToken(req), req.params.id));
}));

app.get("/api/sessions", wrap(async (req, res) => {
  res.json(sessionSnapshots(authToken(req)));
}));

app.listen(port, () => {
  console.log(`Vault manager listening on http://localhost:${port}`);
});
