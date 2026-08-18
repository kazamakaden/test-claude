/**
 * Phase B gate: does PostgREST accept a JWT this app signs itself?
 *
 * Everything in Phase B (our own Google OAuth, our own session, Supabase as
 * database-only) rests on one premise: a token we sign with the project's JWT
 * secret is accepted, and `auth.uid()` resolves from its `sub`. 38 of this
 * project's 83 RLS policies depend on that. If it does not hold, the approach
 * is dead and the fallback is Google-ID-token exchange (signInWithIdToken).
 *
 * This has to run on YOUR machine: the authoring environment's network policy
 * denies CONNECT to *.supabase.co, so it cannot be proven there.
 *
 * Run:
 *   node scripts/verify-jwt-minting.mjs
 *
 * Needs SUPABASE_JWT_SECRET. Get it from
 *   Supabase → Project Settings → API → JWT Settings → JWT Secret
 * (labelled "legacy JWT secret" on newer projects). Put it in .env.local —
 * NOT in the repo, NOT in chat. The script never prints it.
 *
 * Zero dependencies: Node 18+ built-ins only.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// --- tiny .env.local loader (no dotenv dependency) -------------------------
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const SECRET = process.env.SUPABASE_JWT_SECRET ?? "";
const URL_BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const APIKEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
// Optional. Any JWT this project issued works — it is only used to check the
// secret offline before spending a network round trip.
const KNOWN_JWT = process.env.SUPABASE_LEGACY_ANON_KEY ?? "";
// Whose identity to mint. Defaults to an admin so the role assertion below is
// distinctive ("admin", not the "student" a mis-resolved uid might coincide
// with). Override: node scripts/verify-jwt-minting.mjs <profile-uuid> <role>
const SUBJECT = process.argv[2] ?? "0a6c1938-c3e2-467e-b08e-cbe2f0fc264a";
const EXPECTED_ROLE = process.argv[3] ?? "admin";

const missing = [
  !SECRET && "SUPABASE_JWT_SECRET",
  !URL_BASE && "NEXT_PUBLIC_SUPABASE_URL",
  !APIKEY && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
].filter(Boolean);
if (missing.length) {
  console.error("Missing: " + missing.join(", ") + "\nSet them in .env.local and re-run.");
  process.exit(2);
}

const b64url = (input) => Buffer.from(input).toString("base64url");
const sign = (data, secret) =>
  crypto.createHmac("sha256", secret).update(data).digest("base64url");

function mint(sub, ttlSeconds = 300) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      sub,
      // PostgREST switches to this Postgres role; without it the request is
      // treated as anon and every owner-scoped policy silently returns nothing.
      role: "authenticated",
      aud: "authenticated",
      iss: `${URL_BASE}/auth/v1`,
      iat: now,
      exp: now + ttlSeconds,
    })
  );
  return `${header}.${payload}.${sign(`${header}.${payload}`, SECRET)}`;
}

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "\n        " + detail : ""}`);
};

// --- 1. offline: is the secret even right? --------------------------------
// Cheap and decisive. A wrong secret makes every check below fail for a reason
// that looks like a server problem, so rule it out first.
if (KNOWN_JWT) {
  const [h, p, s] = KNOWN_JWT.split(".");
  const ok = h && p && s && sign(`${h}.${p}`, SECRET) === s;
  record("1. secret verifies a JWT this project issued (offline)", Boolean(ok),
    ok ? "the secret is correct" : "signature mismatch — wrong SUPABASE_JWT_SECRET; stop here");
  if (!ok) process.exit(1);
} else {
  console.log("SKIP  1. offline secret check (set SUPABASE_LEGACY_ANON_KEY to enable)");
}

const token = mint(SUBJECT);
const headers = { apikey: APIKEY, Authorization: `Bearer ${token}` };

// --- 2. online: does PostgREST accept the signature? ----------------------
// THE GATE. A 401 here means the project no longer accepts symmetric tokens
// and Phase B as designed cannot work.
let res = await fetch(`${URL_BASE}/rest/v1/profiles?select=id&limit=1`, { headers });
record("2. PostgREST accepts our self-minted JWT", res.status === 200,
  `HTTP ${res.status}${res.status === 401 ? " — token REJECTED. Phase B is not viable as designed; fall back to signInWithIdToken." : ""}`);
if (res.status !== 200) process.exit(1);

// --- 3. does auth.uid() actually resolve to our sub? ----------------------
// Acceptance alone is not enough: a token could be accepted while auth.uid()
// stays null, which would make every owner-scoped policy quietly return
// nothing. current_role() reads profiles via auth.uid(), so the role coming
// back proves the claim was read.
res = await fetch(`${URL_BASE}/rest/v1/rpc/current_role`, {
  method: "POST",
  headers: { ...headers, "content-type": "application/json" },
  body: "{}",
});
const role = res.ok ? (await res.json()) : null;
record(`3. auth.uid() resolves — current_role() returns "${EXPECTED_ROLE}"`,
  role === EXPECTED_ROLE,
  role === EXPECTED_ROLE
    ? `RLS sees us as ${role}`
    : `got ${JSON.stringify(role)} (HTTP ${res.status}). If null/guest, the sub claim is not being read.`);

// --- 4. negative control: a BAD signature must be refused ----------------
// Without this, a project that accepted anything would pass everything above.
const forged = mint(SUBJECT).replace(/\.[^.]+$/, "." + sign("wrong", "not-the-secret"));
res = await fetch(`${URL_BASE}/rest/v1/profiles?select=id&limit=1`, {
  headers: { apikey: APIKEY, Authorization: `Bearer ${forged}` },
});
record("4. a WRONGLY signed token is refused (control)", res.status === 401,
  `HTTP ${res.status}${res.status === 200 ? " — signature is not being checked at all. Stop." : ""}`);

// --- 5. an expired token must be refused ---------------------------------
const expired = mint(SUBJECT, -60);
res = await fetch(`${URL_BASE}/rest/v1/profiles?select=id&limit=1`, {
  headers: { apikey: APIKEY, Authorization: `Bearer ${expired}` },
});
record("5. an expired token is refused", res.status === 401, `HTTP ${res.status}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("Phase B is blocked. Send me this output.");
  process.exit(1);
}
console.log("Phase B is viable — self-minted JWTs are accepted and auth.uid() resolves.");
