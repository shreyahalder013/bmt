'use client';
import { useEffect, useState } from 'react';

const fieldConfig: Record<string, { label: string; type: 'text' | 'textarea' | 'date' | 'url' | 'number'; required: boolean }[]> = {
  classes: [
    { label: 'title', type: 'text', required: true },
    { label: 'range', type: 'text', required: true },
    { label: 'description', type: 'textarea', required: true },
    { label: 'details', type: 'textarea', required: true },
  ],
  faculty: [
    { label: 'name', type: 'text', required: true },
    { label: 'subject', type: 'text', required: true },
    { label: 'expertise', type: 'text', required: true },
    { label: 'bio', type: 'textarea', required: true },
    { label: 'photoUrl', type: 'url', required: false },
    { label: 'altText', type: 'text', required: false },
  ],
  results: [
    { label: 'title', type: 'text', required: true },
    { label: 'text', type: 'textarea', required: true },
  ],
  testimonials: [
    { label: 'quote', type: 'textarea', required: true },
    { label: 'author', type: 'text', required: false },
  ],
  gallery: [
    { label: 'imageUrl', type: 'url', required: true },
    { label: 'caption', type: 'text', required: true },
    { label: 'category', type: 'text', required: true },
    { label: 'altText', type: 'text', required: true },
  ],
  announcements: [
    { label: 'title', type: 'text', required: true },
    { label: 'body', type: 'textarea', required: true },
    { label: 'startDate', type: 'date', required: true },
    { label: 'endDate', type: 'date', required: true },
  ],
};

function parseDetails(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
}

export default function ContentEditor({ kind }: { kind: string }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const fields = fieldConfig[kind] ?? [];

  useEffect(() => {
    fetch(`/api/admin/content?kind=${kind}`)
      .then((response) => response.json())
      .then(setItems);
  }, [kind]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const data: Record<string, unknown> = { ...form, order: items.length, published: false };
    if (kind === 'classes' && form.details) {
      data.details = parseDetails(form.details);
    }
    const response = await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, data }),
    });
    if (response.ok) {
      setItems([...items, await response.json()]);
      setForm({});
    }
  }

  async function toggle(item: Record<string, unknown>) {
    const response = await fetch('/api/admin/content', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, id: item.id, data: { published: !item.published } }),
    });
    if (response.ok) {
      setItems(items.map((current) => (current.id === item.id ? { ...current, published: !current.published } : current)));
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this record?')) return;
    const response = await fetch(`/api/admin/content?kind=${kind}&id=${id}`, { method: 'DELETE' });
    if (response.ok) setItems(items.filter((item) => item.id !== id));
  }

  return (
    <>
      <form className="card" onSubmit={save}>
        <h2>Add {kind}</h2>
        {fields.map(({ label, type, required }) => (
          <label key={label}>
            {label}
            {type === 'textarea' ? (
              <textarea
                value={form[label] ?? ''}
                onChange={(event) => setForm({ ...form, [label]: event.target.value })}
                required={required}
              />
            ) : (
              <input
                type={type}
                value={form[label] ?? ''}
                onChange={(event) => setForm({ ...form, [label]: event.target.value })}
                required={required}
              />
            )}
          </label>
        ))}
        <button className="btn b1" type="submit">
          Save unpublished
        </button>
      </form>
      <div className="grid">
        {items.map((item) => (
          <article className="card" key={String(item.id)}>
            <h3>{String(item.title ?? item.name ?? item.quote ?? item.caption ?? item.id)}</h3>
            <p>{item.published ? 'Published' : 'Unpublished'}</p>
            <button className="btn b3" onClick={() => toggle(item)}>
              {item.published ? 'Unpublish' : 'Publish'}
            </button>
            {kind !== 'settings' && (
              <button className="danger" onClick={() => remove(String(item.id))}>
                Delete
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}