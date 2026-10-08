import TestManager from '@/components/TestManager';
export const dynamic = 'force-dynamic';
export default function TestsPage() { return <main className="admin-page"><div className="admin-header"><div><p className="eyebrow">Institute management</p><h1>Tests and marks</h1><p>Create tests for active batches. Results start empty and are never auto-published.</p></div><a className="btn b2" href="/admin">Dashboard</a></div><TestManager /></main>; }
