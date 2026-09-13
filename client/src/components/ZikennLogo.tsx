import React from 'react';
import { BrandLogo, BrandLogoProps } from './BrandLogo';

export interface ZikennLogoProps extends BrandLogoProps {
  variant?: 'full' | 'icon' | 'horizontal';
}

/**
 * ZikennLogo wrapper pointing to the single source of truth: BrandLogo.
 * Uses the exact permanent image asset without redesign or approximation.
 */
export const ZikennLogo: React.FC<ZikennLogoProps> = ({
  className = '',
  variant = 'icon',
  size,
  alt = 'Zikenn AI Brand Logo',
  ...props
}) => {
  if (variant === 'horizontal') {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <BrandLogo size={size || 28} alt={alt} {...props} />
        <span className="font-extrabold tracking-widest uppercase font-serif text-black dark:text-white transition-colors duration-200">
          ZIKENN <span className="text-indigo-600 dark:text-cyan-400 font-sans font-bold text-xs tracking-normal ml-0.5">AI</span>
        </span>
      </div>
    );
  }

  // Both 'full' and 'icon' variants use the exact brand logo image
  return <BrandLogo size={size} className={className} alt={alt} {...props} />;
};

/**
 * ZikennEmblem wrapper pointing directly to BrandLogo.
 */
export const ZikennEmblem: React.FC<BrandLogoProps> = (props) => {
  return <BrandLogo {...props} />;
};

export { BrandLogo };
export default BrandLogo;
