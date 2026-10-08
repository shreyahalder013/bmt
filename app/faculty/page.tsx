'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

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
  photoAssetId: string | null;
  photoAlt: string | null;
  featured: boolean;
  order: number;
}

const CLASS_LEVELS = ['Class I – V', 'Class VI – VIII', 'Class IX – X', 'Class XI – XII'];
const TITLE_LABELS: Record<string, string> = {
  MR: 'Mr.', MS: 'Ms.', MRS: 'Mrs.', DR: 'Dr.', SIR: 'Sir', MADAM: 'Madam', NONE: '',
};

export default function FacultyPage() {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'carousel'>('grid');
  const [carouselIndex, setCarouselIndex] = useState(0);

  const fetchFaculty = useCallback(async () => {
    try {
      const res = await fetch('/api/faculty', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setFaculty(data.faculty || []);
      } else {
        setError('Failed to load faculty');
      }
    } catch {
      setError('Failed to load faculty');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFaculty();
  }, [fetchFaculty]);

  // Get unique subjects and class levels for filters
  const allSubjects = [...new Set(faculty.flatMap(f => f.subjects))].sort();
  const allClasses = [...new Set(faculty.flatMap(f => f.classLevels))].sort();

  const filteredFaculty = faculty.filter(f => {
    if (selectedSubject !== 'all' && !f.subjects.includes(selectedSubject)) return false;
    if (selectedClass !== 'all' && !f.classLevels.includes(selectedClass)) return false;
    return true;
  });

  const titleLabel = (title: string) => TITLE_LABELS[title] || '';

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const getColorFromName = (name: string) => {
    const colors = ['#0B2A5B', '#1E6BFF', '#F5B82E', '#4A5873', '#D43A3A', '#2E8B57', '#8B4513', '#4B0082'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) {
    return (
      <main className="faculty-page">
        <div className="wrap">
          <div className="loading-state">Loading faculty...</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="faculty-page">
        <div className="wrap">
          <div className="error-state">
            <p>{error}</p>
            <button onClick={fetchFaculty} className="btn b1">Retry</button>
          </div>
        </div>
      </main>
    );
  }

  if (filteredFaculty.length === 0) {
    return (
      <main className="faculty-page">
        <div className="wrap">
          <section className="faculty-empty">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <h2>Faculty Details Coming Soon</h2>
            <p>Our teacher profiles are being prepared. Please check back soon!</p>
            <a href="/enquiry" className="btn b1">Enquire Now</a>
          </section>
        </div>
      </main>
    );
  }

  const featuredFaculty = filteredFaculty.filter(f => f.featured);
  const regularFaculty = filteredFaculty.filter(f => !f.featured);
  const displayFaculty = [...featuredFaculty, ...regularFaculty];

  return (
    <main className="faculty-page">
      <div className="wrap">
        <header className="faculty-header">
          <h1>Meet the Minds Behind the Learning</h1>
          <p>Our dedicated faculty bring expertise, passion, and a commitment to student success.</p>
        </header>

        {allSubjects.length > 0 || allClasses.length > 0 ? (
          <div className="faculty-filters">
            <div className="filter-group">
              <label htmlFor="subject-filter">Filter by Subject:</label>
              <select id="subject-filter" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                <option value="all">All Subjects</option>
                {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="class-filter">Filter by Class:</label>
              <select id="class-filter" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                <option value="all">All Classes</option>
                {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>View:</label>
              <div className="view-toggle">
                <button
                  className={viewMode === 'grid' ? 'active' : ''}
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                </button>
                <button
                  className={viewMode === 'carousel' ? 'active' : ''}
                  onClick={() => setViewMode('carousel')}
                  aria-label="Carousel view"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2"/></svg>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {viewMode === 'grid' ? (
          <div className="faculty-grid">
            {displayFaculty.map((f, index) => (
              <article key={f.id} className="faculty-card">
                <a href={`/faculty/${f.slug}`} className="card-link">
                  <div className="card-photo">
                    {f.photoAssetId ? (
                      <Image
                        src={`/api/media/asset/${f.photoAssetId}?w=320&h=400`}
                        alt={f.photoAlt || f.displayName}
                        width={320}
                        height={400}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="card-image"
                        placeholder="blur"
                        blurDataURL={`/api/media/asset/${f.photoAssetId}?w=20&h=20`}
                      />
                    ) : (
                      <div className="avatar-placeholder" style={{ backgroundColor: getColorFromName(f.displayName) }}>
                        {getInitials(f.displayName)}
                      </div>
                    )}
                    {f.featured && <span className="featured-badge">★ Featured</span>}
                  </div>
                  <div className="card-info">
                    <h3>{titleLabel(f.title)} {f.displayName}</h3>
                    <p className="card-role">{f.role}</p>
                    {f.subjects.length > 0 && (
                      <div className="card-subjects">
                        {f.subjects.slice(0, 3).map(s => <span key={s} className="subject-tag">{s}</span>)}
                        {f.subjects.length > 3 && <span className="subject-tag more">+{f.subjects.length - 3}</span>}
                      </div>
                    )}
                    {f.classLevels.length > 0 && (
                      <div className="card-classes">
                        {f.classLevels.map(c => <span key={c} className="class-tag">{c}</span>)}
                      </div>
                    )}
                    {f.shortBio && <p className="card-bio">{f.shortBio}</p>}
                  </div>
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div className="faculty-carousel">
            <button
              className="carousel-nav prev"
              onClick={() => setCarouselIndex(i => (i - 1 + displayFaculty.length) % displayFaculty.length)}
              aria-label="Previous teacher"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div className="carousel-track">
              {displayFaculty.map((f, index) => (
                <article key={f.id} className={`carousel-card ${index === carouselIndex ? 'active' : ''}`}>
                  <div className="card-photo">
                    {f.photoAssetId ? (
                      <Image
                        src={`/api/media/asset/${f.photoAssetId}?w=320&h=400`}
                        alt={f.photoAlt || f.displayName}
                        width={320}
                        height={400}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="card-image"
                        placeholder="blur"
                        blurDataURL={`/api/media/asset/${f.photoAssetId}?w=20&h=20`}
                      />
                    ) : (
                      <div className="avatar-placeholder" style={{ backgroundColor: getColorFromName(f.displayName) }}>
                        {getInitials(f.displayName)}
                      </div>
                    )}
                    {f.featured && <span className="featured-badge">★ Featured</span>}
                  </div>
                  <div className="card-info">
                    <h3>{titleLabel(f.title)} {f.displayName}</h3>
                    <p className="card-role">{f.role}</p>
                    {f.subjects.length > 0 && (
                      <div className="card-subjects">
                        {f.subjects.slice(0, 3).map(s => <span key={s} className="subject-tag">{s}</span>)}
                        {f.subjects.length > 3 && <span className="subject-tag more">+{f.subjects.length - 3}</span>}
                      </div>
                    )}
                    {f.classLevels.length > 0 && (
                      <div className="card-classes">
                        {f.classLevels.map(c => <span key={c} className="class-tag">{c}</span>)}
                      </div>
                    )}
                    {f.shortBio && <p className="card-bio">{f.shortBio}</p>}
                    <a href={`/faculty/${f.slug}`} className="view-profile-btn">View Profile</a>
                  </div>
                </article>
              ))}
            </div>
            <button
              className="carousel-nav next"
              onClick={() => setCarouselIndex(i => (i + 1) % displayFaculty.length)}
              aria-label="Next teacher"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              itemListElement: displayFaculty.map((f, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                item: {
                  '@type': 'Person',
                  name: `${titleLabel(f.title)} ${f.displayName}`.trim(),
                  jobTitle: f.role,
                  worksFor: {
                    '@type': 'EducationalOrganization',
                    name: 'Brilliant Minds Tutorials',
                  },
                  url: `/faculty/${f.slug}`,
                },
              })),
            }),
          }}
        />
      </div>
    </main>
  );
}

function getColorFromName(name: string) {
  const colors = ['#0B2A5B', '#1E6BFF', '#F5B82E', '#4A5873', '#D43A3A', '#2E8B57', '#8B4513', '#4B0082'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}