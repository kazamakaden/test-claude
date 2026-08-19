// TEMPORARY — Phase B gate, deleted as soon as it has answered.
//
// Same five checks as scripts/verify-jwt-minting.mjs, run on the server so no
// local Node setup is needed. The logic is duplicated rather than shared on
// purpose: the script is standalone by design (zero dependencies, runs without
// Next), and this file is about to be removed, so a shared module would be
// permanent scaffolding for a temporary question.
//
// ADMIN ONLY, and answers 404 rather than 403 for everyone else — an endpoint
// that exercises the JWT secret should not announce that it exists.
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth/get-role";

export const dynamic = "force-dynamic";

const b64url = (input: string) => Buffer.from(input).toString("base64url");
const sign = (data: string, secret: string) =>
  crypto.createHmac("sha256", secret).update(data).digest("base64url");

function mint(sub: string, secret: string, issuer: string, ttlSeconds = 300) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      sub,
      // PostgREST switches to this Postgres role. Without it the request is
      // treated as anon and every owner-scoped policy silently returns nothing.
      role: "authenticated",
      aud: "authenticated",
      iss: `${issuer}/auth/v1`,
      iat: now,
      exp: now + ttlSeconds,
    })
  );
  return `${header}.${payload}.${sign(`${header}.${payload}`, secret)}`;
}

/**
 * A one-time key, checked instead of a session.
 *
 * The admin-session gate proved unusable in practice: Route Handlers are
 * excluded from middleware (see middleware.ts's matcher), and middleware is
 * what refreshes the Supabase session cookie -- so a direct hit on /api/... can
 * see a signed-out caller while the site itself shows them signed in. That is
 * worth knowing for Phase B independently of this route.
 *
 * Safe to hardcode: it guards a diagnostic that returns no secret, no token and
 * no user data -- only pass/fail per check -- and the whole file is deleted as
 * soon as it has answered.
 */
const ACCESS_KEY = "f333dd756d9850f2db12ccfab7a60180";

const notFound = () =>
  new NextResponse("Not found", {
    status: 404,
    // Without this the browser caches the 404 and every later attempt is
    // served from cache without reaching the server -- which is exactly what
    // happened while debugging this route.
    headers: { "cache-control": "no-store, must-revalidate" },
  });

