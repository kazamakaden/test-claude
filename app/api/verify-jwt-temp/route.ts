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

export async function GET(request: Request) {
  const profile = await getSessionProfile();
  if (profile.role !== "admin") {
    return new NextResponse("Not found", { status: 404 });
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

  // 1. Offline: is the secret even right? Cheap and decisive — a wrong secret
  // makes every check below fail for a reason that looks like a server problem.
  const knownJwt = process.env.SUPABASE_LEGACY_ANON_KEY ?? "";
  if (knownJwt) {
    const [h, p, s] = knownJwt.split(".");
    const ok = Boolean(h && p && s && sign(`${h}.${p}`, secret) === s);
    record("1. secret verifies a JWT this project issued (offline)", ok,
      ok ? "the secret is correct" : "signature mismatch — wrong SUPABASE_JWT_SECRET");
    if (!ok) return NextResponse.json({ results, verdict: "BLOCKED: wrong JWT secret" });
  } else {
    record("1. offline secret check", true, "skipped (SUPABASE_LEGACY_ANON_KEY not set)");
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

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({
    passed: results.length - failed.length,
    total: results.length,
    verdict: failed.length
      ? "BLOCKED — send this output"
      : "VIABLE — self-minted JWTs are accepted and auth.uid() resolves",
    results,
  });
}
