import type { NextConfig } from "next";
import { assertDeployEnvConfigured } from "./lib/env-guard";
import { enforcedCsp, reportOnlyCsp } from "./lib/csp";

assertDeployEnvConfigured();

const nextConfig: NextConfig = {
  // Skew protection: tags every request/asset with the build that produced
  // it, so a browser tab left open across a redeploy keeps requesting its
  // OWN build's JS chunks (rather than 404-ing against the new deployment's
  // content-hashed filenames and surfacing as an unrecoverable client-side
  // ChunkLoadError — the leading theory for the /members "Something went
  // wrong" report, since the page reproduces clean against real production
  // data under both `next dev` and a real `next build && next start`).
  // VERCEL_DEPLOYMENT_ID is Vercel's own auto-injected value; unset locally,
  // where this feature doesn't apply anyway.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,

  // §19. See lib/csp.ts for why this is two headers rather than one, and
  // which half is enforced today.
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: enforcedCsp() },
          { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp(isDev) },
          // Cheap, unrelated to CSP, and the same class of "should always
          // have been set" header.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
