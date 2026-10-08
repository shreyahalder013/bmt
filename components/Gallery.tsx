'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Picture, GalleryLightbox, MediaAsset, MediaVariant } from './Picture';

interface GalleryProps {
  assets: MediaAsset[];
  categories?: string[];
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  className?: string;
}

export function Gallery({ assets, categories = [], selectedCategory, onCategoryChange, className = '' }: GalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filteredAssets, setFilteredAssets] = useState<typeof assets>(assets);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Filter assets by category
  useEffect(() => {
    if (!selectedCategory || selectedCategory === 'all') {
      setFilteredAssets(assets);
    } else {
      setFilteredAssets(assets.filter(a => a.slot === selectedCategory.toUpperCase()));
    }
    setCurrentIndex(0);
  }, [assets, selectedCategory]);

  // Adjust index when filtered assets change
  useEffect(() => {
    if (currentIndex >= filteredAssets.length) {
      setCurrentIndex(Math.max(0, filteredAssets.length - 1));
    }
  }, [filteredAssets, currentIndex]);

  const openLightbox = useCallback((index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const goPrev = useCallback(() => {
    setCurrentIndex(i => (i - 1 + filteredAssets.length) % filteredAssets.length);
  }, [filteredAssets.length]);

  const goNext = useCallback(() => {
    setCurrentIndex(i => (i + 1) % filteredAssets.length);
  }, [filteredAssets.length]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          closeLightbox();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
        case 'ArrowRight':
          goNext();
          break;
        case 'Tab':
          // Focus trapping would go here
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [lightboxOpen, closeLightbox, goPrev, goNext]);

  // Intersection observer for lazy loading (handled by next/image automatically)
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        });
      },
      { rootMargin: '100px', threshold: 0.01 }
    );

    const elements = document.querySelectorAll('.gallery-item');
    elements.forEach(el => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, [filteredAssets.length]);

  const categoryColors: Record<string, string> = {
    GALLERY: '#4A5873',
    FACULTY: '#F5B82E',
    RESULT: '#1E6BFF',
    EVENT_BANNER: '#0B2A5B',
    ABOUT: '#1E6BFF',
    HERO: '#0B2A5B',
  };

  const formatCategory = (cat: string) => cat.replace(/_/g, ' ');

  return (
    <div className={`gallery ${className}`} role="region" aria-label="Image gallery">
      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="gallery-filters" role="group" aria-label="Filter by category">
          <button
            className={`filter-chip ${!selectedCategory || selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => onCategoryChange?.('all')}
            role="tab"
            aria-selected={!selectedCategory || selectedCategory === 'all'}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`filter-chip ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => onCategoryChange?.(cat)}
              role="tab"
              aria-selected={selectedCategory === cat}
              style={{ '--chip-color': categoryColors[cat] || '#4A5873' } as React.CSSProperties}
            >
              {formatCategory(cat)}
            </button>
          ))}
        </div>
      )}

      {/* Masonry Grid */}
      <div className="gallery-grid" role="list" aria-label="Image gallery">
        {filteredAssets.length === 0 ? (
          <div className="gallery-empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8" />
              <path d="M12 17v4" />
            </svg>
            <p>No images in this category</p>
          </div>
        ) : (
          <div className="masonry-grid" role="list">
            {filteredAssets.map((asset, index) => (
              <GalleryItem
                key={asset.id}
                asset={asset}
                index={index}
                onClick={() => openLightbox(index)}
              />
            ))}
          </div>
        )}

        </div>

      {/* Lightbox */}
      {lightboxOpen && filteredAssets.length > 0 && (
        <GalleryLightbox
          assets={filteredAssets}
          currentIndex={currentIndex}
          onClose={closeLightbox}
          onPrev={() => setCurrentIndex(i => (i - 1 + filteredAssets.length) % filteredAssets.length)}
          onNext={() => setCurrentIndex(i => (i + 1) % filteredAssets.length)}
        />
      )}
    </div>
  );
}

// Individual gallery item component
function GalleryItem({ asset, index, onClick }: { asset: any; index: number; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [hovered, setHovered] = useState(false);

  const aspectRatio = asset.originalHeight / asset.originalWidth;
  const style = { aspectRatio: `${1 / aspectRatio}` };

  return (
    <article
      className={`gallery-item ${loaded ? 'loaded' : ''} ${error ? 'error' : ''}`}
      style={style}
      role="listitem"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      aria-label={asset.altText || asset.caption || `Gallery item ${index + 1}`}
    >
      <div className="gallery-item-image" style={{ aspectRatio: asset.originalWidth / asset.originalHeight }}>
        {asset.variants.length > 0 && (
          <Image
            src={asset.variants.find((v: MediaVariant) => v.format === 'avif' && v.width <= 800)?.url ||
                  asset.variants.find((v: MediaVariant) => v.format === 'webp' && v.width <= 800)?.url ||
                  asset.variants[0]?.url}
            alt={asset.isDecorative ? '' : (asset.altText || '')}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            style={{
              objectFit: 'cover',
              objectPosition: asset.focalX !== null && asset.focalY !== null
                ? `${Math.round(asset.focalX * 100)}% ${Math.round(asset.focalY * 100)}%`
                : 'center',
              }}
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
              placeholder="blur"
              blurDataURL={asset.blurDataURL || undefined}
            />
          )}
        {!loaded && asset.blurDataURL && (
          <div
            className="item-blur-placeholder"
            style={{
              backgroundImage: `url("${asset.blurDataURL}")`,
              backgroundColor: asset.dominantColor,
            }}
            aria-hidden="true"
          />
        )}
        {error && (
          <div className="error-placeholder" style={{ backgroundColor: asset.dominantColor || '#888' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
        )}
        <div className="item-overlay">
          <div className="overlay-content">
            {asset.caption && <p className="overlay-caption">{asset.caption}</p>}
            <div className="item-meta">
              <span className="meta-dimensions">{asset.originalWidth}×{asset.originalHeight}</span>
              <span className="meta-size">{formatFileSize(asset.originalSize)}</span>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="item-caption">
        {asset.caption || asset.altText || 'Untitled'}
        <span className="category-tag" style={{ backgroundColor: getCategoryColor(asset.slot) }}>
          {formatCategory(asset.slot)}
        </span>
      </figcaption>
    </article>
  );
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getCategoryColor(slot: string): string {
  const colors: Record<string, string> = {
    GALLERY: '#4A5873',
    FACULTY: '#F5B82E',
    RESULT: '#1E6BFF',
    EVENT_BANNER: '#0B2A5B',
    ABOUT: '#1E6BFF',
    HERO: '#0B2A5B',
  };
  return colors[slot] || '#4A5873';
}

export default Gallery;