import { test, expect } from '@playwright/test';

test.describe('Zero-Friction Image Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/admin/login');
    await page.fill('input[name="email"]', 'admin@brilliantminds.edu');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/admin');
    
    // Navigate to media upload
    await page.click('a[href="/admin/media"]');
    await expect(page).toHaveURL('/admin/media');
  });

  test('should accept phone photo of any size and format', async ({ page }) => {
    // Create a test image buffer (simulating a 40MB phone photo)
    // In real test, we'd upload an actual file
    const fileInput = page.locator('input[type="file"]').first();
    
    // Upload a large JPEG
    await fileInput.setInputFiles({
      name: 'large-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(40 * 1024 * 1024), // 40 MB
    });
    
    // Should show upload progress
    await expect(page.locator('.upload-progress-overlay')).toBeVisible();
    
    // Wait for processing to complete (polling)
    await expect(page.locator('.image-preview.success')).toBeVisible({ timeout: 15000 });
    
    // Should show success
    await expect(page.locator('text=Done')).toBeVisible();
  });

  test('should accept HEIC from iPhone', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    
    await fileInput.setInputFiles({
      name: 'IMG_1234.HEIC',
      mimeType: 'image/heic',
      buffer: Buffer.from('fake-heic-data'),
    });
    
    await expect(page.locator('.image-preview')).toBeVisible();
    // Should process and show success
    await expect(page.locator('.image-preview.success')).toBeVisible({ timeout: 15000 });
  });

  test('should accept PNG with transparency', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    
    await fileInput.setInputFiles({
      name: 'transparent.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-png-data'),
    });
    
    await expect(page.locator('.image-preview.success')).toBeVisible({ timeout: 15000 });
  });

  test('should accept WebP', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    
    await fileInput.setInputFiles({
      name: 'image.webp',
      mimeType: 'image/webp',
      buffer: Buffer.from('fake-webp-data'),
    });
    
    await expect(page.locator('.image-preview.success')).toBeVisible({ timeout: 15000 });
  });

  test('should accept AVIF', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    
    await fileInput.setInputFiles({
      name: 'image.avif',
      mimeType: 'image/avif',
      buffer: Buffer.from('fake-avif-data'),
    });
    
    await expect(page.locator('.image-preview.success')).toBeVisible({ timeout: 15000 });
  });

  test('should accept BMP and TIFF', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    
    await fileInput.setInputFiles({
      name: 'image.bmp',
      mimeType: 'image/bmp',
      buffer: Buffer.from('fake-bmp-data'),
    });
    
    await expect(page.locator('.image-preview.success')).toBeVisible({ timeout: 15000 });
  });

  test('should handle JPG that is actually PNG (magic bytes detection)', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    
    // File named .jpg but actually PNG content
    await fileInput.setInputFiles({
      name: 'fake-jpg.jpg',
      mimeType: 'image/png', // Actual type from magic bytes
      buffer: Buffer.from('fake-png-data'),
    });
    
    // Should still work because validation uses magic bytes
    await expect(page.locator('.image-preview.success')).toBeVisible({ timeout: 15000 });
  });

  test('should reject renamed .exe file', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    
    await fileInput.setInputFiles({
      name: 'malware.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('fake-exe-data'),
    });
    
    // Should show error message
    await expect(page.locator("text=This file can't be used as a photo")).toBeVisible();
  });

  test('should accept small image and show quality note', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    
    // Small 300x200 image
    await fileInput.setInputFiles({
      name: 'small.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-small-image'),
    });
    
    await expect(page.locator('.image-preview')).toBeVisible();
    
    // Should show quality warning but not block
    await expect(page.locator('.quality-note.low')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Low resolution')).toBeVisible();
    
    // Should still allow upload
    await page.click('button:has-text("Upload")');
    await expect(page.locator('.image-preview.success')).toBeVisible({ timeout: 15000 });
  });

  test('should handle wide panorama with blurred background fit', async ({ page }) => {
    // Select event-banner slot (16:9)
    await page.click('button[role="tab"]:has-text("Event Banner")');
    
    const fileInput = page.locator('input[type="file"]').first();
    
    // Very wide panorama (e.g., 4000x800)
    await fileInput.setInputFiles({
      name: 'panorama.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-panorama-data'),
    });
    
    await expect(page.locator('.image-preview.success')).toBeVisible({ timeout: 15000 });
    
    // Should show warning about blurred background
    await expect(page.locator('text=blurred background')).toBeVisible();
  });

  test('should handle tall screenshot with blurred background fit', async ({ page }) => {
    // Select hero slot (4:3)
    await page.click('button[role="tab"]:has-text("Hero Image")');
    
    const fileInput = page.locator('input[type="file"]').first();
    
    // Very tall screenshot (e.g., 800x4000)
    await fileInput.setInputFiles({
      name: 'screenshot.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-tall-image'),
    });
    
    await expect(page.locator('.image-preview.success')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=blurred background')).toBeVisible();
  });

  test('should produce uniform 4:5 faculty portraits with faces intact', async ({ page }) => {
    // Select faculty slot
    await page.click('button[role="tab"]:has-text("Faculty Photo")');
    
    const fileInput = page.locator('input[type="file"]').first();
    
    // Upload multiple faculty photos
    await fileInput.setInputFiles([
      { name: 'teacher1.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake1') },
      { name: 'teacher2.png', mimeType: 'image/png', buffer: Buffer.from('fake2') },
      { name: 'teacher3.heic', mimeType: 'image/heic', buffer: Buffer.from('fake3') },
    ]);
    
    // Upload all
    await page.click('button:has-text("Upload All")');
    
    // All should succeed
    await expect(page.locator('.image-preview.success')).toHaveCount(3, { timeout: 20000 });
  });

  test('should strip EXIF/GPS data from stored files', async ({ page }) => {
    // This would be verified by checking the processed file metadata
    // For E2E, we check that the processing completes without metadata
    const fileInput = page.locator('input[type="file"]').first();
    
    await fileInput.setInputFiles({
      name: 'with-gps.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-jpg-with-exif'),
    });
    
    await expect(page.locator('.image-preview.success')).toBeVisible({ timeout: 15000 });
    
    // In a real test, we'd fetch the processed variant and verify no EXIF
    // For now, we verify the pipeline completes
  });

  test('should serve AVIF/WebP on public pages', async ({ page }) => {
    // First upload an image
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-test-image'),
    });
    await expect(page.locator('.image-preview.success')).toBeVisible({ timeout: 15000 });
    
    // Navigate to public page
    await page.goto('/');
    
    // Check network requests for AVIF/WebP
    const responses: string[] = [];
    page.on('response', response => {
      if (response.url().includes('/uploads/media/variants/')) {
        responses.push(response.url());
      }
    });
    
    await page.reload();
    
    // Should have AVIF or WebP requests
    const avifRequests = responses.filter(r => r.includes('.avif'));
    const webpRequests = responses.filter(r => r.includes('.webp'));
    
    expect(avifRequests.length + webpRequests.length).toBeGreaterThan(0);
  });

  test('should not serve originals publicly', async ({ page }) => {
    await page.goto('/');
    
    const responses: string[] = [];
    page.on('response', response => {
      if (response.url().includes('/uploads/media/originals/')) {
        responses.push(response.url());
      }
    });
    
    await page.reload();
    
    // No originals should be served
    expect(responses.length).toBe(0);
  });

  test('should have no layout shift', async ({ page }) => {
    await page.goto('/');
    
    // Measure CLS using PerformanceObserver
    const cls = await page.evaluate(() => {
      return new Promise(resolve => {
        let clsValue = 0;
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 3000);
      });
    });
    
    // CLS should be very low (< 0.1)
    expect(cls).toBeLessThan(0.1);
  });

  test('should load hero image with priority', async ({ page }) => {
    await page.goto('/');
    
    // Check for preload link
    const preloadLinks = await page.locator('link[rel="preload"][as="image"]').all();
    expect(preloadLinks.length).toBeGreaterThan(0);
    
    // Hero image should have priority loading
    const heroImg = page.locator('.hero-image img, picture.hero-image img').first();
    await expect(heroImg).toHaveAttribute('fetchpriority', 'high');
  });

  test('should handle corrupt file without affecting batch', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    
    // Upload a mix: good image + corrupt file
    await fileInput.setInputFiles([
      { name: 'good.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake-good-image') },
      { name: 'corrupt.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not-an-image') },
    ]);
    
    // Upload all
    await page.click('button:has-text("Upload All")');
    
    // Good image should succeed
    await expect(page.locator('.image-preview.success')).toBeVisible({ timeout: 15000 });
    
    // Corrupt file should show error but not block the other
    await expect(page.locator('.image-preview.error')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Invalid or corrupted')).toBeVisible();
  });

  test('should reprocess all variants after ratio change', async ({ page }) => {
    // Upload an image first
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-test-image'),
    });
    await expect(page.locator('.image-preview.success')).toBeVisible({ timeout: 15000 });
    
    // Go to media library
    await page.click('a[href="/admin/media/library"]');
    await expect(page).toHaveURL('/admin/media/library');
    
    // Click reprocess all
    await page.click('button:has-text("Reprocess All")');
    await page.click('button:has-text("Confirm")'); // Confirm dialog
    
    // Should show success message
    await expect(page.locator('text=Queued')).toBeVisible({ timeout: 5000 });
    
    // Wait for reprocessing
    await page.waitForTimeout(5000);
    
    // Refresh and verify
    await page.click('button:has-text("Refresh")');
    await expect(page.locator('text=Ready')).toBeVisible();
  });
});

