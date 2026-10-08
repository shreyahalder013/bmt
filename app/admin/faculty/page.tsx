'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FacultyManager } from './FacultyManagerClient';

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

export default function FacultyPage() {
  return <FacultyManager />;
}