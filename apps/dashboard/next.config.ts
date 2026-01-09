import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Next.js to find packages from parent node_modules (Bun hoisting)
  // This is needed for Bun's dependency hoisting behavior
  transpilePackages: [
    '@xyflow/react',
    '@cloudscape-design/components',
    '@cloudscape-design/global-styles',
    '@xterm/addon-fit',
    '@xterm/xterm',
  ],

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:9889/:path*",
      },
    ];
  },
};

export default nextConfig;
