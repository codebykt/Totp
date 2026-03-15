import test from "node:test";
import assert from "node:assert/strict";
import { resolveLaunchOptions } from "../src/browserLaunch.js";

test("resolveLaunchOptions uses explicit executable path", () => {
  const previous = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  process.env.PLAYWRIGHT_EXECUTABLE_PATH = "/usr/bin/google-chrome";
  const opts = resolveLaunchOptions();
  assert.equal(opts.executablePath, "/usr/bin/google-chrome");
  delete process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  if (previous) process.env.PLAYWRIGHT_EXECUTABLE_PATH = previous;
});

test("resolveLaunchOptions uses channel when configured", () => {
  const prev = process.env.PLAYWRIGHT_CHANNEL;
  process.env.PLAYWRIGHT_CHANNEL = "chrome";
  const opts = resolveLaunchOptions();
  assert.equal(opts.channel, "chrome");
  if (prev) process.env.PLAYWRIGHT_CHANNEL = prev;
  else delete process.env.PLAYWRIGHT_CHANNEL;
});
