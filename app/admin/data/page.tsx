import DataManager from '@/components/DataManager';
export const dynamic = 'force-dynamic';

export default function DataPage() {
  return (
    <main className="admin-page">
      <div className="admin-header">
        <div>
          <p className="eyebrow">Data Manager</p>
          <h1>Import, Export & Bulk Operations</h1>
          <p>Manage data with Excel files. Download templates, import with validation, export filtered data.</p>
        </div>
        <a className="btn b2" href="/admin">Dashboard</a>
      </div>
      <DataManager />
    </main>
  );
}