'use client';

import { useEffect, useState, useCallback } from 'react';
import { ImageSlotKey, getSlotConfig, getAllSlots, formatFileSize, formatAspectRatio } from '@/lib/image-slots';

interface MediaAsset {
  id: string;
  slot: string;
  originalFilename: string;
  originalWidth: number;
  originalHeight: number;
  originalSize: number;
  altText: string | null;
  caption: string | null;
  isDecorative: boolean;
  consentStatus: string;
  status: string;
  blurDataURL: string | null;
  dominantColor: string | null;
  cropX: number | null;
  cropY: number | null;
  cropWidth: number | null;
  cropHeight: number | null;
  focalX: number | null;
  focalY: number | null;
  createdAt: string;
  updatedAt: string;
  variants: Array<{
    id: string;
    width: number;
    height: number;
    format: string;
    size: number;
    url: string;
  }>;
}

interface MediaLibraryProps {
  initialAssets?: MediaAsset[];
  initialTotal?: number;
}

function MediaLibrary({ initialAssets = [], initialTotal = 0 }: MediaLibraryProps) {
  const [assets, setAssets] = useState<MediaAsset[]>(initialAssets);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [slotFilter, setSlotFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState<{ id: string; permanent: boolean } | null>(null);
  const [reprocessing, setReprocessing] = useState<Set<string>>(new Set());

  const showMessage = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  }, []);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort: sortBy,
        order: sortOrder,
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (slotFilter) params.set('slot', slotFilter);

      const res = await fetch(`/api/admin/media?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets);
        setTotal(data.pagination.total);
      } else {
        showMessage('Failed to load media library', 'error');
      }
    } catch (err) {
      showMessage('Failed to load media library', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, slotFilter, sortBy, sortOrder, showMessage]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedAssets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedAssets.size === assets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(assets.map(a => a.id)));
    }
  };

  const handleDelete = async (id: string, permanent = false) => {
    if (!confirm(permanent ? 'Permanently delete this image? This cannot be undone.' : 'Move to recycle bin?')) return;
    if (permanent && !prompt('Type DELETE to confirm:')?.includes('DELETE')) return;

    try {
      const res = await fetch(`/api/admin/media?id=${id}&permanent=${permanent}`, { method: 'DELETE' });
      if (res.ok) {
        showMessage(permanent ? 'Permanently deleted' : 'Moved to recycle bin', 'success');
        fetchAssets();
        setSelectedAssets(new Set());
      } else {
        const err = await res.json();
        showMessage(err.error || 'Delete failed', 'error');
      }
    } catch {
      showMessage('Delete failed', 'error');
    }
  };

  const handleBulkDelete = async (permanent = false) => {
    if (selectedAssets.size === 0) return;
    if (!confirm(`Delete ${selectedAssets.size} images?${permanent ? ' This cannot be undone.' : ''}`)) return;
    if (permanent && !prompt('Type DELETE to confirm:')?.includes('DELETE')) return;

    for (const id of selectedAssets) {
      await fetch(`/api/admin/media?id=${id}&permanent=${permanent}`, { method: 'DELETE' });
    }
    showMessage(`${selectedAssets.size} images ${permanent ? 'permanently deleted' : 'moved to recycle bin'}`, 'success');
    fetchAssets();
    setSelectedAssets(new Set());
  };

  const handleRegenerateVariants = async (id: string) => {
    if (!confirm('Regenerate all variants for this image from the stored original? This may take a moment.')) return;

    setReprocessing(prev => new Set(prev).add(id));

    try {
      const res = await fetch('/api/admin/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, reprocess: true }),
      });

      if (res.ok) {
        showMessage('Variants regeneration started', 'success');
        // Poll for completion
        const poll = setInterval(async () => {
          const checkRes = await fetch(`/api/admin/media/job?assetId=${id}`);
          if (checkRes.ok) {
            const data = await checkRes.json();
            if (data.asset?.status === 'READY' || data.asset?.status === 'FAILED') {
              clearInterval(poll);
              fetchAssets();
            }
          }
        }, 2000);
        setTimeout(() => clearInterval(poll), 60000);
      } else {
        const err = await res.json();
        showMessage(err.error || 'Regeneration failed', 'error');
      }
    } catch {
      showMessage('Regeneration failed', 'error');
    } finally {
      setReprocessing(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleReprocessAll = async () => {
    if (!confirm('Regenerate ALL variants for ALL images? This will process every image in the library and may take several minutes.')) return;

    try {
      const res = await fetch('/api/admin/media', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const result = await res.json();
        showMessage(result.message, 'success');
        // Refresh after a delay
        setTimeout(fetchAssets, 5000);
      } else {
        const err = await res.json();
        showMessage(err.error || 'Reprocess all failed', 'error');
      }
    } catch {
      showMessage('Reprocess all failed', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      READY: 'bg-green-50 text-green-700',
      PROCESSING: 'bg-blue-50 text-blue-700',
      FAILED: 'bg-red-50 text-red-700',
      DELETED: 'bg-gray-50 text-gray-600',
    };
    const labels: Record<string, string> = {
      READY: 'Ready',
      PROCESSING: 'Processing',
      FAILED: 'Failed',
      DELETED: 'Deleted',
    };
    return (
      <span className={`status-badge ${colors[status] || 'bg-gray-50 text-gray-600'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getConsentBadge = (status: string, slot: string) => {
    const slotConfig = getSlotConfig(slot.toLowerCase() as any);
    if (!slotConfig.requiresConsent) return <span className="consent-badge not-required">Not Required</span>;

    const colors: Record<string, string> = {
      GRANTED: 'bg-green-50 text-green-700',
      PENDING: 'bg-yellow-50 text-yellow-700',
      DENIED: 'bg-red-50 text-red-700',
      WITHDRAWN: 'bg-red-50 text-red-700',
      NOT_REQUIRED: 'bg-gray-50 text-gray-600',
    };
    return <span className={`consent-badge ${colors[status] || 'bg-gray-50 text-gray-600'}`}>{status}</span>;
  };

  const getQualityBadge = (asset: MediaAsset) => {
    if (asset.originalWidth === 0) return null;
    const slotConfig = getSlotConfig(asset.slot.toLowerCase() as any);
    const targetPixels = (slotConfig.suggestedWidth || slotConfig.minWidth) * (slotConfig.suggestedHeight || slotConfig.minHeight);
    const originalPixels = asset.originalWidth * asset.originalHeight;
    const ratio = originalPixels / targetPixels;

    if (ratio >= 1) return <span className="quality-badge good" title="Good quality">✓ Good</span>;
    if (ratio >= 0.25) return <span className="quality-badge ok" title="May look soft on large screens">~ OK</span>;
    return <span className="quality-badge low" title="Low resolution - best for small sizes">⚠ Low</span>;
  };

  const slots = getAllSlots().filter(s => s.category !== 'thumbnail');

  return (
    <div className="media-library">
      {/* Header */}
      <div className="library-header">
        <div>
          <h1>Media Library</h1>
          <p>Manage all uploaded images, view variants, and check optimization status.</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={fetchAssets}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <polyline points="23 20 23 14 17 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
          <button className="btn-primary" onClick={handleReprocessAll}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Reprocess All
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="library-filters">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search filename, alt text, caption..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="filter-input"
          />
          <select value={slotFilter} onChange={e => { setSlotFilter(e.target.value); setPage(1); }} className="filter-select">
            <option value="">All Types</option>
            {getAllSlots().filter(s => s.category !== 'thumbnail').map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="filter-select">
            <option value="">All Status</option>
            <option value="READY">Ready</option>
            <option value="PROCESSING">Processing</option>
            <option value="FAILED">Failed</option>
            <option value="DELETED">Deleted</option>
          </select>
        </div>
        <div className="filter-info">
          {total} images • {assets.filter(a => a.status === 'READY').length} ready • {assets.filter(a => a.status === 'PROCESSING').length} processing • {assets.filter(a => a.status === 'FAILED').length} failed
        </div>
      </div>

      {/* Table */}
      <div className="library-table-wrapper">
        {loading ? (
          <div className="loading-state">Loading media library...</div>
        ) : assets.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8" />
              <path d="M12 17v4" />
            </svg>
            <h3>No images found</h3>
            <p>{search || slotFilter || statusFilter ? 'Try adjusting your filters' : 'Upload your first image to get started'}</p>
          </div>
        ) : (
          <>
            <div className="table-toolbar">
              <div className="selection-info">
                {selectedAssets.size > 0 && (
                  <span>{selectedAssets.size} selected</span>
                )}
              </div>
              <div className="bulk-actions">
                {selectedAssets.size > 0 && (
                  <>
                    <button className="btn-secondary" onClick={() => handleBulkDelete(false)}>Move to Recycle Bin</button>
                    <button className="btn-danger" onClick={() => handleBulkDelete(true)}>Delete Permanently</button>
                  </>
                )}
              </div>
            </div>
            <div className="table-responsive">
              <table className="library-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input type="checkbox" checked={selectedAssets.size === assets.length && assets.length > 0} onChange={toggleSelectAll} />
                    </th>
                    <th onClick={() => handleSort('originalFilename')}>Preview</th>
                    <th onClick={() => handleSort('slot')}>Type</th>
                    <th onClick={() => handleSort('originalFilename')}>Filename</th>
                    <th>Dimensions</th>
                    <th>Size</th>
                    <th>Quality</th>
                    <th>Status</th>
                    <th>Consent</th>
                    <th>Alt Text</th>
                    <th>Variants</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map(asset => (
                    <tr key={asset.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedAssets.has(asset.id)}
                          onChange={() => toggleSelect(asset.id)}
                        />
                      </td>
                      <td>
                        <div className="asset-preview">
                          {asset.variants.length > 0 ? (
                            <img
                              src={asset.variants.find(v => v.format === 'webp' && v.width <= 320)?.url || asset.variants[0]?.url}
                              alt=""
                              loading="lazy"
                            />
                          ) : asset.blurDataURL && (
                            <div className="placeholder-preview" style={{ backgroundColor: asset.dominantColor || '#888' }} />
                          )}
                          {asset.status === 'DELETED' && <span className="deleted-overlay">Deleted</span>}
                          {asset.status === 'PROCESSING' && <span className="processing-overlay">⟳</span>}
                          {asset.status === 'FAILED' && <span className="failed-overlay">✗</span>}
                        </div>
                      </td>
                      <td>
                        <span className="slot-badge">{asset.slot.replace(/_/g, ' ')}</span>
                      </td>
                      <td>
                        <div className="filename-cell">
                          <span className="filename">{asset.originalFilename}</span>
                          {asset.status === 'FAILED' && <span className="error-badge">Failed</span>}
                        </div>
                      </td>
                      <td>{asset.originalWidth}×{asset.originalHeight}</td>
                      <td>{formatFileSize(asset.originalSize)}</td>
                      <td>{getQualityBadge(asset)}</td>
                      <td>{getStatusBadge(asset.status)}</td>
                      <td>{getConsentBadge(asset.consentStatus, asset.slot)}</td>
                      <td className="alt-text-cell">
                        {asset.isDecorative ? (
                          <span className="decorative-label">Decorative</span>
                        ) : asset.altText ? (
                          <span className="alt-text-present">{asset.altText.substring(0, 60)}{asset.altText.length > 60 ? '...' : ''}</span>
                        ) : (
                          <span className="missing-alt">Missing alt text</span>
                        )}
                      </td>
                      <td>{asset.variants.length} variants</td>
                      <td>{new Date(asset.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="action-buttons">
                          {asset.variants.length > 0 && (
                            <button
                              className="action-btn"
                              title="View full size"
                              onClick={() => window.open(asset.variants.find(v => v.format === 'avif' && v.width >= 1280)?.url || asset.variants[0]?.url, '_blank')}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                          )}
                          <button
                            className={`action-btn ${reprocessing.has(asset.id) ? 'loading' : ''}`}
                            title="Regenerate variants from original"
                            onClick={() => handleRegenerateVariants(asset.id)}
                            disabled={reprocessing.has(asset.id) || asset.status === 'PROCESSING'}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                          </button>
                          <button
                            className="action-btn danger"
                            title="Delete"
                            onClick={() => setShowDeleteModal({ id: asset.id, permanent: false })}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="pagination">
          <button
            className="page-btn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span>Page {page} of {Math.ceil(total / limit)}</span>
          <button
            className="page-btn"
            onClick={() => setPage(p => Math.min(Math.ceil(total / limit), p + 1))}
            disabled={page >= Math.ceil(total / limit)}
          >
            Next
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Delete Image</h3>
            <p>Are you sure you want to {showDeleteModal.permanent ? 'permanently delete' : 'move to recycle bin'} this image?</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowDeleteModal(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => { handleDelete(showDeleteModal.id, false); setShowDeleteModal(null); }}>
                Move to Recycle Bin
              </button>
              <button className="btn-danger" onClick={() => { handleDelete(showDeleteModal.id, true); setShowDeleteModal(null); }}>
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className={`toast ${message.type}`} role="alert">
          {message.text}
        </div>
      )}
    </div>
  );
}

export default MediaLibrary;