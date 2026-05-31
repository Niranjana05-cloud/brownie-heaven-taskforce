import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: "script-src 'self' 'unsafe-eval' 'unsafe-inline';",
        },
      ],
    },
  ],
};

export default nextConfig;
