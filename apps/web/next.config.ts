import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages are shipped as TypeScript source.
  transpilePackages: ["@tbo/i18n", "@tbo/core"],
  async redirects() {
    // Old marketplace URLs (bookmarks, app links) land on the new product.
    return [
      { source: "/auth/login", destination: "/auth/sign-in", permanent: true },
      { source: "/auth/register", destination: "/auth/sign-up", permanent: true },
      { source: "/dashboard/:path*", destination: "/office", permanent: false },
      { source: "/driver", destination: "/office", permanent: false },
      { source: "/admin/:path*", destination: "/office", permanent: false },
    ];
  },
};

export default nextConfig;
