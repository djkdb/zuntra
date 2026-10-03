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
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/og/**"],
    "/twitter-image": ["./assets/og/**"],
    // pg picks its Cloudflare socket via the "workerd" export condition, which Node's file
    // tracing does not follow; include it so the Cloudflare (OpenNext) bundle can resolve it.
    "/**/*": ["./node_modules/pg-cloudflare/**/*"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
