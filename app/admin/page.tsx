import { db } from '@/lib/db';
import DashboardCharts from '@/components/DashboardCharts';
export const dynamic = 'force-dynamic';

function dayStart(date: Date) { const value = new Date(date); value.setHours(0, 0, 0, 0); return value; }
function dayEnd(date: Date) { const value = dayStart(date); value.setDate(value.getDate() + 1); return value; }
function dayLabel(date: Date) { return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
function inr(value: number) { return `₹${value.toLocaleString('en-IN')}`; }

export default async function Dashboard() {
  const today = new Date();
  const start = dayStart(today);
  const tomorrow = dayEnd(today);
  const nextWeek = new Date(start); nextWeek.setDate(nextWeek.getDate() + 7);
  const last30 = new Date(start); last30.setDate(last30.getDate() - 29);
  try {
    const [enquiriesToday, registrationsToday, paymentsToday, expensesToday, followUps, pdcs, instalments, payments7, expenses7, enquiries30, registrations30, activeStudents, batches] = await Promise.all([
      db.enquiry.count({ where: { createdAt: { gte: start, lt: tomorrow } } }),
      db.student.count({ where: { admissionDate: { gte: start, lt: tomorrow }, deletedAt: null } }),
      db.payment.aggregate({ _sum: { amount: true }, where: { date: { gte: start, lt: tomorrow }, deletedAt: null } }),
      db.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: start, lt: tomorrow }, deletedAt: null } }),
      db.followUp.findMany({ where: { dueAt: { gte: start, lt: tomorrow }, completedAt: null }, include: { enquiry: true }, orderBy: { dueAt: 'asc' }, take: 20 }),
      db.cheque.count({ where: { dueDate: { gte: start, lt: tomorrow }, status: 'PENDING' } }),
      db.instalment.findMany({ where: { dueDate: { gte: start, lt: nextWeek } }, select: { dueDate: true, amount: true, paidAmount: true } }),
      db.payment.findMany({ where: { date: { gte: new Date(start.getTime() - 6 * 86400000), lt: tomorrow }, deletedAt: null }, select: { date: true, amount: true } }),
      db.expense.findMany({ where: { date: { gte: new Date(start.getTime() - 6 * 86400000), lt: tomorrow }, deletedAt: null }, select: { date: true, amount: true } }),
      db.enquiry.findMany({ where: { createdAt: { gte: last30, lt: tomorrow } }, select: { createdAt: true } }),
      db.student.findMany({ where: { admissionDate: { gte: last30, lt: tomorrow }, deletedAt: null }, select: { admissionDate: true } }),
      db.student.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      db.batch.findMany({ where: { active: true }, select: { id: true, name: true, _count: { select: { enrollments: true } } }, orderBy: { name: 'asc' }, take: 20 })
    ]);
    const expected = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return { label: dayLabel(date), value: instalments.filter(item => item.dueDate >= dayStart(date) && item.dueDate < dayEnd(date)).reduce((sum, item) => sum + Math.max(0, item.amount - item.paidAmount), 0) }; });
    const flow = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() - 6 + index); return { label: dayLabel(date), value: payments7.filter(item => item.date >= dayStart(date) && item.date < dayEnd(date)).reduce((sum, item) => sum + item.amount, 0), second: expenses7.filter(item => item.date >= dayStart(date) && item.date < dayEnd(date)).reduce((sum, item) => sum + item.amount, 0) }; });
    const enquiryFlow = Array.from({ length: 10 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() - 9 + index * 3); const end = new Date(date); end.setDate(date.getDate() + 3); return { label: dayLabel(date), value: enquiries30.filter(item => item.createdAt >= date && item.createdAt < end).length, second: registrations30.filter(item => item.admissionDate >= date && item.admissionDate < end).length }; });
    const expectedTotal = expected.reduce((sum, item) => sum + item.value, 0);
    const kpis = [{ label: "Today's Enquiries", value: enquiriesToday, href: '/admin/inbox' }, { label: "Today's Registrations", value: registrationsToday, href: '/admin/students' }, { label: "Today's Income", value: inr(paymentsToday._sum.amount ?? 0), href: '/admin/accounts' }, { label: "Today's Expense", value: inr(expensesToday._sum.amount ?? 0), href: '/admin/accounts' }, { label: "Follow-ups Due Today", value: followUps.length, href: '/admin/inbox' }, { label: "PDCs Due Today", value: pdcs, href: '/admin/accounts' }, { label: "Expected Income", value: inr(expectedTotal), href: '/admin/accounts' }];
    return <main className="admin-page"><div className="admin-header"><div><p className="eyebrow">Owner dashboard</p><h1>Today at Brilliant Minds</h1><p>{today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div><div className="dashboard-actions"><a className="btn b1" href="/admin/inbox">+ Add enquiry</a><a className="btn b2" href="/admin/accounts">+ Record payment</a></div></div><div className="kpi-grid">{kpis.map(kpi => <a className="kpi-card" href={kpi.href} key={kpi.label}><span>{kpi.label}</span><strong>{kpi.value}</strong><small>View details →</small></a>)}</div><DashboardCharts expected={expected} flow={flow} enquiries={enquiryFlow} /><section className="dashboard-section"><div className="section-heading"><div><h2>Today's enquiry follow-ups</h2><p>Call the parent, record the outcome, and mark the follow-up complete.</p></div><a href="/admin/inbox">View all</a></div>{followUps.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Sr.</th><th>Name</th><th>Contact</th><th>Status</th></tr></thead><tbody>{followUps.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><strong>{item.enquiry.studentName}</strong><br /><small>{item.enquiry.class}</small></td><td><a href={`tel:${item.enquiry.phone}`}>{item.enquiry.phone}</a></td><td>{item.enquiry.status}</td></tr>)}</tbody></table></div> : <div className="empty-state"><h3>No follow-ups due today</h3><p>Scheduled follow-ups will appear here.</p></div>}</section><section className="dashboard-section"><div className="section-heading"><div><h2>Running batches</h2><p>{activeStudents} active students across active batches.</p></div><a href="/admin/batches">Manage batches</a></div>{batches.length ? <div className="batch-list">{batches.map(batch => <div className="batch-row" key={batch.id}><strong>{batch.name}</strong><span>{batch._count.enrollments} students</span></div>)}</div> : <div className="empty-state"><h3>No active batches yet</h3><p>Create your first batch to track students and attendance.</p><a className="btn b1" href="/admin/batches">Create batch</a></div>}</section></main>;
  } catch {
    return <main className="admin-page"><p className="eyebrow">Dashboard unavailable</p><h1>Connect the database to view the dashboard</h1><p>Set the Supabase DATABASE_URL and DIRECT_URL values, run <code>npm run db:push</code>, then refresh this page.</p></main>;
  }
}