export async function GET(request: Request) {
  const presented = new URL(request.url).searchParams.get("key") ?? "";
  const keyOk =
    presented.length === ACCESS_KEY.length &&
    crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(ACCESS_KEY));

  // Either works. The session path is kept so the earlier URL still functions
  // for anyone who does have a live session in a normal window.
  const profile = await getSessionProfile();
  if (!keyOk && profile.role !== "admin") {
    return notFound();
  }

  const secret = process.env.SUPABASE_JWT_SECRET ?? "";
  const urlBase = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

  if (!secret) {
    return NextResponse.json({
      blocked: "SUPABASE_JWT_SECRET is not set in this environment.",
      hint: "Add it in Vercel (Production + Preview), then redeploy so the runtime picks it up.",
    });
  }

  // Whose identity to mint. The caller's own admin id, so the role assertion
  // below is distinctive — "admin", not the "student" a mis-resolved uid could
  // coincide with.
  const subject = new URL(request.url).searchParams.get("sub") ?? profile.userId;
  if (!subject) {
    return NextResponse.json({ blocked: "No subject id available." });
  }

  const results: { name: string; ok: boolean; detail: string }[] = [];
  const record = (name: string, ok: boolean, detail: string) => results.push({ name, ok, detail });

  // 0. Shape of the secret itself. A pasted credential goes wrong in boring
  // ways — a trailing newline, a truncated copy, or the wrong value entirely —
  // and none of those are visible from a signature mismatch alone.
  record("0. SUPABASE_JWT_SECRET shape", secret === secret.trim() && secret.length >= 32,
    `length ${secret.length}` +
      (secret !== secret.trim() ? " — HAS LEADING/TRAILING WHITESPACE, strip it" : "") +
      (secret.length < 32 ? " — shorter than any Supabase JWT secret; wrong value?" : "") +
      (secret.startsWith("sb_") || secret.startsWith("eyJ")
        ? " — this looks like an API KEY, not the JWT secret"
        : ""));

  // 1. Offline pre-check: does the secret verify a JWT this project issued?
  // DELIBERATELY NON-FATAL. An earlier version returned here on failure, which
  // meant a bad value in SUPABASE_LEGACY_ANON_KEY blocked us from learning the
  // real answer — the pre-check is a convenience, checks 2 and 3 are the gate.
  const knownJwt = (process.env.SUPABASE_LEGACY_ANON_KEY ?? "").trim();
  if (knownJwt) {
    const parts = knownJwt.split(".");
    if (parts.length !== 3) {
      record("1. offline pre-check", false,
        `SUPABASE_LEGACY_ANON_KEY is not a JWT (${parts.length} segment(s)). The legacy anon key starts with "eyJ"; a "sb_publishable_..." key is NOT a JWT. This says nothing about the secret.`);
    } else {
      let alg = "?";
      let ref = "?";
      try {
        alg = JSON.parse(Buffer.from(parts[0], "base64url").toString()).alg ?? "?";
        ref = JSON.parse(Buffer.from(parts[1], "base64url").toString()).ref ?? "?";
      } catch {
        /* leave as "?" */
      }
      const ok = sign(`${parts[0]}.${parts[1]}`, secret) === parts[2];
      record("1. secret verifies a JWT this project issued (offline)", ok,
        ok
          ? "the secret is correct"
          : `signature mismatch. Key alg=${alg}, project ref=${ref}. ` +
            (alg !== "HS256"
              ? "That key is not HS256, so this check cannot apply."
              : "Either SUPABASE_JWT_SECRET is the wrong value, or this anon key is from a different project. Checks 2-5 below are the real answer either way."));
    }
  } else {
    record("1. offline pre-check", true, "skipped (SUPABASE_LEGACY_ANON_KEY not set)");
  }

  const token = mint(subject, secret, urlBase);
  const headers = { apikey, Authorization: `Bearer ${token}` };

  // 2. THE GATE. A 401 means the project no longer accepts symmetric tokens.
  let res = await fetch(`${urlBase}/rest/v1/profiles?select=id&limit=1`, {
    headers,
    cache: "no-store",
  });
  record("2. PostgREST accepts our self-minted JWT", res.status === 200,
    `HTTP ${res.status}` + (res.status === 401 ? " — REJECTED; Phase B not viable as designed" : ""));

  if (res.status === 200) {
    // 3. Acceptance alone is not enough: a token can be accepted while
    // auth.uid() stays null, which makes every owner-scoped policy quietly
    // return zero rows instead of failing loudly. current_role() reads
    // profiles via auth.uid(), so the role coming back proves the claim was
    // read.
    res = await fetch(`${urlBase}/rest/v1/rpc/current_role`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    const role: unknown = res.ok ? await res.json() : null;
    record("3. auth.uid() resolves — current_role() returns the real role", role === "admin",
      `got ${JSON.stringify(role)} (HTTP ${res.status})` +
        (role === "admin" ? "" : " — if null/guest, the sub claim is not being read"));
  }

  // 4. Negative control. Without this, a project that accepted anything would
  // pass every check above.
  const forged = mint(subject, secret, urlBase).replace(/\.[^.]+$/, "." + sign("wrong", "not-the-secret"));
  res = await fetch(`${urlBase}/rest/v1/profiles?select=id&limit=1`, {
    headers: { apikey, Authorization: `Bearer ${forged}` },
    cache: "no-store",
  });
  record("4. a WRONGLY signed token is refused (control)", res.status === 401,
    `HTTP ${res.status}` + (res.status === 200 ? " — signatures are NOT being checked. Stop." : ""));

  // 5. Expiry is enforced by the server, not just by us.
  res = await fetch(`${urlBase}/rest/v1/profiles?select=id&limit=1`, {
    headers: { apikey, Authorization: `Bearer ${mint(subject, secret, urlBase, -60)}` },
    cache: "no-store",
  });
  record("5. an expired token is refused", res.status === 401, `HTTP ${res.status}`);

  // The verdict rests on checks 2 and 3 — acceptance AND auth.uid() resolving.
  // Check 1 is a convenience and check 0 is a paste-error catcher; neither
  // decides whether Phase B can work.
  const gate = results.find((r) => r.name.startsWith("2."));
  const uid = results.find((r) => r.name.startsWith("3."));
  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({
    admittedVia: keyOk ? "url key" : "admin session",
    sessionSeenByThisRouteHandler: {
      userId: profile.userId ? "present" : "none",
      role: profile.role,
    },
    passed: results.length - failed.length,
    total: results.length,
    verdict:
      gate?.ok && uid?.ok
        ? "VIABLE — self-minted JWTs are accepted and auth.uid() resolves"
        : "BLOCKED — send this output",
    results,
  });
}
