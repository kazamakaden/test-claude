import type { NextConfig } from "next";
import { assertDeployEnvConfigured } from "./lib/env-guard";

assertDeployEnvConfigured();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
