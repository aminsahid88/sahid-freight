import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages are shipped as TypeScript source.
  transpilePackages: ["@tbo/i18n", "@tbo/core"],
};

export default nextConfig;