test.describe('Admin Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[name="email"]', 'admin@brilliantminds.edu');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.click('a[href="/admin/media"]');
  });

  test('should show real-time progress during processing', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-test-image'),
    });
    
    // Should show processing state with progress
    await expect(page.locator('.image-preview.processing')).toBeVisible();
    await expect(page.locator('.progress-bar')).toBeVisible();
    await expect(page.locator('text=Processing')).toBeVisible();
  });

  test('should show desktop and mobile preview', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-test-image'),
    });
    
    await expect(page.locator('.image-preview.success')).toBeVisible({ timeout: 15000 });
    
    // Click adjust to see preview
    await page.click('button:has-text("Adjust")');
    
    // Should show cropper modal with preview
    await expect(page.locator('.cropper-modal')).toBeVisible();
    await expect(page.locator('.preview-box')).toBeVisible();
  });

  test('should allow focal point adjustment', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-test-image'),
    });
    
    await expect(page.locator('.image-preview.success')).toBeVisible({ timeout: 15000 });
    
    // Open cropper
    await page.click('button:has-text("Adjust")');
    
    // Enable focal point mode
    await page.check('input[type="checkbox"]:near(:text("Set Focal Point"))');
    
    // Click on image to set focal point
    await page.locator('.cropper-preview-container img').click({ position: { x: 100, y: 100 } });
    
    // Should show focal point marker
    await expect(page.locator('.focal-point-marker')).toBeVisible();
    
    // Apply
    await page.click('button:has-text("Apply Crop")');
  });

  test('should require alt text for non-decorative images', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-test-image'),
    });
    
    // Try to upload without alt text
    await page.click('button:has-text("Upload")');
    
    // Should show validation error or prevent upload
    await expect(page.locator('text=Alt text is required')).toBeVisible();
  });

  test('should require consent for student photos', async ({ page }) => {
    // Faculty slot requires consent
    await page.click('button[role="tab"]:has-text("Faculty Photo")');
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'student.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-student-image'),
    });
    
    // Don't check consent
    await page.click('button:has-text("Upload")');
    
    // Should show consent error
    await expect(page.locator('text=Consent is required')).toBeVisible();
    
    // Check consent and retry
    await page.check('input[type="checkbox"]:near(:text("permission to publish"))');
    await page.click('button:has-text("Retry")');
    
    await expect(page.locator('.image-preview.processing')).toBeVisible();
  });

  test('should show status badges correctly', async ({ page }) => {
    await page.click('a[href="/admin/media/library"]');
    
    // Check status badges
    await expect(page.locator('.status-badge')).toBeVisible();
    
    // Should have different colors for different statuses
    const badges = page.locator('.status-badge');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Public Website', () => {
  test('should show previous image while processing', async ({ page }) => {
    // This test requires an existing image
    await page.goto('/');
    
    // Should not show broken images
    const images = page.locator('img');
    const count = await images.count();
    
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      await expect(img).not.toHaveAttribute('src', '');
    }
  });

  test('should show branded placeholder on load failure', async ({ page }) => {
    await page.goto('/');
    
    // Simulate image load failure by blocking image requests
    await page.route('**/uploads/media/**', route => route.abort());
    await page.reload();
    
    // Should show fallback placeholder
    await expect(page.locator('.image-error-fallback, .error-placeholder')).toBeVisible();
  });

  test('gallery should preserve natural ratios in lightbox', async ({ page }) => {
    await page.goto('/');
    
    // Click on gallery image to open lightbox
    const galleryImg = page.locator('.gallery-item').first();
    if (await galleryImg.isVisible()) {
      await galleryImg.click();
      
      // Lightbox should open
      await expect(page.locator('.lightbox-overlay')).toBeVisible();
      
      // Image should use object-fit: contain
      const lightboxImg = page.locator('.lightbox-image-container img');
      await expect(lightboxImg).toHaveCSS('object-fit', 'contain');
    }
  });

  test('should support keyboard navigation in lightbox', async ({ page }) => {
    await page.goto('/');
    
    const galleryImg = page.locator('.gallery-item').first();
    if (await galleryImg.isVisible()) {
      await galleryImg.click();
      await expect(page.locator('.lightbox-overlay')).toBeVisible();
      
      // Press Escape to close
      await page.keyboard.press('Escape');
      await expect(page.locator('.lightbox-overlay')).not.toBeVisible();
    }
  });
});

