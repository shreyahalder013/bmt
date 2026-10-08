'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FacultyForm } from './FacultyFormClient';

export default function FacultyEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isNew = id === 'new';

  return <FacultyForm facultyId={id} isNew={isNew} onSave={() => router.push('/admin/faculty')} />;
}