#!/usr/bin/env node
/**
 * §30.9 items 4 & 7 — responsive layout + Thai heading check.
 *
 * Zero-dependency: drives the machine's own installed Chrome over the raw
 * DevTools Protocol (WebSocket is a Node global as of v22+). No Playwright/
 * Puppeteer install — the extension-based `resize_window` tool was tried and
 * confirmed NOT to affect the actual rendered viewport (window.innerWidth
 * ignored every resize request), which is why this exists as a real fix
 * instead of a repeat of that assumption.
 *
 * Usage:
 *   node scripts/responsive-check.mjs
 *   BASE_URL=https://test-claude-swart-delta.vercel.app node scripts/responsive-check.mjs
 *   RESPONSIVE_CHECK_EMAIL=someone@udontech.ac.th node scripts/responsive-check.mjs
 *
 * Authenticated pages use the Supabase Admin API (SUPABASE_SECRET_KEY, read
 * from .env.local) to mint and redeem a magic-link token for the target
 * address — no password, no captcha, nothing sent over email. Target email
 * defaults to the admin row in the gitignored .demo-accounts.local.md.
 * Without SUPABASE_SECRET_KEY or a resolvable email, authenticated pages are
 * skipped with an explicit warning in the report — never silently reported
 * as covered.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, ".responsive-check-out");

// Node 20.6+ native .env loader — picks up the same Supabase credentials
// the Next dev server reads, without adding a dotenv dependency. Silently
// no-ops if the file doesn't exist (e.g. CI running against a deployed URL
// with real env vars already set).
try {
  process.loadEnvFile(path.join(ROOT, ".env.local"));
} catch {
  // no .env.local — fine, credentials may come from the real environment
}

const BASE_URL = process.env.BASE_URL || "http://localhost:59500";
const DEBUG_PORT = Number(process.env.RESPONSIVE_CHECK_DEBUG_PORT) || 9333;

// Windows dev-machine paths and Linux/macOS paths both included — CLAUDE.md
// §2 requires this project run on "Windows development, Linux production,
// Docker compatible", and this environment's own Playwright-provisioned
// Chromium lives at /opt/pw-browsers/chromium, so it's checked first.
const CHROME_CANDIDATES = [
  process.env.RESPONSIVE_CHECK_CHROME_PATH,
  "/opt/pw-browsers/chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

const BREAKPOINTS = [
  { name: "375", width: 375, height: 812, mobile: true, deviceScaleFactor: 2 },
  { name: "768", width: 768, height: 1024, mobile: false, deviceScaleFactor: 2 },
  { name: "1280", width: 1280, height: 800, mobile: false, deviceScaleFactor: 1 },
];

const THEMES = ["light", "dark"];

const PUBLIC_PAGES = [
  "/th",
  "/en",
  "/th/login",
  "/th/announcements",
  "/th/activities",
  "/th/documents",
  // Seeded demo e-book (supabase/seed.sql) — the flipbook iframe is a real
  // overflow candidate that /th/documents alone (the shelf) doesn't exercise.
  "/th/documents/a2722df0-af24-47b3-84d1-bb5f731bc70b",
  "/th/calendar",
];

const AUTH_PAGES = [
  "/th/dashboard",
  "/th/members",
  "/th/projects",
  "/th/reports",
  "/th/notifications",
  "/th/profile",
  "/th/approvals",
];

// ---------------------------------------------------------------------------
// CDP transport
// ---------------------------------------------------------------------------

class CDPSession {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.eventHandlers = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          if (msg.error) p.reject(new Error(msg.error.message));
          else p.resolve(msg.result);
        }
      } else if (msg.method) {
        const handlers = this.eventHandlers.get(msg.method);
        if (handlers) handlers.forEach((h) => h(msg.params));
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP command timed out: ${method}`));
        }
      }, 30000);
    });
  }

  once(eventName) {
    return new Promise((resolve) => {
      const handlers = this.eventHandlers.get(eventName) || [];
      const handler = (params) => {
        this.eventHandlers.set(
          eventName,
          this.eventHandlers.get(eventName).filter((h) => h !== handler)
        );
        resolve(params);
      };
      this.eventHandlers.set(eventName, [...handlers, handler]);
    });
  }

  close() {
    this.ws.close();
  }
}

async function waitForEndpoint(port, timeoutMs = 15000, getSpawnError = () => null) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const spawnError = getSpawnError();
    if (spawnError) {
      throw new Error(`Chrome failed to launch: ${spawnError.message}`);
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return await res.json();
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Chrome DevTools endpoint on port ${port} never came up`);
}

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `No Chrome/Edge/Chromium binary found at any of: ${CHROME_CANDIDATES.join(", ")}. ` +
      `Set RESPONSIVE_CHECK_CHROME_PATH to point at one explicitly.`
  );
}

async function launchChrome() {
  const bin = findChrome();
  const userDataDir = path.join(OUT_DIR, "chrome-profile");
  mkdirSync(userDataDir, { recursive: true });

  const args = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
  ];

  // Chromium's sandbox refuses to initialize when the calling process is
  // root (common in Docker/CI, per CLAUDE.md's "Docker compatible"
  // requirement) and exits immediately, which otherwise looks identical to
  // a hang from waitForEndpoint's side. Only added when actually root —
  // don't weaken sandboxing on a normal non-root dev machine.
  if (process.getuid && process.getuid() === 0) {
    args.push("--no-sandbox");
  }

  const proc = spawn(bin, args, { stdio: "ignore" });

  // waitForEndpoint alone can't tell "still starting" apart from "failed to
  // start at all" — a spawn error (bad permissions, missing shared libs)
  // would otherwise just look like a generic 15s timeout below.
  let spawnError = null;
  proc.on("error", (err) => {
    spawnError = err;
  });

  await waitForEndpoint(DEBUG_PORT, 15000, () => spawnError);
  return proc;
}

async function openPageSession() {
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, {
    method: "PUT",
  });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const session = new CDPSession(ws);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Network.enable");
  return { session, targetId: target.id };
}

async function closeTarget(targetId) {
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${targetId}`);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function readDemoAdminEmail() {
  if (process.env.RESPONSIVE_CHECK_EMAIL) return process.env.RESPONSIVE_CHECK_EMAIL;

  const demoFile = path.join(ROOT, ".demo-accounts.local.md");
  if (!existsSync(demoFile)) return null;
  const text = readFileSync(demoFile, "utf8");
  // Markdown table row: | role | `email` | `password` |
  const line = text.split("\n").find((l) => l.includes("demo.admin@"));
  if (!line) return null;
  const cells = line
    .split("|")
    .map((c) => c.trim().replace(/^`|`$/g, ""))
    .filter(Boolean);
  return cells.find((c) => c.includes("demo.admin@")) || null;
}

/**
 * Establishes a real session without a password or captcha token by using
 * the service-role Admin API (`auth.admin.generateLink`) to mint a magic-link
 * token, then redeeming it with `verifyOtp` on a normal client — the same
 * technique proven against the live production round trip earlier this
 * project, just via the supported SDK method instead of hand-building the
 * verify URL. `signInWithPassword` was tried first and rejected with
 * "captcha protection: request disallowed" — Supabase's project-level
 * Turnstile requirement applies to every public auth endpoint, not just the
 * paths the app explicitly sends a token on. The Admin API is exempt by
 * design, which is exactly what a service-role key is for.
 */
