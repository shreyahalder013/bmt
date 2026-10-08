'use client';

import { useEffect, useState, useCallback } from 'react';

const importFieldKeys: Record<string, string[]> = {
  enquiries: ['id', 'studentName', 'parentName', 'class', 'school', 'phone', 'email', 'subjects', 'message', 'status', 'notes'],
  students: ['id', 'firstName', 'lastName', 'phone', 'email', 'className', 'school', 'admissionDate', 'status', 'guardianName', 'guardianPhone', 'guardianEmail', 'guardianRelationship'],
  batches: ['id', 'name', 'className', 'subjects', 'teacherId', 'days', 'time', 'capacity', 'startDate', 'endDate', 'active'],
  enrollments: ['id', 'studentId', 'batchId', 'startDate', 'endDate', 'active'],
  attendance: ['id', 'studentId', 'batchId', 'date', 'status', 'notes'],
  feePlans: ['id', 'studentId', 'batchId', 'totalAmount', 'discountAmount'],
  instalments: ['id', 'feePlanId', 'dueDate', 'amount', 'paidAmount'],
  payments: ['id', 'instalmentId', 'studentId', 'amount', 'mode', 'date', 'reference', 'receivedById'],
  expenses: ['id', 'category', 'amount', 'date', 'notes', 'receiptUrl'],
  tests: ['id', 'batchId', 'name', 'subject', 'date', 'maxMarks'],
  testMarks: ['id', 'testId', 'studentId', 'marks'],
  faculty: ['id', 'name', 'subject', 'expertise', 'bio', 'photoUrl', 'altText', 'order', 'published'],
  testimonials: ['id', 'quote', 'author', 'order', 'published'],
  results: ['id', 'title', 'text', 'order', 'published'],
  gallery: ['id', 'imageUrl', 'caption', 'category', 'altText', 'order', 'published'],
  announcements: ['id', 'title', 'body', 'startDate', 'endDate', 'order', 'published'],
};

type ImportType = keyof typeof importFieldKeys;

type ImportJob = {
  id: string;
  type: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  fileName: string;
  fileSize: number;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  skippedRows: number;
  createdRows: number;
  updatedRows: number;
  matchStrategy: 'CREATE_ONLY' | 'UPDATE_ONLY' | 'UPSERT';
  createdById?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  createdBy?: { id: string; name: string; email: string };
};

type RecycleBinItem = {
  id: string;
  entity: string;
  entityId: string;
  data: Record<string, unknown>;
  deletedById?: string;
  deletedAt: string;
  permanentlyDeletedAt?: string;
  deletedBy?: { id: string; name: string; email: string };
};

const typeLabels: Record<ImportType, string> = {
  enquiries: 'Enquiries',
  students: 'Students',
  batches: 'Batches',
  enrollments: 'Enrollments',
  attendance: 'Attendance',
  feePlans: 'Fee Plans',
  instalments: 'Instalments',
  payments: 'Payments',
  expenses: 'Expenses',
  tests: 'Tests',
  testMarks: 'Test Marks',
  faculty: 'Faculty',
  testimonials: 'Testimonials',
  results: 'Results',
  gallery: 'Gallery',
  announcements: 'Announcements',
};

const matchStrategies = [
  { value: 'CREATE_ONLY', label: 'Create new only (skip existing)' },
  { value: 'UPDATE_ONLY', label: 'Update existing only' },
  { value: 'UPSERT', label: 'Create and update (upsert)' },
];

// Helper component for tooltips
function HelpIcon({ children }: { children: string }) {
  return (
    <span className="help-icon" role="tooltip">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      <span className="tooltip">{children}</span>
    </span>
  );
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; dot: string }> = {
    PENDING: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
    PROCESSING: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
    COMPLETED: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-400' },
    FAILED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
    CANCELLED: { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' },
  };
  const c = colors[status] || colors.CANCELLED;
  return (
    <span className={`status-badge ${c.bg} ${c.text}`}>
      <span className={`status-dot ${c.dot}`} />
      {status}
    </span>
  );
}

// Empty state component
function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

// Section header with help
function SectionHeader({ title, description, help, action }: { title: string; description?: string; help?: string; action?: React.ReactNode }) {
  return (
    <div className="section-header">
      <div>
        <h2 className="section-title">{title}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      <div className="section-header-actions">
        {help && <HelpIcon>{help}</HelpIcon>}
        {action}
      </div>
    </div>
  );
}

