import test from "node:test";
import assert from "node:assert/strict";
import { pickFirstAvailableSelector } from "../src/defaultSelectors.js";

test("pickFirstAvailableSelector prefers configured selector", async () => {
  const selected = await pickFirstAvailableSelector(async () => 0, "#custom", ["#a", "#b"]);
  assert.equal(selected, "#custom");
});

test("pickFirstAvailableSelector returns first available candidate", async () => {
  const counts = new Map([["#a", 0], ["#b", 1], ["#c", 1]]);
  const selected = await pickFirstAvailableSelector(async (s) => counts.get(s) ?? 0, "", ["#a", "#b", "#c"]);
  assert.equal(selected, "#b");
});
