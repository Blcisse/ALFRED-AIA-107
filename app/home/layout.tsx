import { Public_Sans } from 'next/font/google';
import { headers } from 'next/headers';
import { getAppConfig } from '@/lib/utils';
import TopBanner from '@/components/TopBanner';
import { MenuBar } from '@/components/MenuBar';
import './../globals.css';

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
});

export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const { pageTitle, pageDescription } = await getAppConfig(hdrs);

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <title>{pageTitle} - Home</title>
        <meta name="description" content={pageDescription} />
      </head>
      <body className={`${publicSans.variable} overflow-x-hidden antialiased bg-transparent`}>
        <TopBanner />
        <div className="relative z-10 min-h-screen pt-16">
          {children}
          <MenuBar />
        </div>
      </body>
    </html>
  );
}