// Progress modal
function ProgressModal({ progress, onClose }: { progress: { status: string; progress: number; stats: { total: number; created: number; updated: number; errors: number; skipped: number }; errorMessage?: string } | null; onClose: () => void }) {
  if (!progress) return null;
  return (
    <div className="progress-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="progress-title">
      <div className="progress-modal" onClick={e => e.stopPropagation()}>
        <div className="progress-header">
          <h3 id="progress-title">Import Progress</h3>
        </div>
        <div className="progress-body">
          <div className="progress-bar-container" role="progressbar" aria-valuenow={progress.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Import progress">
            <div className="progress-bar-fill" style={{ width: `${progress.progress}%` }} />
          </div>
          <p className="progress-text">{progress.progress}% - {progress.status}</p>
          <div className="progress-stats">
            <div className="stat"><span className="stat-value">{progress.stats.total}</span><span className="stat-label">Total</span></div>
            <div className="stat valid"><span className="stat-value">{progress.stats.created + progress.stats.updated}</span><span className="stat-label">Processed</span></div>
            <div className="stat error"><span className="stat-value">{progress.stats.errors}</span><span className="stat-label">Errors</span></div>
            <div className="stat"><span className="stat-value">{progress.stats.skipped}</span><span className="stat-label">Skipped</span></div>
          </div>
          {progress.errorMessage && <p className="progress-error">{progress.errorMessage}</p>}
        </div>
      </div>
    </div>
  );
}

export default function DataManager() {
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'history' | 'recycle' | 'backups'>('import');
  const [selectedType, setSelectedType] = useState<ImportType>('enquiries');
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [recycleItems, setRecycleItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [importStage, setImportStage] = useState<'upload' | 'map' | 'preview' | 'confirm'>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<{ valid: unknown[]; errors: { row: number; errors: string[]; data: Record<string, unknown> }[] } | null>(null);
  const [matchStrategy, setMatchStrategy] = useState<'CREATE_ONLY' | 'UPDATE_ONLY' | 'UPSERT'>('UPSERT');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ 
    status: string; 
    progress: number; 
    stats: { total: number; valid: number; created: number; updated: number; errors: number; skipped: number };
    errorMessage?: string;
  } | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [autoMapApplied, setAutoMapApplied] = useState(false);

  const showMessage = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  }, []);

  const fetchJobs = useCallback(async () => {
    if (activeTab !== 'history') return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/import?type=${selectedType}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch {
      showMessage('Failed to load import history', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedType, showMessage]);

  const fetchRecycleBin = useCallback(async () => {
    if (activeTab !== 'recycle') return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/recycle-bin', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setRecycleItems(data);
      }
    } catch {
      showMessage('Failed to load recycle bin', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, showMessage]);

  useEffect(() => {
    fetchJobs();
    fetchRecycleBin();
  }, [fetchJobs, fetchRecycleBin]);

  // Auto-map columns when file is uploaded
  const autoMapColumns = useCallback((headers: string[]) => {
    const mapping: Record<string, string> = {};
    headers.forEach(header => {
      const normalized = header.toLowerCase().trim();
      const fields = importFieldKeys[selectedType] || [];
      const match = fields.find(f => f.toLowerCase() === normalized || 
        f.toLowerCase().replace(/([A-Z])/g, ' $1').trim() === normalized);
      if (match) mapping[header] = match;
    });
    setColumnMappings(mapping);
    setAutoMapApplied(true);
  }, [selectedType]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      showMessage('File size exceeds 5 MB limit', 'error');
      return;
    }
    
    setUploadedFile(file);
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', selectedType);
      
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        body: formData,
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        showMessage(result.error || 'Upload failed', 'error');
        return;
      }
      
      setCurrentJobId(result.jobId);
      setParsedData({ headers: [], rows: [] });
      setImportStage('map');
      setAutoMapApplied(false);
      showMessage(`File uploaded. ${result.validRows} valid rows, ${result.errorRows} errors.`);
    } catch {
      showMessage('Upload failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/import?type=${selectedType}&action=template`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedType}-template.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        showMessage('Template downloaded');
      } else {
        showMessage('Failed to download template', 'error');
      }
    } catch {
      showMessage('Failed to download template', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoMap = () => {
    if (parsedData?.headers) {
      autoMapColumns(parsedData.headers);
      showMessage('Auto-mapped columns. Please review and adjust.', 'info');
    }
  };

  const handleColumnMapping = async () => {
    if (!uploadedFile || !parsedData) return;
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('type', selectedType);
      formData.append('matchStrategy', matchStrategy);
      formData.append('columnMappings', JSON.stringify(columnMappings));
      
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        body: formData,
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        showMessage(result.error || 'Failed to parse', 'error');
        return;
      }
      
      setCurrentJobId(result.jobId);
      setValidationResult({
        valid: [],
        errors: result.errors || [],
      });
      setImportStage('preview');
      showMessage(`Parsed: ${result.validRows} valid, ${result.errorRows} errors`);
    } catch {
      showMessage('Parsing failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!currentJobId) return;
    setShowProgressModal(true);
    setImportProgress({ status: 'QUEUED', progress: 0, stats: { total: 0, valid: 0, created: 0, updated: 0, errors: 0, skipped: 0 } });
    
    try {
      const res = await fetch('/api/admin/import', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobId: currentJobId, action: 'confirm', matchStrategy }),
      });
      
      if (!res.ok) {
        showMessage('Failed to start import', 'error');
        setShowProgressModal(false);
        return;
      }
      
      const eventSource = new EventSource(`/api/admin/import/${currentJobId}/progress`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          setImportProgress({
            status: data.status,
            progress: data.progress,
            stats: data.stats,
            errorMessage: data.errorMessage,
          });
        } else if (data.type === 'complete') {
          eventSource.close();
          setTimeout(() => {
            setShowProgressModal(false);
            setImportStage('upload');
            setUploadedFile(null);
            setCurrentJobId(null);
            setValidationResult(null);
            fetchJobs();
            showMessage(data.status === 'COMPLETED' ? 'Import completed successfully!' : 'Import failed', data.status === 'COMPLETED' ? 'success' : 'error');
          }, 1500);
        } else if (data.type === 'error') {
          eventSource.close();
          setShowProgressModal(false);
          showMessage(data.message, 'error');
        }
      };
      
      eventSource.onerror = () => {
        eventSource.close();
        setShowProgressModal(false);
        showMessage('Connection lost. Check history for status.', 'error');
      };
      
    } catch {
      setShowProgressModal(false);
      showMessage('Failed to start import', 'error');
    }
  };

  const handleUndoImport = async (jobId: string) => {
    if (!confirm('Undo this import? This will delete created records and restore updated records to their previous values.')) return;
    
    setShowProgressModal(true);
    setImportProgress({ status: 'UNDOING', progress: 0, stats: { total: 0, valid: 0, created: 0, updated: 0, errors: 0, skipped: 0 } });
    
    try {
      const res = await fetch('/api/admin/import', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobId, action: 'undo' }),
      });
      
      if (!res.ok) {
        showMessage('Failed to undo import', 'error');
        setShowProgressModal(false);
        return;
      }
      
      const eventSource = new EventSource(`/api/admin/import/${jobId}/progress`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          setImportProgress({
            status: data.status,
            progress: data.progress,
            stats: data.stats,
            errorMessage: data.errorMessage,
          });
        } else if (data.type === 'complete') {
          eventSource.close();
          setTimeout(() => {
            setShowProgressModal(false);
            fetchJobs();
            showMessage(data.status === 'CANCELLED' ? 'Import undone successfully' : 'Undo failed', data.status === 'CANCELLED' ? 'success' : 'error');
          }, 1500);
        } else if (data.type === 'error') {
          eventSource.close();
          setShowProgressModal(false);
          showMessage(data.message, 'error');
        }
      };
      
      eventSource.onerror = () => {
        eventSource.close();
        setShowProgressModal(false);
        showMessage('Connection lost. Check history for status.', 'error');
      };
      
    } catch {
      setShowProgressModal(false);
      showMessage('Failed to undo import', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: selectedType, format });
      const res = await fetch(`/api/admin/export?${params}`);
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const disposition = res.headers.get('content-disposition');
        const filename = disposition?.match(/filename="(.+)"/)?.[1] || `${selectedType}-export.${format}`;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
        showMessage('Export downloaded', 'success');
      } else {
        showMessage('Export failed', 'error');
      }
    } catch {
      showMessage('Export failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFullBackup = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/export?type=all&format=xlsx');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const disposition = res.headers.get('content-disposition');
        const filename = disposition?.match(/filename="(.+)"/)?.[1] || `backup-${new Date().toISOString().split('T')[0]}.xlsx`;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
        showMessage('Full backup downloaded', 'success');
      } else {
        showMessage('Backup failed', 'error');
      }
    } catch {
      showMessage('Backup failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreFromRecycleBin = async (itemId: string) => {
    if (!confirm('Restore this item? It will be moved back to its original location.')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/recycle-bin', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId, action: 'restore' }),
      });
      if (res.ok) {
        showMessage('Item restored', 'success');
        fetchRecycleBin();
      } else {
        showMessage('Failed to restore', 'error');
      }
    } catch {
      showMessage('Failed to restore', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDelete = async (itemId: string) => {
    if (!confirm('Permanently delete this item? This cannot be undone.')) return;
    if (!prompt('Type DELETE to confirm:')?.includes('DELETE')) {
      showMessage('Confirmation required', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/recycle-bin', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });
      if (res.ok) {
        showMessage('Item permanently deleted', 'success');
        fetchRecycleBin();
      } else {
        showMessage('Failed to delete', 'error');
      }
    } catch {
      showMessage('Failed to delete', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportErrorReport = async (jobId: string) => {
    try {
      const res = await fetch('/api/admin/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: selectedType, recordIds: [jobId] }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedType}-error-report.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        showMessage('Error report downloaded', 'success');
      }
    } catch {
      showMessage('Failed to download error report', 'error');
    }
  };

  const getStatusBadge = (status: string) => <StatusBadge status={status} />;

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

      {message && (
        <div className={`notice ${message.type}`} role="status">
          {message.text}
        </div>
      )}

      <div className="admin-toolbar">
        <div className="tabs" role="tablist">
          {[
            { id: 'import', label: 'Import', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
            { id: 'export', label: 'Export', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 8 12 3 17 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
            { id: 'history', label: 'History', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
            { id: 'recycle', label: 'Recycle Bin', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> },
            { id: 'backups', label: 'Backups', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg> },
          ].map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'import' && (
        <section>
          <SectionHeader
            title={`Import {typeLabels[selectedType]}`}
            description="Upload an Excel or CSV file. We'll validate each row before importing."
            help="Choose a data type, download the template, fill it out, then upload. The wizard will guide you through column mapping, validation, and confirmation."
          />
          
          <div className="card" style={{ maxWidth: '900px' }}>
            <div className="import-setup">
              <div className="form-grid">
                <label>
                  Data Type
                  <select value={selectedType} onChange={e => { setSelectedType(e.target.value as ImportType); setImportStage('upload'); }}>
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Match Strategy
                  <HelpIcon>How to handle records that already exist in the database.</HelpIcon>
                  <select value={matchStrategy} onChange={e => setMatchStrategy(e.target.value as typeof matchStrategy)}>
                    {matchStrategies.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <div className="import-wizard">
              <div className="wizard-steps" role="navigation" aria-label="Import progress">
                {['upload', 'map', 'preview', 'confirm'].map((step, i) => (
                  <div key={step} className={`step ${importStage === step ? 'active' : ''} ${['upload', 'map', 'preview'].indexOf(importStage) > ['upload', 'map', 'preview'].indexOf(step) ? 'completed' : ''}`}>
                    <span className="step-number">{i + 1}</span>
                    <span className="step-label">{step.charAt(0).toUpperCase() + step.slice(1)}</span>
                  </div>
                ))}
              </div>

              {importStage === 'upload' && (
                <div className="import-step">
                  <div className="upload-options">
                    <button className="btn b3" onClick={handleDownloadTemplate}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 8 12 3 17 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      Download Template
                    </button>
                    <p className="text-sm text-muted">Get an Excel template with headers, example row, and dropdown validation</p>
                  </div>
                  <div className="drop-zone" onClick={() => document.getElementById('import-file')?.click()}>
                    <input
                      id="import-file"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <p>Drag & drop or click to select .xlsx, .xls, or .csv file</p>
                    <p className="text-sm text-muted">Max 5 MB, 5,000 rows</p>
                    {uploadedFile && <p className="text-success">Selected: {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)</p>}
                  </div>
                </div>
              )}

              {importStage === 'map' && parsedData && (
                <div className="import-step">
                  <div className="mapping-header">
                    <h3>Map Columns</h3>
                    <p>Match your file columns to system fields. Unmapped columns will be ignored.</p>
                    <div className="mapping-actions">
                      <button className="btn b3" onClick={handleAutoMap} disabled={autoMapApplied}>
                        {autoMapApplied ? 'Auto-mapped ✓' : 'Auto-map Columns'}
                      </button>
                    </div>
                  </div>
                  <div className="column-mapping" role="list" aria-label="Column mappings">
                    {parsedData.headers.map(header => (
                      <div key={header} className="mapping-row" role="listitem">
                        <span className="source-col">
                          <span className="source-label">{header}</span>
                          <span className="source-hint">from your file</span>
                        </span>
                        <select
                          value={columnMappings[header] || ''}
                          onChange={e => setColumnMappings(prev => ({ ...prev, [header]: e.target.value }))}
                          aria-label={`Map "${header}" to field`}
                        >
                          <option value="">-- Ignore this column --</option>
                          {importFieldKeys[selectedType]?.map(key => (
                            <option key={key} value={key}>{key}</option>
                          ))}
                        </select>
                        {columnMappings[header] && (
                          <span className="mapped-badge" title="Mapped">{columnMappings[header]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="step-navigation">
                    <button className="btn b2" onClick={() => setImportStage('upload')}>Back</button>
                    <button className="btn b1" onClick={handleColumnMapping} disabled={loading}>
                      {loading ? 'Parsing...' : 'Validate & Preview →'}
                    </button>
                  </div>
                </div>
              )}

              {importStage === 'preview' && validationResult && (
                <div className="import-step">
                  <h3>Validation Preview</h3>
                  <div className="validation-summary">
                    <span className="valid">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      Valid: {validationResult.valid.length}
                    </span>
                    <span className="error">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                      Errors: {validationResult.errors.length}
                    </span>
                  </div>
                  {validationResult.errors.length > 0 && (
                    <details className="errors-list">
                      <summary>Show Errors ({validationResult.errors.length})</summary>
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr><th>Row</th><th>Errors</th></tr>
                          </thead>
                          <tbody>
                            {validationResult.errors.slice(0, 50).map((e, i) => (
                              <tr key={i}>
                                <td>{e.row}</td>
                                <td>{e.errors.join('; ')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                  <div className="step-navigation">
                    <button className="btn b2" onClick={() => setImportStage('map')}>← Back</button>
                    <button className="btn b1" onClick={handleConfirmImport} disabled={loading || validationResult.valid.length === 0}>
                      {loading ? 'Starting...' : `Import ${validationResult.valid.length} Records`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'export' && (
        <section>
          <SectionHeader
            title={`Export {typeLabels[selectedType]}`}
            description="Download data as Excel or CSV. Apply filters on the list pages, then export."
            help="Exports respect your current filters, search, and column visibility. Choose 'All records' to ignore filters."
          />
          
          <div className="card" style={{ maxWidth: '800px' }}>
            <div className="form-grid">
              <label>
                Data Type
                <select value={selectedType} onChange={e => setSelectedType(e.target.value as ImportType)}>
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                Format
                <HelpIcon>Excel preserves formatting and data types. CSV is plain text for other tools.</HelpIcon>
                <select defaultValue="xlsx">
                  <option value="xlsx">Excel (.xlsx)</option>
                  <option value="csv">CSV (.csv)</option>
                </select>
              </label>
              <label>
                <input type="checkbox" defaultChecked /> Export all records (ignore filters)
                <HelpIcon>When checked, exports all records in the database for this type.</HelpIcon>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button className="btn b1" onClick={() => handleExport('xlsx')} disabled={loading}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 8 12 3 17 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {loading ? 'Exporting...' : 'Export Excel'}
              </button>
              <button className="btn b2" onClick={() => handleExport('csv')} disabled={loading}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                Export CSV
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'history' && (
        <section>
          <SectionHeader
            title="Import History"
            description="View past import jobs, their results, and download error reports."
          />
          
          <div className="card" style={{ maxWidth: '100%' }}>
            <div className="form-grid" style={{ marginBottom: '16px' }}>
              <label>
                Filter by Type
                <select value={selectedType} onChange={e => setSelectedType(e.target.value as ImportType)}>
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            {loading ? (
              <div className="loading-state">Loading history...</div>
            ) : jobs.length === 0 ? (
              <EmptyState
                icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
                title="No import jobs yet"
                description="Your import history will appear here after your first import."
                action={<button className="btn b1" onClick={() => setActiveTab('import')}>Start Import</button>}
              />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Created</th>
                      <th>Updated</th>
                      <th>Errors</th>
                      <th>Skipped</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(job => (
                      <tr key={job.id}>
                        <td title={job.fileName}>{job.fileName}</td>
                        <td>{typeLabels[job.type as ImportType] || job.type}</td>
                        <td>{getStatusBadge(job.status)}</td>
                        <td>{job.totalRows}</td>
                        <td>{job.createdRows}</td>
                        <td>{job.updatedRows}</td>
                        <td>{job.errorRows}</td>
                        <td>{job.skippedRows}</td>
                        <td>{new Date(job.createdAt).toLocaleString()}</td>
                        <td>
                          <div className="action-buttons">
                            {job.status === 'COMPLETED' && job.errorRows > 0 && (
                              <button className="btn b3" onClick={() => handleExportErrorReport(job.id)} title="Download error report">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                Error Report
                              </button>
                            )}
                            {job.status === 'COMPLETED' && (
                              <button className="btn b2" onClick={() => handleUndoImport(job.id)} title="Undo this import">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                                Undo
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'recycle' && (
        <section>
          <SectionHeader
            title="Recycle Bin"
            description="Deleted items are kept for 30 days before permanent removal. You can restore or permanently delete them."
          />
          
          <div className="card" style={{ maxWidth: '100%' }}>
            {loading ? (
              <div className="loading-state">Loading recycle bin...</div>
            ) : recycleItems.length === 0 ? (
              <EmptyState
                icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>}
                title="Recycle bin is empty"
                description="Deleted items will appear here and can be restored within 30 days."
              />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Entity</th>
                      <th>Preview</th>
                      <th>Deleted By</th>
                      <th>Deleted At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recycleItems.map(item => (
                      <tr key={item.id}>
                        <td>
                          <span className="entity-badge">{item.entity.replace(/_/g, ' ')}</span>
                        </td>
                        <td>
                          <small className="preview-text">
                            {Object.entries(item.data).slice(0, 3).map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`).join(', ')}
                          </small>
                        </td>
                        <td>{item.deletedBy?.name || 'Unknown'}</td>
                        <td>{new Date(item.deletedAt).toLocaleString()}</td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn b3" onClick={() => handleRestoreFromRecycleBin(item.id)} title="Restore">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                              Restore
                            </button>
                            <button className="danger" onClick={() => handlePermanentDelete(item.id)} title="Delete forever">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              Delete Forever
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'backups' && (
        <section>
          <SectionHeader
            title="Full Database Backup"
            description="Download a complete backup of all data as a single Excel workbook with one sheet per table."
            help="Backup includes all 16 data types. Store securely and delete when no longer needed."
          />
          
          <div className="card" style={{ maxWidth: '800px' }}>
            <div className="backup-info">
              <div className="backup-stats">
                <div className="stat-item">
                  <span className="stat-number">16</span>
                  <span className="stat-label">Data Types</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">All</span>
                  <span className="stat-label">Records</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">.xlsx</span>
                  <span className="stat-label">Format</span>
                </div>
              </div>
              <button className="btn b1" onClick={handleFullBackup} disabled={loading}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 8 12 3 17 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {loading ? 'Preparing backup...' : 'Download Full Backup (.xlsx)'}
              </button>
              <div className="admin-guide">
                <strong>Includes:</strong> Enquiries, Students, Batches, Enrollments, Attendance, Fee Plans, Instalments, Payments, Expenses, Tests, Test Marks, Faculty, Testimonials, Results, Gallery, Announcements.
                <br />
                <strong>Note:</strong> Backup files contain personal data. Store securely and delete when no longer needed.
              </div>
            </div>
          </div>
        </section>
      )}

      <ProgressModal progress={importProgress} onClose={() => setShowProgressModal(false)} />
    </main>
  );
}