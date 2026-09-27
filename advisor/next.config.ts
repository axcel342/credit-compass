import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/prespend", destination: "/optimize", permanent: false }];
  },
};

export default nextConfig;
