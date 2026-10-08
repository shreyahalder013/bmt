import AttendanceManager from '@/components/AttendanceManager';
export const dynamic = 'force-dynamic';
export default function AttendancePage() { return <main className="admin-page"><div className="admin-header"><div><p className="eyebrow">Institute management</p><h1>Attendance</h1><p>Mark one student at a time with a mobile-friendly form. Attendance starts empty.</p></div><a className="btn b2" href="/admin">Dashboard</a></div><AttendanceManager /></main>; }