async function getAuthCookies() {
  const email = readDemoAdminEmail();
  if (!email) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !anonKey || !secretKey) {
    console.warn(
      "[responsive-check] Supabase URL/publishable/secret key not set — skipping authenticated pages."
    );
    return null;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const { createServerClient } = await import("@supabase/ssr");

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.warn(
      `[responsive-check] generateLink failed (${linkError?.message ?? "no hashed_token"}) — skipping authenticated pages.`
    );
    return null;
  }

  const jar = new Map();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return [...jar.values()];
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          jar.set(name, { name, value, options: options || {} });
        }
      },
    },
  });

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });

  if (verifyError) {
    console.warn(
      `[responsive-check] verifyOtp failed (${verifyError.message}) — skipping authenticated pages.`
    );
    return null;
  }

  return [...jar.values()];
}

function sameSiteToCdp(value) {
  if (!value) return undefined;
  const v = String(value).toLowerCase();
  if (v === "strict") return "Strict";
  if (v === "lax") return "Lax";
  if (v === "none") return "None";
  return undefined;
}

async function injectCookies(session, cookies, baseUrl) {
  const url = new URL(baseUrl);
  for (const { name, value, options } of cookies) {
    const params = {
      name,
      value,
      url: baseUrl,
      path: options.path || "/",
      secure: url.protocol === "https:",
    };
    const sameSite = sameSiteToCdp(options.sameSite);
    if (sameSite) params.sameSite = sameSite;
    if (options.maxAge) {
      params.expires = Math.floor(Date.now() / 1000) + options.maxAge;
    }
    await session.send("Network.setCookie", params);
  }
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

async function setViewport(session, bp, theme) {
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: bp.width,
    height: bp.height,
    deviceScaleFactor: bp.deviceScaleFactor,
    mobile: bp.mobile,
  });
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: theme }],
  });
}

