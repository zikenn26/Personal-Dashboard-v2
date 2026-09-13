import React from 'react';

export interface BrandLogoProps {
  /**
   * Additional CSS classes for styling (e.g., width, height, margin).
   * Note: original aspect ratio is always preserved with object-contain.
   */
  className?: string;
  /**
   * Optional pixel size (e.g., 20, 24, 32, 48, 64).
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
 * References the permanent static asset at `/assets/brand-logo.png`.
 * Maintains exact aspect ratio, proportions, and colors without distortion.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size,
  alt = 'Zikenn AI Brand Logo',
  onClick,
}) => {
  const dimensionStyle = size
    ? {
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size,
      }
    : undefined;

  return (
    <img
      src="/assets/brand-logo.png"
      alt={alt}
      referrerPolicy="no-referrer"
      style={dimensionStyle}
      onClick={onClick}
      className={`aspect-square object-contain shrink-0 select-none ${className}`}
      loading="eager"
    />
  );
};

export default BrandLogo;
