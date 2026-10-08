import AccountsManager from '@/components/AccountsManager';
import FeePlanManager from '@/components/FeePlanManager';
export const dynamic = 'force-dynamic';
export default function AccountsPage() { return <main className="admin-page"><div className="admin-header"><div><p className="eyebrow">Institute management</p><h1>Accounts and fees</h1><p>Record real payments and expenses. This page starts empty and does not create demo transactions.</p></div><a className="btn b2" href="/admin">Dashboard</a></div><FeePlanManager /><AccountsManager /></main>; }
