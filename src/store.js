import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const DB_FILE = new URL("../data/db.json", import.meta.url);

const defaultDb = {
  vault: {
    salt: null,
    verifier: null
  },
  records: [],
  sessions: []
};

function ensureDb() {
  const path = DB_FILE.pathname;
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify(defaultDb, null, 2));
  }
}

export function readDb() {
  ensureDb();
  return JSON.parse(readFileSync(DB_FILE, "utf-8"));
}

export function writeDb(data) {
  writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

export function withDb(mutator) {
  const db = readDb();
  const updated = mutator(db) ?? db;
  writeDb(updated);
  return updated;
}
