import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Geolocation is needed later for "현재 위치"; camera for journal photos. Everything else off.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // OG image fonts are read from disk at build time.
  outputFileTracingIncludes: { "/opengraph-image": ["./assets/og/**"], "/twitter-image": ["./assets/og/**"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
