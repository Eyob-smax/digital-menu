import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Pin the workspace root to this project.
   *
   * There is a stray package-lock.json in C:\Users\Hello, and without this
   * Next infers that directory as the root, warns, and writes its build
   * output somewhere `next start` then cannot find.
   */
  turbopack: {
    root: path.resolve(process.cwd()),
  },

  /**
   * Item images are pasted URLs from arbitrary hosts, so next/image
   * optimisation is left off for them (the app uses plain <img>). This
   * keeps remote patterns from silently blocking a valid image an admin adds.
   */
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
