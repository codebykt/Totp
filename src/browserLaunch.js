import { existsSync } from "node:fs";
import { delimiter } from "node:path";

function isExecutableInPath(command) {
  const paths = (process.env.PATH || "").split(delimiter);
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];

  for (const dir of paths) {
    for (const ext of extensions) {
      const candidate = `${dir}/${command}${ext}`;
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function firstExisting(paths = []) {
  for (const p of paths) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

export function resolveLaunchOptions() {
  const headless = process.env.BROWSER_HEADLESS !== "false";
  const explicitPath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  if (explicitPath) {
    return {
      headless,
      executablePath: explicitPath
    };
  }

  const channel = process.env.PLAYWRIGHT_CHANNEL || "chrome";
  // Prefer system-installed branded browser channels first.
  if (["chrome", "msedge", "chrome-beta", "msedge-beta", "msedge-dev", "chrome-dev", "chromium"].includes(channel)) {
    return { headless, channel };
  }

  // Fallback to explicit binary probing for Linux/common paths including Ulaa.
  const fromPath = [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "microsoft-edge",
    "microsoft-edge-stable",
    "ulaa"
  ].map(isExecutableInPath).find(Boolean);

  const fromKnownPaths = firstExisting([
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/opt/google/chrome/chrome",
    "/usr/bin/microsoft-edge",
    "/usr/bin/ulaa"
  ]);

  if (fromPath || fromKnownPaths) {
    return { headless, executablePath: fromPath || fromKnownPaths };
  }

  // Final fallback: old behavior (Playwright-managed Chromium, if installed)
  return { headless };
}
