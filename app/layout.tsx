// app/layout.tsx
import { Public_Sans } from "next/font/google";
import { headers } from "next/headers";
import { ApplyThemeScript } from "@/components/theme-toggle";
import { getAppConfig } from "@/lib/utils";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

interface RootLayoutProps {
  children: React.ReactNode;
}

export const metadata = {
  icons: {
    icon: "/favicon.png",
  },
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const hdrs = await headers();
  const { accent, accentDark, pageTitle, pageDescription } = await getAppConfig(hdrs);

  const styles = [
    accent ? `:root { --primary: ${accent}; }` : "",
    accentDark ? `.dark { --primary: ${accentDark}; }` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <head>
        {styles && <style>{styles}</style>}
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <ApplyThemeScript />
        {/* Preload background for quicker first paint */}
        <link rel="preload" href="/background2.jpg" as="image" />
      </head>
      <body className={`${publicSans.variable} overflow-x-hidden antialiased bg-transparent`}>
        {/* Fixed global background layer behind everything */}
        <div className="app-bg" aria-hidden />

        {/* Providers render TopBanner, MenuBar, Audio renderer, QueryProvider, etc. */}
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
