import StudentManager from '@/components/StudentManager';
export const dynamic = 'force-dynamic';
export default function StudentsPage() { return <main className="admin-page"><div className="admin-header"><div><p className="eyebrow">Institute management</p><h1>Students</h1><p>Add and archive student records. Student data starts empty and is never seeded with demo records.</p></div><a className="btn b2" href="/admin">Dashboard</a></div><StudentManager /></main>; }
