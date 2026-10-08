import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Brilliant Minds Tutorials, coaching classes for Class I–XII in Lucknow';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(<div style={{ background: '#F1F6FF', color: '#0B2A5B', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', fontFamily: 'sans-serif' }}><div style={{ fontSize: 30, color: '#1E6BFF', letterSpacing: 6 }}>BRILLIANT MINDS</div><div style={{ fontSize: 72, fontWeight: 800, marginTop: 24 }}>Tutorials</div><div style={{ fontSize: 34, marginTop: 28 }}>Coaching classes for Class I–XII in Lucknow</div><div style={{ fontSize: 25, marginTop: 50, color: '#4A5873' }}>Udaiganj · Husainganj · Lucknow</div></div>, { ...size });
}