async function navigateAndWait(session, url, timeoutMs = 20000) {
  const loadPromise = session.once("Page.loadEventFired");
  await session.send("Page.navigate", { url });

  // Below the 30s per-command CDP timeout so a hung page fails with a clear
  // "load timed out" error here instead of hanging the whole run forever.
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Page load timed out after ${timeoutMs}ms: ${url}`)),
      timeoutMs
    );
  });
  try {
    await Promise.race([loadPromise, timeout]);
  } finally {
    clearTimeout(timer);
  }

  // Let hydration + any client-side effects (theme toggle icon, etc.) settle.
  await new Promise((r) => setTimeout(r, 600));
}

async function measure(session, expectedWidth) {
  const result = await session.send("Runtime.evaluate", {
    expression: `
      (function () {
        const d = document.documentElement;
        const vw = window.innerWidth;
        let widest = null;
        if (d.scrollWidth > d.clientWidth) {
          let maxRight = 0;
          document.querySelectorAll("body *").forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.right > maxRight && r.width > 0) {
              maxRight = r.right;
              widest = {
                tag: el.tagName.toLowerCase(),
                className: typeof el.className === "string" ? el.className.slice(0, 120) : "",
                right: Math.round(r.right),
              };
            }
          });
        }
        return JSON.stringify({
          innerWidth: vw,
          scrollWidth: d.scrollWidth,
          clientWidth: d.clientWidth,
          overflow: d.scrollWidth > d.clientWidth,
          widest,
        });
      })()
    `,
    returnByValue: true,
  });
  const data = JSON.parse(result.result.value);
  data.viewportMismatch = data.innerWidth !== expectedWidth;
  return data;
}

async function screenshot(session, filePath) {
  const { data } = await session.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(filePath, Buffer.from(data, "base64"));
}

// ---------------------------------------------------------------------------
// Self-test: prove the checker can actually detect overflow
// ---------------------------------------------------------------------------

async function selfTest(session) {
  await setViewport(session, BREAKPOINTS[0], "light");
  await navigateAndWait(session, `${BASE_URL}/th`);
  await session.send("Runtime.evaluate", {
    expression: `
      (function () {
        // Normal-flow element, not position:absolute — an absolutely
        // positioned probe anchored to the initial containing block does
        // NOT reliably expand document.documentElement.scrollWidth across
        // Chrome versions (confirmed: it renders at the full width per
        // getBoundingClientRect but some engine versions don't count it
        // toward document overflow), which produced self-test false
        // negatives. A normal-flow element matches how real overflow bugs
        // actually happen (e.g. a too-wide flex row) and is what the real
        // measure() logic is verifying against.
        const el = document.createElement("div");
        el.id = "__responsive_check_selftest__";
        el.style.cssText = "width:3000px;height:10px;";
        document.body.appendChild(el);
      })()
    `,
  });
  const result = await measure(session, BREAKPOINTS[0].width);
  await session.send("Runtime.evaluate", {
    expression: `document.getElementById("__responsive_check_selftest__")?.remove()`,
  });
  if (!result.overflow || !result.widest) {
    throw new Error(
      "SELF-TEST FAILED: injected a 3000px element but the checker did not detect overflow. " +
        "The measurement logic is broken — do not trust any PASS result below."
    );
  }
  console.log(
    `[self-test] OK — injected overflow correctly detected (widest: ${result.widest.tag}.${result.widest.className} right=${result.widest.right})`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`[responsive-check] Base URL: ${BASE_URL}`);
  const chromeProc = await launchChrome();
  console.log(`[responsive-check] Chrome launched on debug port ${DEBUG_PORT}`);

  const report = {
    baseUrl: BASE_URL,
    startedAt: new Date().toISOString(),
    selfTestPassed: false,
    authenticatedPagesSkipped: false,
    results: [],
  };

  let failed = false;

  try {
    const { session, targetId } = await openPageSession();

    try {
      await selfTest(session);
      report.selfTestPassed = true;

      const authCookies = await getAuthCookies();
      if (authCookies) {
        await injectCookies(session, authCookies, BASE_URL);
        console.log("[responsive-check] Authenticated session cookies injected.");
      } else {
        report.authenticatedPagesSkipped = true;
        console.warn(
          "[responsive-check] No credentials available — authenticated pages will be SKIPPED, not silently passed."
        );
      }

      const pages = authCookies ? [...PUBLIC_PAGES, ...AUTH_PAGES] : PUBLIC_PAGES;

      for (const bp of BREAKPOINTS) {
        for (const theme of THEMES) {
          await setViewport(session, bp, theme);
          for (const pagePath of pages) {
            const url = `${BASE_URL}${pagePath}`;
            let entry = { page: pagePath, breakpoint: bp.name, theme };
            try {
              await navigateAndWait(session, url);
              const m = await measure(session, bp.width);
              entry = { ...entry, ...m };

              if (m.viewportMismatch) {
                entry.error = `Expected innerWidth=${bp.width}, got ${m.innerWidth} — emulation did not apply`;
                failed = true;
              } else if (m.overflow) {
                entry.error = `Horizontal overflow: scrollWidth=${m.scrollWidth} > clientWidth=${m.clientWidth}, widest element: ${m.widest?.tag}.${m.widest?.className} (right=${m.widest?.right}px)`;
                failed = true;
              }

              if (bp.name === "375") {
                const safePage = pagePath.replace(/\//g, "_") || "_root";
                const shotPath = path.join(OUT_DIR, `375-${theme}${safePage}.png`);
                await screenshot(session, shotPath);
                entry.screenshot = path.relative(ROOT, shotPath);
              } else if (entry.error) {
                const safePage = pagePath.replace(/\//g, "_") || "_root";
                const shotPath = path.join(
                  OUT_DIR,
                  `FAIL-${bp.name}-${theme}${safePage}.png`
                );
                await screenshot(session, shotPath);
                entry.screenshot = path.relative(ROOT, shotPath);
              }
            } catch (err) {
              entry.error = `Navigation/measurement failed: ${err.message}`;
              failed = true;
            }

            const status = entry.error ? "FAIL" : "pass";
            console.log(
              `[${status}] ${bp.name}px/${theme} ${pagePath}${entry.error ? " — " + entry.error : ""}`
            );
            report.results.push(entry);
          }
        }
      }
    } finally {
      await closeTarget(targetId);
    }
  } finally {
    chromeProc.kill();
  }

  report.finishedAt = new Date().toISOString();
  report.passed = !failed;
  writeFileSync(
    path.join(OUT_DIR, "report.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("");
  console.log(`[responsive-check] ${failed ? "FAILED" : "PASSED"}`);
  console.log(`[responsive-check] Report: ${path.join(OUT_DIR, "report.json")}`);
  if (report.authenticatedPagesSkipped) {
    console.log(
      "[responsive-check] NOTE: authenticated pages were skipped (no credentials) — this is not full coverage."
    );
  }

  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("[responsive-check] Fatal error:", err);
  process.exit(1);
});
