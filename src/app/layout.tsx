import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { siteConfig } from "@/lib/site";
import "./globals.css";


export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.title, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#13181d" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-background font-sans text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          본문으로 건너뛰기
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
