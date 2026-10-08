'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Faculty {
  id: string;
  slug: string;
  displayName: string;
  fullName: string;
  title: string;
  role: string;
  shortBio: string | null;
  fullBio: string | null;
  qualifications: string | null;
  experienceYears: number | null;
  languages: string | null;
  specialities: string[];
  achievements: Array<{ text: string; year?: number }>;
  subjects: string[];
  classLevels: string[];
  socialLinks: { linkedin?: string; youtube?: string; instagram?: string };
  publicFields: { email: boolean; phone: boolean };
  contactEmail: string | null;
  contactPhone: string | null;
  internalNotes: string | null;
  status: string;
  featured: boolean;
  order: number;
  consentAt: string | null;
  consentBy: string | null;
  photoAssetId: string | null;
  photoAlt: string | null;
  photoFocalX: number | null;
  photoFocalY: number | null;
  employmentStatus: string;
  joinedAt: string | null;
  createdAt: string;
  updatedAt: string;
  batches: Array<{ id: string; name: string }>;
}

interface Filters {
  search: string;
  status: string;
  subject: string;
  classLevel: string;
  employmentStatus: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AllFilters {
  subjects: string[];
  classLevels: string[];
}

const STATUS_COLORS: Record<string, string> = {
  PUBLISHED: 'bg-green-100 text-green-800',
  DRAFT: 'bg-yellow-100 text-yellow-800',
  HIDDEN: 'bg-gray-100 text-gray-800',
  PENDING_APPROVAL: 'bg-blue-100 text-blue-800',
};

const EMPLOYMENT_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  ON_LEAVE: 'bg-yellow-100 text-yellow-800',
  FORMER: 'bg-red-100 text-red-800',
};

const TITLE_LABELS: Record<string, string> = {
  MR: 'Mr.',
  MS: 'Ms.',
  MRS: 'Mrs.',
  DR: 'Dr.',
  SIR: 'Sir',
  MADAM: 'Madam',
  NONE: '',
};

