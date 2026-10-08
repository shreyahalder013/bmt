'use client';
import { useState } from 'react';

export default function EnquiryForm() {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('loading');
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch('/api/enquiries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      const raw = await response.text();
      let result: { error?: string; contactPhone?: string } = {};
      if (raw) {
        try { result = JSON.parse(raw) as { error?: string; contactPhone?: string }; } catch { throw new Error('The enquiry service returned an unexpected response. Please call 087379 14988 directly.'); }
      }
      if (!response.ok) throw new Error(result.error);
      setState('success');
      setMessage(`Your enquiry was received. Our team will contact you on ${result.contactPhone ?? '087379 14988'}.`);
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please call 087379 14988.');
      setState('error');
    }
  }
  return <>{state === 'success' ? <div className="notice" role="status" tabIndex={-1}>{message}</div> : <form onSubmit={submit} noValidate><div><label htmlFor="studentName">Student name</label><input id="studentName" name="studentName" required maxLength={80} /></div><div><label htmlFor="parentName">Parent/guardian name</label><input id="parentName" name="parentName" required maxLength={80} /></div><div><label htmlFor="class">Class</label><select id="class" name="class" required defaultValue=""><option value="">Select class</option><option>Class I – V</option><option>Class VI – VIII</option><option>Class IX – X</option><option>Class XI – XII</option></select></div><div><label htmlFor="school">School</label><input id="school" name="school" maxLength={160} /></div><div><label htmlFor="phone">Phone number</label><input id="phone" name="phone" type="tel" required pattern="(?:\+91|91)?[6-9]\d{9}" /></div><div><label htmlFor="email">Email (optional)</label><input id="email" name="email" type="email" /></div><div className="full"><label htmlFor="subjects">Subjects requiring support</label><input id="subjects" name="subjects" maxLength={200} /></div><div className="full"><label htmlFor="message">Message</label><textarea id="message" name="message" rows={3} maxLength={1200} /></div><input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }} /><div className="full"><button className="btn b1" type="submit" disabled={state === 'loading'}>{state === 'loading' ? 'Sending…' : 'Submit Enquiry'}</button></div>{state === 'error' && <p className="full" role="alert">{message}</p>}</form>}</>;
}
