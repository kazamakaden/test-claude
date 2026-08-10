import type { NextConfig } from "next";
import { assertDeployEnvConfigured } from "./lib/env-guard";

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
};

export default nextConfig;
