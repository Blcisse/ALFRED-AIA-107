// app/settings/layout.tsx
import { Public_Sans } from 'next/font/google';
import { headers } from 'next/headers';
import { getAppConfig } from '@/lib/utils';
import './../globals.css';

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
});

// Removed localFont for CommitMono
// const commitMono = localFont({
//   src: [
//     { path: './fonts/CommitMono-400-Regular.otf', weight: '400', style: 'normal' },
//     { path: './fonts/CommitMono-700-Regular.otf', weight: '700', style: 'normal' },
//   ],
//   variable: '--font-commit-mono',
// });

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const { pageTitle, pageDescription } = await getAppConfig(hdrs);

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <title>{pageTitle} - Settings</title>
        <meta name="description" content={pageDescription} />
      </head>
      <body className={`${publicSans.variable} overflow-x-hidden antialiased bg-transparent`}>
        <header className="w-full h-16 bg-gray-800 text-white flex items-center px-4">
          <h2>Settings</h2>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}