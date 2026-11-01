import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // A stray lockfile in the user's home directory otherwise wins the root
  // inference and Next warns on every start.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
