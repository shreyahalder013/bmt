import { z } from 'zod';
const text = (max: number) => z.string().trim().min(1).max(max);
export const enquirySchema = z.object({
  studentName: text(80), parentName: text(80), class: z.enum(['Class I – V','Class VI – VIII','Class IX – X','Class XI – XII']),
  school: z.string().trim().max(160).default(''), phone: z.string().trim().regex(/^(?:\+91|91)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number.'),
  email: z.union([z.string().trim().email().max(160), z.literal('')]).default(''), subjects: z.string().trim().max(200).default(''), message: z.string().trim().max(1200).default(''), website: z.string().max(0).optional()
});
export type EnquiryInput = z.infer<typeof enquirySchema>;
