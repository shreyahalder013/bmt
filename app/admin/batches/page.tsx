import BatchManager from '@/components/BatchManager';
import EnrollmentManager from '@/components/EnrollmentManager';
export const dynamic = 'force-dynamic';
export default function BatchesPage() { return <main className="admin-page"><div className="admin-header"><div><p className="eyebrow">Institute management</p><h1>Batches</h1><p>Create schedules and capacity limits before enrolling students.</p></div><a className="btn b2" href="/admin">Dashboard</a></div><BatchManager /><EnrollmentManager /></main>; }
