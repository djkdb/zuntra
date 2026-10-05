// OpenNext adapter config for Cloudflare Workers. See https://opennext.js.org/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Prerendered routes (landing, demo, OG images) are served from the build output instead of
// re-rendering on Workers, where the OG fonts on disk are not available. Nothing uses ISR.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
