import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Acceso administrativo | Ministerio Vida en la Palabra',
  robots: { index: false, follow: false },
};
export default function AdminLayout({ children }: { children: React.ReactNode }) { return children; }
