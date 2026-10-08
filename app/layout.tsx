import type { Metadata } from 'next';
import './globals.css';
import './admin.css';
import './mobile.css';
import './public.css';
import './admin-nav.css';
import './dashboard.css';
import './operations.css';
import './brand.css';
import './media-pipeline.css';
import MobileNav from '@/components/MobileNav';
import PublicMedia from '@/components/PublicMedia';
export const metadata: Metadata = { title: 'Brilliant Minds Tutorials | Coaching Classes for Class I–XII in Lucknow', description: 'Brilliant Minds Tutorials offers academic coaching for Class I–XII in Udaiganj, Lucknow.', metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'), alternates: { canonical: '/' }, icons: { icon: '/logo.jpeg', apple: '/logo.jpeg' }, openGraph: { title: 'Brilliant Minds Tutorials | Coaching Classes for Class I–XII in Lucknow', description: 'Academic coaching for Class I–XII in Udaiganj, Lucknow.', type: 'website', images: [{ url: '/logo.jpeg', width: 1080, height: 1080, alt: 'Brilliant Minds Tutorials logo' }] } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}<PublicMedia /><MobileNav /></body></html>; }
