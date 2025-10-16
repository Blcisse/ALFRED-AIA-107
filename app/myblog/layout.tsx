// app/myblog/layout.tsx
import { Public_Sans } from "next/font/google";
import { headers } from "next/headers";
import { getAppConfig } from "@/lib/utils";
import "./../globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

export default async function MyBlogLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const { pageTitle, pageDescription } = await getAppConfig(hdrs);

  // Minimal layout (RootLayout already provides TopBanner/MenuBar via ClientProviders)
  return (
    <div
      className={`${publicSans.variable} overflow-x-hidden antialiased bg-transparent min-h-screen`}
      aria-label="myBlog layout"
    >
      {children}
    </div>
  );
}
