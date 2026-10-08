'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface FacultyData {
  id?: string;
  slug: string;
  displayName: string;
  fullName: string;
  title: string;
  role: string;
  shortBio: string;
  fullBio: string;
  qualifications: string;
  experienceYears: number | null;
  languages: string;
  specialities: string[];
  achievements: Array<{ text: string; year?: number }>;
  subjects: string[];
  classLevels: string[];
  socialLinks: { linkedin: string; youtube: string; instagram: string };
  publicFields: { email: boolean; phone: boolean };
  contactEmail: string;
  contactPhone: string;
  internalNotes: string;
  status: string;
  featured: boolean;
  order: number;
  consentAt: string | null;
  consentBy: string | null;
  photoAssetId: string | null;
  photoAlt: string;
  photoFocalX: number | null;
  photoFocalY: number | null;
  employmentStatus: string;
  joinedAt: string | null;
  batches: Array<{ id: string; name: string }>;
}

const CLASS_LEVELS = ['Class I – V', 'Class VI – VIII', 'Class IX – X', 'Class XI – XII'];
const TITLES = ['MR', 'MS', 'MRS', 'DR', 'SIR', 'MADAM', 'NONE'];
const TITLE_LABELS: Record<string, string> = {
  MR: 'Mr.', MS: 'Ms.', MRS: 'Mrs.', DR: 'Dr.', SIR: 'Sir', MADAM: 'Madam', NONE: 'None',
};

interface FacultyFormProps {
  facultyId: string;
  isNew: boolean;
  onSave: () => void;
}