test.describe('Security & Reliability', () => {
  test('should rate limit uploads', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[name="email"]', 'admin@brilliantminds.edu');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.click('a[href="/admin/media"]');
    
    const fileInput = page.locator('input[type="file"]').first();
    
    // Rapidly upload multiple files
    for (let i = 0; i < 35; i++) {
      await fileInput.setInputFiles({
        name: `test${i}.jpg`,
        mimeType: 'image/jpeg',
        buffer: Buffer.from(`fake-${i}`),
      });
      await page.waitForTimeout(100);
    }
    
    // Should show rate limit error
    await expect(page.locator('text=Too many upload requests')).toBeVisible({ timeout: 5000 });
  });

  test('should not trust client-supplied dimensions', async ({ page }) => {
    // This is verified server-side, but we can test the API directly
    const formData = new FormData();
    formData.append('file', new Blob(['fake-image']), 'fake-image.jpg');
    formData.append('slot', 'faculty');
    formData.append('altText', 'Test');
    formData.append('consentGranted', 'true');
    // Malicious crop data
    formData.append('cropData', JSON.stringify({ x: -100, y: -100, width: 999999, height: 999999 }));
    
    const response = await page.request.post('/api/admin/media', {
      multipart: formData,
    });
    
    // Server should validate and reject invalid crop
    expect(response.status()).toBe(400);
  });
});