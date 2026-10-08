import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  limited: vi.fn(() => false)
}));

vi.mock('../lib/db', () => ({ db: { enquiry: { create: mocks.create } } }));
vi.mock('../lib/rate-limit', () => ({ limited: mocks.limited }));

import { POST } from '../app/api/enquiries/route';

const validPayload = {
  studentName: 'Aarav Sharma',
  parentName: 'Priya Sharma',
  class: 'Class IX – X',
  school: 'Local School',
  phone: '9876543210',
  email: 'parent@example.com',
  subjects: 'Mathematics',
  message: 'Please share the available guidance.'
};

function request(body: unknown, ip = '203.0.113.10') {
  return new Request('http://localhost/api/enquiries', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body)
  });
}

describe('POST /api/enquiries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.limited.mockReturnValue(false);
    mocks.create.mockResolvedValue({ id: 'cm enquiry id' });
    delete process.env.SMTP_HOST;
    delete process.env.OWNER_EMAIL;
  });

  it('stores a valid enquiry and returns a success response', async () => {
    const response = await POST(request(validPayload) as never);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.id).toBe('cm enquiry id');
    expect(body.contactPhone).toBe('087379 14988');
    expect(body.whatsappUrl).toBeUndefined();
    expect(mocks.create).toHaveBeenCalledWith({ data: validPayload });
  });

  it('rejects invalid input without writing to the database', async () => {
    const response = await POST(request({ ...validPayload, phone: '12345' }) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('check');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects honeypot submissions without writing to the database', async () => {
    const response = await POST(request({ ...validPayload, website: 'spam bot' }) as never);

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rate-limits requests before parsing or storing them', async () => {
    mocks.limited.mockReturnValue(true);
    const response = await POST(request(validPayload, '203.0.113.11') as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toContain('Too many enquiries');
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.limited).toHaveBeenCalledWith('203.0.113.11');
  });
});