export function FacultyForm({ facultyId, isNew, onSave }: FacultyFormProps) {
  const router = useRouter();
  const [data, setData] = useState<FacultyData>({
    slug: '',
    displayName: '',
    fullName: '',
    title: 'NONE',
    role: '',
    shortBio: '',
    fullBio: '',
    qualifications: '',
    experienceYears: null,
    languages: '',
    specialities: [],
    achievements: [],
    subjects: [],
    classLevels: [],
    socialLinks: { linkedin: '', youtube: '', instagram: '' },
    publicFields: { email: false, phone: false },
    contactEmail: '',
    contactPhone: '',
    internalNotes: '',
    status: 'DRAFT',
    featured: false,
    order: 0,
    consentAt: null,
    consentBy: null,
    photoAssetId: null,
    photoAlt: '',
    photoFocalX: null,
    photoFocalY: null,
    employmentStatus: 'ACTIVE',
    joinedAt: null,
    batches: [],
  });
  const [batches, setBatches] = useState<Array<{ id: string; name: string }>>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showCropper, setShowCropper] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const autosaveRef = useRef<NodeJS.Timeout | null>(null);

  const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const newWarnings: Record<string, string> = {};

    if (!data.displayName.trim()) newErrors.displayName = 'Display name is required';
    if (!data.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!data.role.trim()) newErrors.role = 'Role/designation is required';
    if (!data.photoAssetId && data.status === 'PUBLISHED') newErrors.photo = 'Photo is required to publish';
    if (!data.photoAlt && data.status === 'PUBLISHED') newErrors.photoAlt = 'Alt text is required to publish';
    if (!data.consentAt && data.status === 'PUBLISHED') newErrors.consent = 'Consent is required to publish';
    if (data.shortBio.length > 200) newErrors.shortBio = 'Short bio must be 200 characters or less';

    setErrors(newErrors);
    setWarnings(newWarnings);
    return Object.keys(newErrors).length === 0;
  };

  const fetchData = useCallback(async () => {
    if (isNew) {
      try {
        const res = await fetch('/api/admin/faculty');
        if (res.ok) {
          const result = await res.json();
          const maxOrder = Math.max(0, ...result.faculty.map((f: FacultyData) => f.order));
          setData(prev => ({ ...prev, order: maxOrder + 1, slug: '' }));
        }
      } catch {
        // Ignore error for initial order fetch
      }
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/faculty/${facultyId}`);
      if (res.ok) {
        const faculty = await res.json();
        setData(faculty);
        if (faculty.photoAssetId) {
          setPhotoPreview(`/api/media/asset/${faculty.photoAssetId}?w=240&h=300`);
        }
      } else {
        const text = await res.text();
        console.error('Failed to load teacher:', res.status, text);
        showMessage('Failed to load teacher', 'error');
        router.push('/admin/faculty');
      }
    } catch (err) {
      console.error('Failed to load teacher:', err);
      showMessage('Failed to load teacher', 'error');
      router.push('/admin/faculty');
    } finally {
      setLoading(false);
    }
  }, [facultyId, isNew, router, showMessage]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { 
    fetch('/api/admin/batches')
      .then(r => r.ok ? r.json() : r.text().then(t => { throw new Error(t); }))
      .then(d => setBatches(d.batches || []))
      .catch(() => setBatches([])); 
  }, []);
  useEffect(() => { 
    fetch('/api/admin/faculty')
      .then(r => r.ok ? r.json() : r.text().then(t => { throw new Error(t); }))
      .then(d => {
        const allSubjects = [...new Set(d.faculty.flatMap((f: any) => (Array.isArray(f.subjects) ? f.subjects : [])))].sort() as string[];
        setSubjects(allSubjects);
      })
      .catch(() => setSubjects([])); 
  }, []);

  useEffect(() => {
    if (dirty && !isNew) {
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
      autosaveRef.current = setTimeout(() => { handleSave(true); }, 30000);
    }
    return () => { if (autosaveRef.current) clearTimeout(autosaveRef.current); };
  }, [dirty, isNew]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  const updateField = (field: keyof FacultyData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const updateNestedField = (obj: keyof FacultyData, field: string, value: unknown) => {
    setData(prev => ({ ...prev, [obj]: { ...(prev[obj] as Record<string, unknown>), [field]: value } }));
    setDirty(true);
  };

  const handleAchievementChange = (index: number, field: 'text' | 'year', value: string | number) => {
    const newAchievements = [...data.achievements];
    newAchievements[index] = { ...newAchievements[index], [field]: value };
    updateField('achievements', newAchievements);
  };

  const addAchievement = () => updateField('achievements', [...data.achievements, { text: '', year: undefined }]);
  const removeAchievement = (index: number) => updateField('achievements', data.achievements.filter((_, i) => i !== index));
  const addSubject = (subject: string) => { if (subject.trim() && !data.subjects.includes(subject.trim())) updateField('subjects', [...data.subjects, subject.trim()]); };
  const removeSubject = (subject: string) => updateField('subjects', data.subjects.filter(s => s !== subject));
  const addClassLevel = (classLevel: string) => { if (CLASS_LEVELS.includes(classLevel) && !data.classLevels.includes(classLevel)) updateField('classLevels', [...data.classLevels, classLevel]); };
  const removeClassLevel = (classLevel: string) => updateField('classLevels', data.classLevels.filter(c => c !== classLevel));

  const handlePhotoUpload = async (file: File) => {
    setPhotoUploading(true); setPhotoError(null); setWarnings(prev => ({ ...prev, photo: '' }));
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif', 'image/tiff', 'image/bmp', 'image/gif'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|avif|heic|heif|tiff|tif|bmp|gif)$/i)) {
      setPhotoError('Unsupported file format. Please upload JPG, PNG, WebP, AVIF, HEIC, TIFF, BMP, or GIF.');
      setPhotoUploading(false); return;
    }
    const preview = URL.createObjectURL(file); setPhotoPreview(preview);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('slot', 'faculty');
    formData.append('altText', data.photoAlt || `Photo of ${data.displayName}, ${data.role}`);
    formData.append('consentGranted', 'true');
    try {
      const res = await fetch('/api/admin/media', { method: 'POST', body: formData });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Upload failed');
      }
      const result = await res.json();
      setPhotoProcessing(true);
      if (result.jobId) {
        const poll = async () => {
          const jobRes = await fetch(`/api/admin/media/job?jobId=${result.jobId}`);
          if (!jobRes.ok) {
            const text = await jobRes.text();
            throw new Error(text || 'Job polling failed');
          }
          const jobData = await jobRes.json();
          if (jobData.job?.state === 'completed' && jobData.asset) {
            setPhotoProcessing(false);
            setData(prev => ({ ...prev, photoAssetId: jobData.asset.id, photoAlt: data.photoAlt || `Photo of ${data.displayName}, ${data.role}`, photoFocalX: jobData.asset.focalX ?? 0.5, photoFocalY: jobData.asset.focalY ?? 0.5 }));
            setPhotoPreview(`/api/media/asset/${jobData.asset.id}?w=240&h=300`);
            showMessage('Photo uploaded and processed!', 'success');
          } else if (jobData.job?.state === 'failed') {
            setPhotoProcessing(false); setPhotoError(jobData.job.failedReason || 'Processing failed'); setPhotoPreview(null);
          } else { setTimeout(poll, 1000); }
        }; poll();
      }
    } catch (err) { setPhotoError(err instanceof Error ? err.message : 'Upload failed'); setPhotoPreview(null); }
    finally { setPhotoUploading(false); }
  };

  const handlePhotoRemove = () => { if (data.photoAssetId) URL.revokeObjectURL(photoPreview!); updateField('photoAssetId', null); updateField('photoAlt', ''); updateField('photoFocalX', null); updateField('photoFocalY', null); setPhotoPreview(null); setDirty(true); };
  const handlePhotoAdjust = () => setShowCropper(true);
  const handleCropComplete = async (cropData: { x: number; y: number; width: number; height: number; focalX?: number; focalY?: number }) => {
    if (!data.photoAssetId) return; setPhotoProcessing(true);
    try {
      const res = await fetch('/api/admin/media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: data.photoAssetId, cropData: { x: cropData.x, y: cropData.y, width: cropData.width, height: cropData.height, focalX: cropData.focalX, focalY: cropData.focalY }, focalPoint: { x: cropData.focalX || 0.5, y: cropData.focalY || 0.5 }, reprocess: true }) });
      if (res.ok) { showMessage('Photo re-processed with new crop', 'success'); setPhotoPreview(`/api/media/asset/${data.photoAssetId}?w=240&h=300&t=${Date.now()}`); }
    } catch { showMessage('Failed to re-process photo', 'error'); }
    finally { setPhotoProcessing(false); setShowCropper(false); }
  };

  const handleSave = async (autosave = false) => {
    if (!autosave && !validate()) { showMessage('Please fix the errors above', 'error'); return; }
    setSaving(true);
    try {
      const method = isNew ? 'POST' : 'PATCH';
      const url = isNew ? '/api/admin/faculty' : `/api/admin/faculty/${facultyId}`;
      const body = { ...data } as Record<string, unknown>;
      Object.keys(body).forEach(key => body[key] === undefined && delete body[key]);
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Save failed');
      setDirty(false);
      if (!autosave) { showMessage(isNew ? 'Teacher added successfully!' : 'Teacher saved successfully!', 'success'); onSave(); }
    } catch (err) { showMessage(err instanceof Error ? err.message : 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const handlePublish = async () => {
    if (!validate()) return;
    if (!data.photoAssetId) { setWarnings(prev => ({ ...prev, photo: 'Photo is required to publish. Use placeholder?' })); showMessage('Photo is required to publish', 'error'); return; }
    if (!data.photoAlt) { setWarnings(prev => ({ ...prev, photoAlt: 'Alt text is required to publish' })); showMessage('Alt text is required to publish', 'error'); return; }
    if (!data.consentAt) { setWarnings(prev => ({ ...prev, consent: 'Consent is required to publish' })); showMessage('Consent is required to publish', 'error'); return; }
    setData(prev => ({ ...prev, status: 'PUBLISHED', consentAt: new Date().toISOString() }));
    await handleSave();
  };

  const handleConsent = () => { if (!data.consentAt) { updateField('consentAt', new Date().toISOString()); setWarnings(prev => ({ ...prev, consent: '' })); } else { updateField('consentAt', null); } };

  const previewData = { ...data, photoUrl: photoPreview || (data.photoAssetId ? `/api/media/asset/${data.photoAssetId}?w=240&h=300` : undefined), titleLabel: TITLE_LABELS[data.title] };

  if (loading) return <main className="admin-page"><div className="admin-header"><div><p className="eyebrow">Institute management</p><h1>{isNew ? 'Add Teacher' : 'Edit Teacher'}</h1></div></div><div className="loading-state">Loading...</div></main>;

  return (
    <main className="admin-page faculty-form-page">
      <div className="admin-header">
        <div><p className="eyebrow">Institute management</p><h1>{isNew ? 'Add Teacher' : 'Edit Teacher'}</h1><p>Fill in the teacher's details. The preview on the right updates live.</p></div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => handleSave(false)} disabled={saving}>{saving ? 'Saving...' : 'Save Draft'}</button>
          <button className="btn b1" onClick={() => handlePublish()} disabled={saving || data.status === 'PUBLISHED'}>{data.status === 'PUBLISHED' ? 'Published' : 'Publish'}</button>
        </div>
      </div>
      {message && <div className={`toast ${message.type}`} role="alert">{message.text}</div>}
      <div className="faculty-form-layout">
        <div className="form-panel">
          <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
            <section className="form-section"><h2>Photo</h2><PhotoUploadSection photoPreview={photoPreview} photoUploading={photoUploading} photoProcessing={photoProcessing} photoError={photoError} photoAlt={data.photoAlt} onAltChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('photoAlt', e.target.value)} onUpload={handlePhotoUpload} onRemove={handlePhotoRemove} onAdjust={handlePhotoAdjust} hasPhoto={!!data.photoAssetId} consentAt={data.consentAt} onConsent={handleConsent} /></section>
            <section className="form-section"><h2>Basic Information</h2><div className="form-grid">
              <div className="form-field"><label>Display Name <span className="required">*</span></label><input value={data.displayName} onChange={e => updateField('displayName', e.target.value)} placeholder="e.g., Rudraksh Sir" /><small>How the name appears publicly (e.g., "Rudraksh Sir", "Dr. Sharma")</small>{errors.displayName && <span className="error">{errors.displayName}</span>}</div>
              <div className="form-field"><label>Full Legal Name <span className="required">*</span></label><input value={data.fullName} onChange={e => updateField('fullName', e.target.value)} placeholder="e.g., Rudraksh Sharma" /><small>Legal name for internal records</small>{errors.fullName && <span className="error">{errors.fullName}</span>}</div>
              <div className="form-field"><label>Title / Prefix</label><select value={data.title} onChange={e => updateField('title', e.target.value)}>{TITLES.map(t => <option key={t} value={t}>{TITLE_LABELS[t] || t}</option>)}</select></div>
              <div className="form-field"><label>Role / Designation <span className="required">*</span></label><input value={data.role} onChange={e => updateField('role', e.target.value)} placeholder="e.g., Physics Faculty, Founder & Director" />{errors.role && <span className="error">{errors.role}</span>}</div>
              <div className="form-field"><label>Subjects Taught <span className="required">*</span></label><div className="multi-select"><input type="text" placeholder="Type to add subject..." onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSubject(e.currentTarget.value); e.currentTarget.value = ''; }}} list="subjects-list" /><datalist id="subjects-list">{subjects.map(s => <option key={s} value={s} />)}</datalist><div className="selected-tags">{data.subjects.map(s => (<span key={s} className="tag">{s}<button type="button" onClick={() => removeSubject(s)}>×</button></span>))}</div></div></div>
              <div className="form-field"><label>Classes Taught</label><div className="class-chips">{CLASS_LEVELS.map(c => (<label key={c} className={`class-chip ${data.classLevels.includes(c) ? 'selected' : ''}`}><input type="checkbox" checked={data.classLevels.includes(c)} onChange={e => e.target.checked ? addClassLevel(c) : removeClassLevel(c)} />{c}</label>))}</div></div>
              <div className="form-field"><label>Employment Status</label><select value={data.employmentStatus} onChange={e => updateField('employmentStatus', e.target.value)}><option value="ACTIVE">Active</option><option value="ON_LEAVE">On Leave</option><option value="FORMER">Former</option></select></div>
              <div className="form-field"><label>Joining Date</label><input type="date" value={data.joinedAt ? data.joinedAt.split('T')[0] : ''} onChange={e => updateField('joinedAt', e.target.value ? new Date(e.target.value).toISOString() : null)} /></div>
            </div></section>
            <section className="form-section"><h2>Bio & Qualifications</h2><div className="form-grid">
              <div className="form-field full-width"><label>Short Bio (max 200 chars)</label><textarea value={data.shortBio} onChange={e => updateField('shortBio', e.target.value)} maxLength={200} rows={3} placeholder="Brief description shown on the card..." /><div className="char-count">{data.shortBio.length}/200</div>{errors.shortBio && <span className="error">{errors.shortBio}</span>}</div>
              <div className="form-field full-width"><label>Full Bio (Rich Text)</label><textarea value={data.fullBio} onChange={e => updateField('fullBio', e.target.value)} rows={6} placeholder="Detailed biography for profile page..." /></div>
              <div className="form-field"><label>Qualifications</label><input value={data.qualifications} onChange={e => updateField('qualifications', e.target.value)} placeholder="e.g., M.Sc Physics, B.Ed, PhD" /></div>
              <div className="form-field"><label>Years of Experience</label><input type="number" min="0" max="100" value={data.experienceYears || ''} onChange={e => updateField('experienceYears', e.target.value ? parseInt(e.target.value) : null)} placeholder="e.g., 15" /></div>
              <div className="form-field"><label>Languages Spoken</label><input value={data.languages} onChange={e => updateField('languages', e.target.value)} placeholder="e.g., Hindi, English, Sanskrit" /></div>
              <div className="form-field full-width"><label>Teaching Specialities (comma-separated)</label><input value={data.specialities.join(', ')} onChange={e => updateField('specialities', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="e.g., JEE Advanced, NEET, Olympiad Coaching" /></div>
            </div><div className="form-field full-width"><label>Achievements</label>{data.achievements.map((a, i) => (<div key={i} className="achievement-row"><input type="text" value={a.text} onChange={e => handleAchievementChange(i, 'text', e.target.value)} placeholder="Achievement description" /><input type="number" min="1900" max="2100" value={a.year || ''} onChange={e => handleAchievementChange(i, 'year', e.target.value ? parseInt(e.target.value) : '')} placeholder="Year" style={{ width: '80px' }} /><button type="button" className="icon-btn" onClick={() => removeAchievement(i)} title="Remove"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>))}<button type="button" className="btn-secondary add-btn" onClick={addAchievement}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Achievement</button></div></section>
            <section className="form-section"><h2>Contact & Social Links</h2><div className="form-grid">
              <div className="form-field"><label>Contact Email</label><div className="field-with-toggle"><input type="email" value={data.contactEmail} onChange={e => updateField('contactEmail', e.target.value)} placeholder="teacher@school.edu" /><label className="toggle"><input type="checkbox" checked={data.publicFields.email} onChange={e => updateNestedField('publicFields', 'email', e.target.checked)} /><span>Show publicly</span></label></div><small className="help-text">Private by default. Toggle to display on public profile.</small></div>
              <div className="form-field"><label>Contact Phone</label><div className="field-with-toggle"><input type="tel" value={data.contactPhone} onChange={e => updateField('contactPhone', e.target.value)} placeholder="+91 98765 43210" /><label className="toggle"><input type="checkbox" checked={data.publicFields.phone} onChange={e => updateNestedField('publicFields', 'phone', e.target.checked)} /><span>Show publicly</span></label></div><small className="help-text">Private by default. Toggle to display on public profile.</small></div>
              <div className="form-field"><label>LinkedIn</label><input type="url" value={data.socialLinks.linkedin} onChange={e => updateNestedField('socialLinks', 'linkedin', e.target.value)} placeholder="https://linkedin.com/in/..." /></div>
              <div className="form-field"><label>YouTube Channel</label><input type="url" value={data.socialLinks.youtube} onChange={e => updateNestedField('socialLinks', 'youtube', e.target.value)} placeholder="https://youtube.com/@..." /></div>
              <div className="form-field"><label>Instagram</label><input type="url" value={data.socialLinks.instagram} onChange={e => updateNestedField('socialLinks', 'instagram', e.target.value)} placeholder="https://instagram.com/..." /></div>
            </div></section>
            <section className="form-section"><h2>Batch Links (Internal)</h2><div className="batch-multi-select">{batches.map(b => (<label key={b.id} className="batch-option"><input type="checkbox" checked={data.batches.some(bd => bd.id === b.id)} onChange={e => { if (e.target.checked) updateField('batches', [...data.batches, { id: b.id, name: b.name }]); else updateField('batches', data.batches.filter(bd => bd.id !== b.id)); }} />{b.name} ({b.id.slice(0, 8)})</label>))}</div></section>
            <section className="form-section"><h2>Internal</h2><div className="form-grid">
              <div className="form-field full-width"><label>Internal Notes (Admin Only)</label><textarea value={data.internalNotes} onChange={e => updateField('internalNotes', e.target.value)} rows={3} placeholder="Notes visible only to admin/staff..." /></div>
              <div className="form-field"><label>Display Order</label><input type="number" min="0" value={data.order} onChange={e => updateField('order', parseInt(e.target.value) || 0)} /></div>
              <div className="form-field"><label>Visibility</label><select value={data.status} onChange={e => updateField('status', e.target.value)}><option value="DRAFT">Draft</option><option value="HIDDEN">Hidden</option><option value="PUBLISHED">Published</option><option value="PENDING_APPROVAL">Pending Approval</option></select></div>
              <div className="form-field"><label className="toggle"><input type="checkbox" checked={data.featured} onChange={e => updateField('featured', e.target.checked)} /><span>Featured on Homepage</span></label></div>
            </div></section>
            <div className="form-actions"><button type="button" className="btn-secondary" onClick={() => handleSave(false)} disabled={saving}>{saving ? 'Saving...' : 'Save Draft'}</button><button type="button" className="btn b1" onClick={() => handlePublish()} disabled={saving || data.status === 'PUBLISHED'}>{data.status === 'PUBLISHED' ? 'Published' : 'Publish'}</button></div>
          </form>
        </div>
        <div className="preview-panel"><div className="preview-header"><h3>Live Preview</h3><div className="preview-mode-toggle"><button className={previewMode === 'desktop' ? 'active' : ''} onClick={() => setPreviewMode('desktop')} aria-label="Desktop preview"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/></svg></button><button className={previewMode === 'mobile' ? 'active' : ''} onClick={() => setPreviewMode('mobile')} aria-label="Mobile preview"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></button></div></div><FacultyPreview data={previewData} mode={previewMode} /></div>
      </div>
      {showCropper && data.photoAssetId && (<PhotoCropperModal assetId={data.photoAssetId} onComplete={handleCropComplete} onCancel={() => setShowCropper(false)} />)}
      {message && <div className={`toast ${message.type}`} role="alert">{message.text}</div>}
    </main>
  );
}

function PhotoUploadSection({ photoPreview, photoUploading, photoProcessing, photoError, photoAlt, onAltChange, onUpload, onRemove, onAdjust, hasPhoto, consentAt, onConsent }: any) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); if (e.dataTransfer.files[0]) onUpload(e.dataTransfer.files[0]); };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  return (<div className="photo-upload-section"><div className={`photo-dropzone ${photoUploading ? 'uploading' : ''} ${photoProcessing ? 'processing' : ''} ${hasPhoto ? 'has-photo' : ''}`} onDrop={handleDrop} onDragOver={handleDragOver} onClick={() => !hasPhoto && fileInputRef.current?.click()}><input ref={fileInputRef} type="file" accept="image/*,.heic,.heif,.tiff,.tif,.bmp,.gif" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} style={{ display: 'none' }} />{photoPreview && <img src={photoPreview} alt="Preview" className="photo-preview" />}{!photoPreview && (<div className="dropzone-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><p>Drag & drop or click to upload photo</p><span>JPG, PNG, WebP, AVIF, HEIC, TIFF, BMP, GIF · Max 50 MB</span></div>)}{(photoUploading || photoProcessing) && (<div className="upload-overlay"><div className="spinner" /><span>{photoUploading ? 'Uploading...' : 'Processing...'}</span></div>)}{hasPhoto && (<div className="photo-actions"><button type="button" className="btn-secondary" onClick={onAdjust}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Adjust</button><button type="button" className="btn-danger" onClick={onRemove}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Remove</button></div>)}</div><div className="photo-meta"><div className="form-field"><label>Alt Text <span className="required">*</span></label><input value={photoAlt} onChange={onAltChange} placeholder="e.g., Photo of Rudraksh Sir, Physics Faculty" disabled={!hasPhoto} /><small>Describe the photo for accessibility. Auto-filled from name and role.</small></div><div className="form-field"><label className="toggle consent-toggle"><input type="checkbox" checked={!!consentAt} onChange={onConsent} /><span><strong>This teacher has agreed</strong> to their photo and details being shown on the website</span></label>{consentAt && <span className="consent-timestamp">Consent given: {new Date(consentAt).toLocaleString()}</span>}</div>{photoError && <div className="photo-error">{photoError}</div>}</div></div>);
}

function FacultyPreview({ data, mode }: { data: FacultyData & { photoUrl?: string }; mode: 'desktop' | 'mobile' }) {
  const photoUrl = data.photoUrl || (data.photoAssetId ? `/api/media/asset/${data.photoAssetId}?w=240&h=300` : null);
  const initials = data.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const color = getColorFromName(data.displayName);
  const titleLabel = TITLE_LABELS[data.title] || '';
  const fullName = `${titleLabel} ${data.displayName}`.trim();
  return (<div className={`faculty-preview ${mode}`}><div className="preview-card"><div className="preview-photo">{photoUrl ? <img src={photoUrl} alt={data.photoAlt || data.displayName} /> : <div className="avatar-placeholder" style={{ backgroundColor: color }}>{initials}</div>}</div><div className="preview-info"><h4>{fullName}</h4><p className="preview-role">{data.role}</p>{data.subjects.length > 0 && (<div className="preview-subjects">{data.subjects.slice(0, 3).map(s => <span key={s} className="subject-tag">{s}</span>)} {data.subjects.length > 3 && <span className="subject-tag more">+{data.subjects.length - 3}</span>}</div>)}{data.classLevels.length > 0 && (<div className="preview-classes">{data.classLevels.map(c => <span key={c} className="class-tag">{c}</span>)}</div>)}{data.shortBio && <p className="preview-bio">{data.shortBio}</p>}{(data.qualifications || data.experienceYears) && (<div className="preview-meta">{data.qualifications && <span className="meta-item">Qualifications: {data.qualifications}</span>}{data.experienceYears && <span className="meta-item">Experience: {data.experienceYears} years</span>}</div>)}{data.fullBio && <div className="preview-full-bio">{data.fullBio}</div>}{(data.socialLinks.linkedin || data.socialLinks.youtube || data.socialLinks.instagram || (data.publicFields.email && data.contactEmail) || (data.publicFields.phone && data.contactPhone)) && (<div className="preview-links">{(data.publicFields.email && data.contactEmail) && <a href={`mailto:${data.contactEmail}`} className="preview-link">Email</a>}{(data.publicFields.phone && data.contactPhone) && <a href={`tel:${data.contactPhone}`} className="preview-link">Phone</a>}{data.socialLinks.linkedin && <a href={data.socialLinks.linkedin} target="_blank" rel="noopener" className="preview-link">LinkedIn</a>}{data.socialLinks.youtube && <a href={data.socialLinks.youtube} target="_blank" rel="noopener" className="preview-link">YouTube</a>}{data.socialLinks.instagram && <a href={data.socialLinks.instagram} target="_blank" rel="noopener" className="preview-link">Instagram</a>}</div>)}</div></div>{mode === 'mobile' && <p className="preview-note">This is how the card appears on mobile screens.</p>}</div>);
}

function PhotoCropperModal({ assetId, onComplete, onCancel }: any) {
  return (<div className="modal-overlay" onClick={onCancel}><div className="modal modal-lg" onClick={e => e.stopPropagation()}><div className="modal-header"><h3>Adjust Photo</h3><button className="modal-close" onClick={onCancel}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div className="modal-body"><div className="cropper-preview"><img src={`/api/media/asset/${assetId}?w=600&h=750`} alt="Crop preview" /><div className="crop-overlay" /></div><p className="cropper-hint">Drag to pan, scroll to zoom. Click to set focal point. Full cropper UI would be implemented with a library like react-image-crop.</p></div><div className="modal-footer"><button className="btn-secondary" onClick={onCancel}>Cancel</button><button className="btn b1" onClick={() => onComplete({ x: 0, y: 0, width: 800, height: 1000, focalX: 0.5, focalY: 0.3 })}>Apply</button></div></div></div>);
}

function getColorFromName(name: string) { const colors = ['#0B2A5B', '#1E6BFF', '#F5B82E', '#4A5873', '#D43A3A', '#2E8B57', '#8B4513', '#4B0082']; let hash = 0; for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash); return colors[Math.abs(hash) % colors.length]; }