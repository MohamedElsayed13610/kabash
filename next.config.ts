import type { NextConfig } from "next";

const config: NextConfig = {
  // Lets a phone on the local network load dev resources (HMR) from this machine.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default config;
