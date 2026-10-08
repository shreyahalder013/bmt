import { describe, expect, it } from 'vitest';
import { enquirySchema } from '../lib/validation';
const valid = { studentName: 'Aarav', parentName: 'Parent', class: 'Class IX – X' as const, school: '', phone: '9876543210', email: '', subjects: '', message: '' };
describe('enquirySchema', () => {
  it('accepts a valid Indian mobile number', () => expect(enquirySchema.safeParse(valid).success).toBe(true));
  it('rejects an invalid mobile number', () => expect(enquirySchema.safeParse({ ...valid, phone: '12345' }).success).toBe(false));
  it('rejects an unknown class group', () => expect(enquirySchema.safeParse({ ...valid, class: 'Class 3' }).success).toBe(false));
  it('trims submitted names', () => expect(enquirySchema.parse({ ...valid, studentName: '  Aarav  ' }).studentName).toBe('Aarav'));
});
