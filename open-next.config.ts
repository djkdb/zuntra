// OpenNext adapter config for Cloudflare Workers. See https://opennext.js.org/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Almost every page is per-user and dynamic, so no incremental (ISR) cache is configured.
// To cache static pages at the edge later, add an R2 incremental cache here.
export default defineCloudflareConfig({});
