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
  experimental: {
    // Trip tabs are fully prefetched and reused for a short while instead of a server round trip
    // per click. Every mutation clears them (server actions revalidate; see refreshPages for API calls).
    staleTimes: { dynamic: 30, static: 60 },
  },
  reactStrictMode: true,
  // OG image fonts are read from disk at build time.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/og/**"],
    "/twitter-image": ["./assets/og/**"],
    // pg picks its Cloudflare socket via the "workerd" export condition, which Node's file
    // tracing does not follow; include it so the Cloudflare (OpenNext) bundle can resolve it.
    "/**/*": ["./node_modules/pg-cloudflare/**/*"],
  },
  // Prisma's wasm loader makes file tracing match the whole project. The Workers bundle imports
  // every traced .wasm, so leave out build/dev tooling or it blows past the 64 MiB size limit.
  outputFileTracingExcludes: {
    "/**/*": [
      "./.open-next/**",
      "./.wrangler/**",
      "./node_modules/{prisma,wrangler,miniflare,workerd,rolldown,typescript,esbuild,vitest,shadcn,cloudflare,effect,pretendard,ts-morph}/**",
      "./node_modules/@prisma/{dev,engines,studio-core,fetch-engine,get-platform}/**",
      "./node_modules/{@electric-sql,@cloudflare,@opennextjs,@rolldown,@esbuild,@vitest,@playwright,@ast-grep,@oxc-project,@unrs,@napi-rs,@tailwindcss,@typescript-eslint,@shadcn,@ts-morph,@img}/**",
      "./node_modules/@next/swc-*/**",
      "./node_modules/{playwright,playwright-core,lightningcss,lightningcss-*,eslint,eslint-*}/**",
    ],
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
