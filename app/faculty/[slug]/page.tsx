import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { FacultyStatus } from '@prisma/client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface FacultyData {
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
  achievements: Array<{ text: string; year?: number }> | null;
  subjects: string[];
  classLevels: string[];
  socialLinks: { linkedin?: string; youtube?: string; instagram?: string } | null;
  publicFields: { email: boolean; phone: boolean } | null;
  contactEmail: string | null;
  contactPhone: string | null;
  photoAssetId: string | null;
  photoAlt: string | null;
  featured: boolean;
  order: number;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  
  const faculty = await db.faculty.findUnique({
    where: { slug, status: FacultyStatus.PUBLISHED, deletedAt: null },
    select: {
      id: true,
      slug: true,
      displayName: true,
      fullName: true,
      title: true,
      role: true,
      shortBio: true,
      fullBio: true,
      qualifications: true,
      experienceYears: true,
      languages: true,
      specialities: true,
      achievements: true,
      subjects: true,
      classLevels: true,
      socialLinks: true,
      publicFields: true,
      contactEmail: true,
      contactPhone: true,
      photoAssetId: true,
      photoAlt: true,
      featured: true,
      order: true,
    },
  });

  if (!faculty) {
    return {
      title: 'Teacher Not Found | Brilliant Minds Tutorials',
    };
  }

  const titleLabel = {
    MR: 'Mr.', MS: 'Ms.', MRS: 'Mrs.', DR: 'Dr.', SIR: 'Sir', MADAM: 'Madam', NONE: '',
  }[faculty.title] || '';

  const fullName = `${titleLabel} ${faculty.displayName}`.trim();

  // Create a minimal faculty object for schema generation
  const facultyForSchema = {
    ...faculty,
    subjects: faculty.subjects || [],
    classLevels: faculty.classLevels || [],
    specialities: faculty.specialities || [],
    achievements: (faculty.achievements as Array<{ text: string; year?: number }>) || [],
    socialLinks: (faculty.socialLinks as { linkedin?: string; youtube?: string; instagram?: string }) || null,
    publicFields: (faculty.publicFields as { email: boolean; phone: boolean }) || null,
    contactEmail: faculty.contactEmail,
    contactPhone: faculty.contactPhone,
    photoAssetId: faculty.photoAssetId,
    photoAlt: faculty.photoAlt,
  };

  return {
    title: `${fullName} - ${faculty.role} | Brilliant Minds Tutorials`,
    description: faculty.shortBio || `Meet ${fullName}, ${faculty.role} at Brilliant Minds Tutorials.`,
    openGraph: {
      title: `${fullName} - ${faculty.role}`,
      description: faculty.shortBio || `Meet ${fullName}, ${faculty.role} at Brilliant Minds Tutorials.`,
      type: 'profile',
      images: faculty.photoAssetId ? [`/api/media/asset/${faculty.photoAssetId}?w=1200&h=630`] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${fullName} - ${faculty.role}`,
      description: faculty.shortBio || `Meet ${fullName}, ${faculty.role} at Brilliant Minds Tutorials.`,
      images: faculty.photoAssetId ? [`/api/media/asset/${faculty.photoAssetId}?w=1200&h=630`] : [],
    },
    other: {
      'json-ld': JSON.stringify(generatePersonSchema(facultyForSchema, fullName)),
    },
  };
}

function generatePersonSchema(faculty: FacultyData, fullName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: fullName,
    jobTitle: faculty.role,
    worksFor: {
      '@type': 'EducationalOrganization',
      name: 'Brilliant Minds Tutorials',
    },
    knowsAbout: faculty.subjects,
    description: faculty.shortBio,
    alumniOf: [],
    award: faculty.achievements?.map(a => a.text).filter(Boolean) || [],
    ...(faculty.socialLinks?.linkedin && { sameAs: [faculty.socialLinks.linkedin] }),
    ...(faculty.socialLinks?.youtube && { sameAs: [...(faculty.socialLinks.linkedin ? [faculty.socialLinks.linkedin] : []), faculty.socialLinks.youtube] }),
    ...(faculty.socialLinks?.instagram && { sameAs: [...(faculty.socialLinks.linkedin ? [faculty.socialLinks.linkedin] : []), ...(faculty.socialLinks.youtube ? [faculty.socialLinks.youtube] : []), faculty.socialLinks.instagram] }),
    ...(faculty.publicFields?.email && faculty.contactEmail && { email: faculty.contactEmail }),
    ...(faculty.publicFields?.phone && faculty.contactPhone && { telephone: faculty.contactPhone }),
  };
}

function getColorFromName(name: string) {
  const colors = ['#0B2A5B', '#1E6BFF', '#F5B82E', '#4A5873', '#D43A3A', '#2E8B57', '#8B4513', '#4B0082'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default async function FacultyProfilePage({ params }: PageProps) {
  const { slug } = await params;

  const faculty = await db.faculty.findUnique({
    where: { slug, status: FacultyStatus.PUBLISHED, deletedAt: null },
    include: {
      batches: { include: { batch: { select: { id: true, name: true, className: true } } } },
    },
  });

  if (!faculty) {
    notFound();
  }

  // Cast JSON fields properly
  const facultyData = faculty as FacultyData & {
    batches: Array<{ batch: { id: string; name: string; className: string } }>;
    socialLinks: FacultyData['socialLinks'];
    publicFields: FacultyData['publicFields'];
    achievements: FacultyData['achievements'];
  };

  const titleLabel = {
    MR: 'Mr.', MS: 'Ms.', MRS: 'Mrs.', DR: 'Dr.', SIR: 'Sir', MADAM: 'Madam', NONE: '',
  }[facultyData.title] || '';

  const fullName = `${titleLabel} ${facultyData.displayName}`.trim();

  const photoUrl = facultyData.photoAssetId ? `/api/media/asset/${facultyData.photoAssetId}?w=400&h=500` : null;
  const initials = facultyData.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const color = getColorFromName(facultyData.displayName);

  return (
    <main className="faculty-profile-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generatePersonSchema(facultyData, fullName)) }}
      />
      <section className="faculty-hero">
        <div className="wrap">
          <div className="faculty-hero-grid">
            <div className="faculty-photo">
              {photoUrl ? (
                <img src={photoUrl} alt={facultyData.photoAlt || facultyData.displayName} />
              ) : (
                <div className="avatar-placeholder large" style={{ backgroundColor: color }}>
                  {initials}
                </div>
              )}
            </div>
            <div className="faculty-info">
              <h1>{fullName}</h1>
              <p className="faculty-role">{facultyData.role}</p>
              <div className="faculty-meta">
                {facultyData.subjects.map(s => <span key={s} className="subject-tag">{s}</span>)}
                {facultyData.classLevels.map(c => <span key={c} className="class-tag">{c}</span>)}
              </div>
              {facultyData.shortBio && <p className="faculty-short-bio">{facultyData.shortBio}</p>}
              <div className="faculty-links">
                {(facultyData.publicFields?.email && facultyData.contactEmail) && (
                  <a href={`mailto:${facultyData.contactEmail}`} className="link-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2-2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    Email
                  </a>
                )}
                {(facultyData.publicFields?.phone && facultyData.contactPhone) && (
                  <a href={`tel:${facultyData.contactPhone}`} className="link-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    Call
                  </a>
                )}
                {facultyData.socialLinks?.linkedin && (
                  <a href={facultyData.socialLinks.linkedin} target="_blank" rel="noopener" className="link-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    LinkedIn
                  </a>
                )}
                {facultyData.socialLinks?.youtube && (
                  <a href={facultyData.socialLinks.youtube} target="_blank" rel="noopener" className="link-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    YouTube
                  </a>
                )}
                {facultyData.socialLinks?.instagram && (
                  <a href={facultyData.socialLinks.instagram} target="_blank" rel="noopener" className="link-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                    Instagram
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="faculty-details">
        <div className="wrap">
          <div className="faculty-details-grid">
            <div className="faculty-main">
              {facultyData.fullBio && (
                <div className="detail-section">
                  <h2>About</h2>
                  <div className="faculty-full-bio">{facultyData.fullBio}</div>
                </div>
              )}

              {(facultyData.qualifications || facultyData.experienceYears || facultyData.languages) && (
                <div className="detail-section">
                  <h2>Qualifications & Experience</h2>
                  <div className="detail-grid">
                    {facultyData.qualifications && (
                      <div className="detail-item">
                        <h3>Qualifications</h3>
                        <p>{facultyData.qualifications}</p>
                      </div>
                    )}
                    {facultyData.experienceYears && (
                      <div className="detail-item">
                        <h3>Years of Experience</h3>
                        <p>{facultyData.experienceYears} years</p>
                      </div>
                    )}
                    {facultyData.languages && (
                      <div className="detail-item">
                        <h3>Languages Spoken</h3>
                        <p>{facultyData.languages}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {facultyData.specialities.length > 0 && (
                <div className="detail-section">
                  <h2>Teaching Specialities</h2>
                  <div className="specialities-tags">
                    {facultyData.specialities.map(s => <span key={s} className="speciality-tag">{s}</span>)}
                  </div>
                </div>
              )}

              {facultyData.achievements && facultyData.achievements.length > 0 && (
                <div className="detail-section">
                  <h2>Achievements</h2>
                  <ul className="achievements-list">
                    {facultyData.achievements.map((a, i) => (
                      <li key={i}>
                        <span className="achievement-text">{a.text}</span>
                        {a.year && <span className="achievement-year">{a.year}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {facultyData.batches.length > 0 && (
                <div className="detail-section">
                  <h2>Current Batches</h2>
                  <ul className="batches-list">
                    {facultyData.batches.map(b => (
                      <li key={b.batch.id}>
                        {b.batch.name} ({b.batch.className})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <aside className="faculty-sidebar">
              <div className="sidebar-card">
                <h3>Subjects</h3>
                <ul className="subject-list">
                  {facultyData.subjects.map(s => <li key={s}>{s}</li>)}
                </ul>
              </div>
              <div className="sidebar-card">
                <h3>Classes</h3>
                <ul className="class-list">
                  {facultyData.classLevels.map(c => <li key={c}>{c}</li>)}
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generatePersonSchema(facultyData, fullName)) }}
      />
    </main>
  );
}
