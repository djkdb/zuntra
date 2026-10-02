import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

// Only public pages; everything behind login is excluded (and disallowed in robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${siteConfig.url}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${siteConfig.url}/demo`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteConfig.url}/signup`, lastModified, changeFrequency: "yearly", priority: 0.5 },
  ];
}
