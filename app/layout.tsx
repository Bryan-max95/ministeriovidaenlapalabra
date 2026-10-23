import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site-url';
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Ministerio Vida en la Palabra - RMS',
  description:
    'Sistema web de registro de visitantes y control de visitas para Ministerio Vida en la Palabra.',
  openGraph: {
    title: 'Ministerio Vida en la Palabra - RMS',
    description:
      'Sistema web de registro de visitantes y control de visitas para Ministerio Vida en la Palabra.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ministerio Vida en la Palabra - RMS',
    description:
      'Sistema web de registro de visitantes y control de visitas para Ministerio Vida en la Palabra.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es-HN"
      className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="font-sans antialiased bg-[#F8FAFC] text-[#0B1D3A]"
      >
        {children}
      </body>
    </html>
  );
}
