import ContentEditor from '@/components/ContentEditor';
const allowed = new Set(['classes','faculty','results','testimonials','gallery','announcements']);
export default async function ManageContent({ params }: { params: Promise<{ kind: string }> }) { const { kind } = await params; if (!allowed.has(kind)) return <main className="admin-page"><h1>Unknown content type</h1></main>; return <main className="admin-page"><p><a href="/admin/content">Back to content manager</a></p><h1>Manage {kind}</h1><ContentEditor kind={kind}/></main> }
