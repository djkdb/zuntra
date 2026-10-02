import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/demo"],
      disallow: ["/api/", "/dashboard", "/trips", "/settings", "/onboarding", "/admin", "/auth/"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
