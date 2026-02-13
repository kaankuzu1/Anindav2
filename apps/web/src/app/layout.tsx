import type { Metadata } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });
const instrumentSerif = Instrument_Serif({ weight: '400', subsets: ['latin'], variable: '--font-instrument-serif' });

export const metadata: Metadata = {
  title: 'Mindora Systems - Intelligent Outreach',
  description: 'Intelligent outreach platform with inbox warm-up, campaign sequencing, and deliverability protection',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} ${instrumentSerif.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
