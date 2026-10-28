import React, { useState, useEffect } from 'react';
import {
  getUserInitials,
  isDummyMockAvatar,
  isAvatarMatchingUserEmailDomain,
  getInitialsColorClass,
} from '../utils/userUtils';

export interface UserAvatarProps {
  avatarUrl?: string | null;
  name?: string | null;
  userEmail?: string | null;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showInitialsOnEmpty?: boolean;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  name,
  userEmail,
  className = '',
  size = 'md',
}) => {
  const [imageError, setImageError] = useState(false);

  // Reset image error status when avatar URL updates
  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  const isValidAvatar = Boolean(
    avatarUrl &&
      isAvatarMatchingUserEmailDomain(avatarUrl, userEmail) &&
      !isDummyMockAvatar(avatarUrl, userEmail)
  );
  const showImage = Boolean(isValidAvatar && !imageError);
  const initials = getUserInitials(name);
  const palette = getInitialsColorClass(name);

  // Base dimension and font sizes if not overridden by custom className
  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-20 h-20 sm:w-24 sm:h-24 text-2xl',
  }[size];

  // Check if className already defines dimensions (e.g. w- or h-)
  const hasCustomDimensions = /\b[wh]-/.test(className);
  const dimensionClass = hasCustomDimensions ? '' : sizeClasses;

  if (showImage && avatarUrl) {
    return (
      <div
        className={`relative rounded-full overflow-hidden shrink-0 select-none flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${dimensionClass} ${className}`}
      >
        <img
          src={avatarUrl}
          alt={name || 'User avatar'}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-full overflow-hidden shrink-0 select-none flex items-center justify-center font-bold tracking-tight shadow-2xs border ${palette.bg} ${palette.text} ${palette.border} ${dimensionClass} ${className}`}
      title={name || 'User Profile'}
    >
      <span className="leading-none">{initials}</span>
    </div>
  );
};
