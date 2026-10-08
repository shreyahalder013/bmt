import { db } from '@/lib/db';
import AdminInbox from '@/components/AdminInbox';
export const dynamic = 'force-dynamic';

export default async function Inbox() {
	try {
		const enquiries = await db.enquiry.findMany({ orderBy: { createdAt: 'desc' } });
		return <main className="admin-page"><div className="admin-header"><div><p className="eyebrow">Private owner area</p><h1>Enquiries inbox</h1><p>{enquiries.length} enquiries received.</p></div><a className="btn b2" href="/">View public site</a></div><AdminInbox initial={enquiries.map(item => ({ ...item, createdAt: item.createdAt.toISOString() }))} /></main>;
	} catch {
		return <main className="admin-page"><p className="eyebrow">Database unavailable</p><h1>Connect the owner inbox</h1><p>The PostgreSQL database could not be reached. Replace the placeholder DATABASE_URL and DIRECT_URL values in <code>.env</code>, restart the dev server, and run <code>npm run db:push</code>.</p><a className="btn b2" href="/">Return to public site</a></main>;
	}
}
