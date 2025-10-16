// app/tasks/layout.tsx
import { Public_Sans } from 'next/font/google';
import { headers } from 'next/headers';
import { getAppConfig } from '@/lib/utils';
import './../globals.css';

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
});

export default async function TasksPageLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const { pageTitle, pageDescription } = await getAppConfig(hdrs);

  // Segment wrapper only; root layout controls <html>/<body> and background
  return (
    <div className={`${publicSans.variable} overflow-x-hidden antialiased bg-transparent`}>
      {children}
    </div>
  );
}
