import MediaUploader from '@/components/MediaUploader';
import MediaLibrary from '@/components/MediaLibrary';
import { getAllSlots } from '@/lib/image-slots';
export const dynamic = 'force-dynamic';

export default function MediaPage() {
  const slots = getAllSlots().filter(s => s.category !== 'thumbnail');

  return (
    <main className="admin-page">
      <div className="admin-header">
        <div>
          <p className="eyebrow">Private owner area</p>
          <h1>Media Manager</h1>
          <p>Upload, crop, and manage all images. Every upload is automatically optimized for web delivery.</p>
        </div>
        <a className="btn b2" href="/admin/inbox">Back to enquiries</a>
      </div>

      <div className="admin-guide">
        <strong>Quick Guide:</strong> Choose an image type, upload your photo, adjust the crop/focal point if needed, add alt text, and click Upload. The system automatically creates optimized variants for every screen size.
      </div>

      <div className="media-tabs">
        <button className="tab-btn active" data-tab="upload">Upload Images</button>
        <button className="tab-btn" data-tab="library">Media Library</button>
      </div>

      <div className="tab-panels">
        <div className="tab-panel active" id="upload">
          <MediaUploader />
        </div>
        <div className="tab-panel" id="library">
          <MediaLibrary />
        </div>
      </div>
    </main>
  );
}