export function FacultyManager() {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [allFilters, setAllFilters] = useState<AllFilters>({ subjects: [], classLevels: [] });
  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: '',
    subject: '',
    classLevel: '',
    employmentStatus: '',
  });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortField, setSortField] = useState<'order' | 'displayName' | 'role' | 'status' | 'updatedAt'>('order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const dragRef = useRef<{ sourceId: string; sourceIndex: number } | null>(null);

  const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchFaculty = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sort: sortField,
        order: sortOrder,
      });
      if (filters.search) params.set('search', filters.search);
      if (filters.status) params.set('status', filters.status);
      if (filters.subject) params.set('subject', filters.subject);
      if (filters.classLevel) params.set('classLevel', filters.classLevel);
      if (filters.employmentStatus) params.set('employmentStatus', filters.employmentStatus);

      const res = await fetch(`/api/admin/faculty?${params}`);
      if (res.ok) {
        const data = await res.json();
        setFaculty(data.faculty);
        setAllFilters(data.filters);
        setPagination(prev => ({ ...prev, total: data.pagination.total, totalPages: data.pagination.totalPages }));
      } else {
        const err = await res.json();
        showMessage(err.error || 'Failed to load faculty', 'error');
      }
    } catch {
      showMessage('Failed to load faculty', 'error');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters, sortField, sortOrder, showMessage]);

  useEffect(() => {
    fetchFaculty();
  }, [fetchFaculty]);

  const handleSort = (field: 'order' | 'displayName' | 'role' | 'status' | 'updatedAt') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === faculty.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(faculty.map(f => f.id)));
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    dragRef.current = { sourceId: id, sourceIndex: index };
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetId: string, targetIndex: number) => {
    e.preventDefault();
    if (!dragRef.current || dragRef.current.sourceId === targetId) return;

    const { sourceId, sourceIndex } = dragRef.current;
    const sourceFaculty = faculty.find(f => f.id === sourceId);
    const targetFaculty = faculty.find(f => f.id === targetId);
    if (!sourceFaculty || !targetFaculty) return;

    // Optimistic update
    const newFaculty = [...faculty];
    newFaculty.splice(sourceIndex, 1);
    newFaculty.splice(targetIndex, 0, sourceFaculty);
    setFaculty(newFaculty);

    // Reorder via API
    const order = newFaculty.map((f, i) => ({ id: f.id, order: i }));
    try {
      const res = await fetch('/api/admin/faculty/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', ids: faculty.map(f => f.id), order }),
      });
      if (!res.ok) {
        fetchFaculty(); // Revert on failure
      }
    } catch {
      fetchFaculty();
    }
  };

  const handleDragEnd = () => {
    dragRef.current = null;
  };

  const handleBulkAction = async (action: 'publish' | 'hide' | 'draft' | 'delete' | 'feature' | 'unfeature') => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const res = await fetch('/api/admin/faculty/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(`${data.updated} teacher(s) ${action}ed${data.errors.length ? ` (${data.errors.length} skipped)` : ''}`, 'success');
        if (data.errors.length) {
          showMessage(data.errors.join('; '), 'error');
        }
        setSelectedIds(new Set());
        fetchFaculty();
      } else {
        showMessage(data.error || 'Bulk action failed', 'error');
      }
    } catch {
      showMessage('Bulk action failed', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleDelete = async (id: string, permanent = false) => {
    if (!confirm(permanent ? 'Permanently delete this teacher? This cannot be undone.' : 'Move to recycle bin?')) return;
    if (permanent && !prompt('Type DELETE to confirm:')?.includes('DELETE')) return;

    try {
      const res = await fetch(`/api/admin/faculty/${id}?permanent=${permanent}`, { method: 'DELETE' });
      if (res.ok) {
        showMessage(permanent ? 'Permanently deleted' : 'Moved to recycle bin', 'success');
        fetchFaculty();
      } else {
        const err = await res.json();
        showMessage(err.error || 'Delete failed', 'error');
      }
    } catch {
      showMessage('Delete failed', 'error');
    }
  };

  const getStatusBadge = (status: string) => (
    <span className={`status-badge ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>
  );

  const getEmploymentBadge = (status: string) => (
    <span className={`status-badge ${EMPLOYMENT_COLORS[status] || 'bg-gray-100 text-gray-800'}`}>{status.replace('_', ' ')}</span>
  );

  const formatName = (f: Faculty) => {
    const title = TITLE_LABELS[f.title] || '';
    return `${title} ${f.displayName}`.trim();
  };

  return (
    <div className="faculty-manager">
      {/* Header */}
      <div className="admin-header">
        <div>
          <p className="eyebrow">Institute management</p>
          <h1>Faculty Manager</h1>
          <p>Manage teacher profiles, photos, and public display. All in one place.</p>
        </div>
        <a className="btn b1" href="/admin/faculty/new">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          + Add Teacher
        </a>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search by name, subject..."
            value={filters.search}
            onChange={e => { setFilters(prev => ({ ...prev, search: e.target.value })); setPagination(prev => ({ ...prev, page: 1 })); }}
            className="filter-input"
          />
          <select
            value={filters.status}
            onChange={e => { setFilters(prev => ({ ...prev, status: e.target.value })); setPagination(prev => ({ ...prev, page: 1 })); }}
            className="filter-select"
          >
            <option value="">All Status</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="HIDDEN">Hidden</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
          </select>
          <select
            value={filters.subject}
            onChange={e => { setFilters(prev => ({ ...prev, subject: e.target.value })); setPagination(prev => ({ ...prev, page: 1 })); }}
            className="filter-select"
          >
            <option value="">All Subjects</option>
            {allFilters.subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filters.classLevel}
            onChange={e => { setFilters(prev => ({ ...prev, classLevel: e.target.value })); setPagination(prev => ({ ...prev, page: 1 })); }}
            className="filter-select"
          >
            <option value="">All Classes</option>
            {allFilters.classLevels.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filters.employmentStatus}
            onChange={e => { setFilters(prev => ({ ...prev, employmentStatus: e.target.value })); setPagination(prev => ({ ...prev, page: 1 })); }}
            className="filter-select"
          >
            <option value="">All Employment</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="FORMER">Former</option>
          </select>
        </div>
        <div className="filter-info">
          {pagination.total} teacher(s)
        </div>
      </div>

      {/* View Toggle */}
      <div className="view-toggle">
        <button
          className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
          onClick={() => setViewMode('grid')}
          aria-label="Grid view"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        </button>
        <button
          className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
          onClick={() => setViewMode('table')}
          aria-label="Table view"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="3" x2="21" y2="3"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="3" x2="3" y2="21"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        </button>
      </div>

      {/* Content */}
      <div className="faculty-content">
        {loading ? (
          <div className="loading-state">Loading faculty...</div>
        ) : faculty.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <h3>No teachers added yet</h3>
            <p>Add your first teacher so parents can meet your team.</p>
            <a className="btn b1" href="/admin/faculty/new">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Teacher
            </a>
          </div>
        ) : (
          <>
            {selectedIds.size > 0 && (
              <div className="bulk-actions-bar">
                <span>{selectedIds.size} selected</span>
                <div className="bulk-actions">
                  <button className="btn-secondary" onClick={() => handleBulkAction('publish')} disabled={bulkActionLoading}>Publish</button>
                  <button className="btn-secondary" onClick={() => handleBulkAction('hide')} disabled={bulkActionLoading}>Hide</button>
                  <button className="btn-secondary" onClick={() => handleBulkAction('draft')} disabled={bulkActionLoading}>Draft</button>
                  <button className="btn-secondary" onClick={() => handleBulkAction('feature')} disabled={bulkActionLoading}>Feature</button>
                  <button className="btn-secondary" onClick={() => handleBulkAction('unfeature')} disabled={bulkActionLoading}>Unfeature</button>
                  <button className="btn-danger" onClick={() => handleBulkAction('delete')} disabled={bulkActionLoading}>Delete</button>
                </div>
              </div>
            )}

            {viewMode === 'grid' ? (
              <div className="faculty-grid">
                {faculty.map(f => (
                  <FacultyCard
                    key={f.id}
                    faculty={f}
                    selected={selectedIds.has(f.id)}
                    onSelect={toggleSelect}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onEdit={() => window.location.href = `/admin/faculty/${f.id}/edit`}
                    onPreview={() => window.open(`/faculty/${f.slug}`, '_blank')}
                    onToggleStatus={() => handleSingleStatusToggle(f)}
                    onDelete={() => setShowDeleteModal(f.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input type="checkbox" checked={selectedIds.size === faculty.length && faculty.length > 0} onChange={toggleSelectAll} />
                      </th>
                      <th onClick={() => handleSort('displayName')}>Photo</th>
                      <th onClick={() => handleSort('displayName')}>Name / Role</th>
                      <th onClick={() => handleSort('role')}>Subjects</th>
                      <th onClick={() => handleSort('status')}>Status</th>
                      <th>Employment</th>
                      <th onClick={() => handleSort('updatedAt')}>Updated</th>
                      <th style={{ width: '140px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {faculty.map((f, index) => (
                      <tr key={f.id} draggable onDragStart={e => handleDragStart(e, f.id, index)} onDragOver={handleDragOver} onDrop={e => handleDrop(e, f.id, index)} onDragEnd={handleDragEnd}>
                        <td>
                          <input type="checkbox" checked={selectedIds.has(f.id)} onChange={() => toggleSelect(f.id)} />
                        </td>
                        <td>
                          <div className="faculty-photo-cell">
                            {f.photoAssetId ? (
                              <img src={`/api/media/asset/${f.photoAssetId}?w=80&h=100`} alt={f.photoAlt || f.displayName} />
                            ) : (
                              <div className="avatar-placeholder" style={{ backgroundColor: getColorFromName(f.displayName) }}>
                                {getInitials(f.displayName)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="faculty-name-cell">
                            <strong>{formatName(f)}</strong>
                            <span className="faculty-role">{f.role}</span>
                          </div>
                        </td>
                        <td>
                          <div className="faculty-subjects">
                            {f.subjects.slice(0, 3).map(s => <span key={s} className="subject-tag">{s}</span>)}
                            {f.subjects.length > 3 && <span className="subject-tag more">+{f.subjects.length - 3}</span>}
                          </div>
                        </td>
                        <td>{getStatusBadge(f.status)}</td>
                        <td>{getEmploymentBadge(f.employmentStatus)}</td>
                        <td>{new Date(f.updatedAt).toLocaleDateString()}</td>
                        <td>
                          <div className="action-buttons">
                            <a className="action-btn" href={`/admin/faculty/${f.id}/edit`} title="Edit">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </a>
                            <button className="action-btn" onClick={() => window.open(`/faculty/${f.slug}`, '_blank')} title="Preview">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                            <button className="action-btn" onClick={() => handleSingleStatusToggle(f)} title={f.status === 'PUBLISHED' ? 'Hide' : 'Publish'}>
                              {f.status === 'PUBLISHED' ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              )}
                            </button>
                            <button className="action-btn danger" onClick={() => setShowDeleteModal(f.id)} title="Delete">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="pagination">
                <button className="page-btn" onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))} disabled={pagination.page === 1}>Previous</button>
                <span>Page {pagination.page} of {pagination.totalPages}</span>
                <button className="page-btn" onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))} disabled={pagination.page >= pagination.totalPages}>Next</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Delete Teacher</h3>
            <p>Are you sure you want to move this teacher to the recycle bin?</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowDeleteModal(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => { handleDelete(showDeleteModal, false); setShowDeleteModal(null); }}>Move to Recycle Bin</button>
              <button className="btn-danger" onClick={() => { handleDelete(showDeleteModal, true); setShowDeleteModal(null); }}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className={`toast ${message.type}`} role="alert">{message.text}</div>
      )}
    </div>
  );
}

function FacultyCard({
  faculty,
  selected,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onEdit,
  onPreview,
  onToggleStatus,
  onDelete,
}: {
  faculty: Faculty;
  selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetId: string, targetIndex: number) => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onPreview: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className={`faculty-card ${selected ? 'selected' : ''}`}
      draggable
      onDragStart={e => onDragStart(e, faculty.id, 0)}
      onDragOver={onDragOver}
      onDrop={e => onDrop(e, faculty.id, 0)}
      onDragEnd={onDragEnd}
      onClick={e => { if (!(e.target as Element).closest('.action-btn')) onSelect(faculty.id); }}
    >
      <div className="card-photo">
        {faculty.photoAssetId ? (
          <img src={`/api/media/asset/${faculty.photoAssetId}?w=240&h=300`} alt={faculty.photoAlt || faculty.displayName} />
        ) : (
          <div className="avatar-placeholder" style={{ backgroundColor: getColorFromName(faculty.displayName) }}>
            {getInitials(faculty.displayName)}
          </div>
        )}
        <div className="card-badges">
          <span className={`status-badge ${STATUS_COLORS[faculty.status] || 'bg-gray-100 text-gray-800'}`}>{faculty.status}</span>
          {faculty.featured && <span className="featured-badge">★ Featured</span>}
        </div>
      </div>
      <div className="card-info">
        <div className="card-name-row">
          <h3>{formatName(faculty)}</h3>
          {faculty.employmentStatus === 'FORMER' && <span className="former-badge">Former</span>}
        </div>
        <p className="card-role">{faculty.role}</p>
        {faculty.subjects.length > 0 && (
          <div className="card-subjects">
            {faculty.subjects.slice(0, 3).map(s => <span key={s} className="subject-tag">{s}</span>)}
            {faculty.subjects.length > 3 && <span className="subject-tag more">+{faculty.subjects.length - 3}</span>}
          </div>
        )}
        {faculty.classLevels.length > 0 && (
          <div className="card-classes">
            {faculty.classLevels.map(c => <span key={c} className="class-tag">{c}</span>)}
          </div>
        )}
        {faculty.shortBio && <p className="card-bio">{faculty.shortBio}</p>}
      </div>
      <div className="card-actions">
        <button className="action-btn" onClick={e => { e.stopPropagation(); onEdit(); }} title="Edit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button className="action-btn" onClick={e => { e.stopPropagation(); onPreview(); }} title="Preview">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button className="action-btn" onClick={e => { e.stopPropagation(); onToggleStatus(); }} title={faculty.status === 'PUBLISHED' ? 'Hide' : 'Publish'}>
          {faculty.status === 'PUBLISHED' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          )}
        </button>
        <button className="action-btn danger" onClick={e => { e.stopPropagation(); onDelete(); }} title="Delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </article>
  );
}

function formatName(f: Faculty) {
  const title = TITLE_LABELS[f.title] || '';
  return `${title} ${f.displayName}`.trim();
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getColorFromName(name: string) {
  const colors = [
    '#0B2A5B', '#1E6BFF', '#F5B82E', '#4A5873', '#D43A3A', '#2E8B57', '#8B4513', '#4B0082',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

async function handleSingleStatusToggle(f: Faculty) {
  const newStatus = f.status === 'PUBLISHED' ? 'HIDDEN' : 'PUBLISHED';
  try {
    const res = await fetch('/api/admin/faculty/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: newStatus === 'PUBLISHED' ? 'publish' : 'hide', ids: [f.id] }),
    });
    if (res.ok) {
      window.location.reload();
    }
  } catch {
    alert('Failed to update status');
  }
}