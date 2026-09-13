import React, { useState } from 'react';

export interface BrandLogoProps {
  /**
   * Additional CSS classes for styling (e.g., width, height, margin).
   * Note: original aspect ratio is always preserved with object-contain.
   */
  className?: string;
  /**
   * Optional pixel size (e.g., 16, 20, 24, 32, 48, 64).
   * Sets width and height proportionally.
   */
  size?: number | string;
  /**
   * Accessible alt text for the brand logo.
   */
  alt?: string;
  /**
   * Optional click handler if rendered as an interactive button/link.
   */
  onClick?: () => void;
}

/**
 * BrandLogo: Single source of truth for the Zikenn AI brand logo.
 * References the static asset at `/assets/brand-logo.png` (with `/brand-logo.png` fallback).
 * Maintains exact aspect ratio, proportions, and colors without distortion.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size,
  alt = 'Zikenn AI Brand Logo',
  onClick,
}) => {
  const [imgSrc, setImgSrc] = useState<string>('/assets/brand-logo.png');
  const [hasError, setHasError] = useState<boolean>(false);

  const dimensionStyle = size
    ? {
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size,
      }
    : undefined;

  const handleImgError = () => {
    // If /assets/brand-logo.png fails, try /brand-logo.png directly from public folder
    if (imgSrc === '/assets/brand-logo.png') {
      setImgSrc('/brand-logo.png');
    } else {
      setHasError(true);
    }
  };

  if (hasError) {
    const numSize = typeof size === 'number' ? size : 24;
    return (
      <div
        style={dimensionStyle}
        onClick={onClick}
        className={`aspect-square shrink-0 select-none flex items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-indigo-400 text-white font-serif font-black shadow-2xs ${className}`}
        title={alt}
      >
        <span style={{ fontSize: `${Math.max(10, Math.round(numSize * 0.55))}px` }}>Z</span>
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      onError={handleImgError}
      referrerPolicy="no-referrer"
      style={dimensionStyle}
      onClick={onClick}
      className={`aspect-square object-contain shrink-0 select-none ${className}`}
      loading="eager"
    />
  );
};

export default BrandLogo;
