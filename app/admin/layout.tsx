import AdminNav from '@/components/AdminNav';
export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <><AdminNav />{children}</>; }
