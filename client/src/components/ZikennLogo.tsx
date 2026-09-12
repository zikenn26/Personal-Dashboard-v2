import React from 'react';

interface ZikennLogoProps {
  className?: string;
  variant?: 'full' | 'icon' | 'horizontal';
  size?: number;
}

export const ZikennLogo: React.FC<ZikennLogoProps> = ({
  className = '',
  variant = 'icon',
  size,
}) => {
  // Unique gradient IDs to prevent conflicts
  const gradId = 'zikenn-gradient-glow';
  const textArcId = 'zikenn-text-arc-path';

  if (variant === 'horizontal') {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <ZikennEmblem size={size || 28} />
        <span className="font-extrabold tracking-widest uppercase font-serif text-black dark:text-white transition-colors duration-200">
          ZIKENN <span className="text-indigo-600 dark:text-cyan-400 font-sans font-bold text-xs tracking-normal ml-0.5">AI</span>
        </span>
      </div>
    );
  }

  if (variant === 'full') {
    const width = size || 160;
    const height = (width * 200) / 180;

    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 200 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none ${className}`}
      >
        <defs>
          {/* Cyan to Purple Vertical Gradient matching user's photo */}
          <linearGradient id={gradId} x1="100" y1="65" x2="100" y2="205" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#9333EA" />
            <stop offset="25%" stopColor="#818CF8" />
            <stop offset="65%" stopColor="#0EA5E9" />
            <stop offset="100%" stopColor="#00F2FE" />
          </linearGradient>

          {/* Arched path for the text "ZIKENN" */}
          <path
            id={textArcId}
            d="M 22 76 Q 100 12 178 76"
            fill="none"
          />

          {/* Filter for subtle glow */}
          <filter id="zikenn-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#00F2FE" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Arched Text: "ZIKENN"
            At time of light theme: black color
            At time of dark theme: white color
        */}
        <text
          className="fill-black dark:fill-white font-serif font-black tracking-[0.22em] text-[27px] transition-colors duration-200"
          style={{
            fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif",
            textAnchor: 'middle',
            letterSpacing: '0.2em',
          }}
        >
          <textPath
            href={`#${textArcId}`}
            startOffset="50%"
            textAnchor="middle"
          >
            ZIKENN
          </textPath>
        </text>

        {/* Secondary inline stroke for the chiseled double-line effect in the user's photo */}
        <text
          className="stroke-black dark:stroke-white fill-none font-serif font-black tracking-[0.22em] text-[27px] transition-colors duration-200 opacity-40"
          style={{
            fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif",
            textAnchor: 'middle',
            letterSpacing: '0.2em',
            strokeWidth: '0.8',
          }}
          aria-hidden="true"
        >
          <textPath
            href={`#${textArcId}`}
            startOffset="50%"
            textAnchor="middle"
          >
            ZIKENN
          </textPath>
        </text>

        {/* Emblem Group: Centered at (100, 142) */}
        <g transform="translate(100, 142)">
          <ZikennEmblemGraphic gradId={gradId} />
        </g>
      </svg>
    );
  }

  // Default: icon variant
  return <ZikennEmblem size={size} className={className} />;
};

/**
 * Isolated Emblem Graphic with precise 4-fold curved swirl petals
 * and cyan-to-purple vibrant gradient.
 */
export const ZikennEmblem: React.FC<{ size?: number | string; className?: string }> = ({
  size = 24,
  className = '',
}) => {
  const gradId = 'zikenn-emblem-grad';
  const dimension = typeof size === 'number' ? `${size}px` : size;

  return (
    <svg
      style={{ width: dimension, height: dimension }}
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
    >
      <defs>
        <linearGradient id={gradId} x1="70" y1="10" x2="70" y2="130" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9333EA" />
          <stop offset="25%" stopColor="#818CF8" />
          <stop offset="65%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#00F2FE" />
        </linearGradient>
      </defs>

      <g transform="translate(70, 70)">
        <ZikennEmblemGraphic gradId={gradId} />
      </g>
    </svg>
  );
};

/**
 * The vector geometry of the Zikenn vortex swirl emblem:
 * 4 rounded outer lobes with interlocking curved blades cut into
 * an inner 4-point pinwheel aperture.
 */
const ZikennEmblemGraphic: React.FC<{ gradId: string }> = ({ gradId }) => {
  return (
    <g>
      {/* Outer gradient base: rounded 4-lobe squircle shield */}
      <path
        d="M 0 -52 C 26 -52 46 -46 48 -22 C 50 2 46 22 46 48 C 22 46 2 50 -22 48 C -46 46 -52 26 -52 0 C -52 -26 -46 -46 -22 -48 C -2 -50 0 -52 0 -52 Z"
        fill={`url(#${gradId})`}
      />

      {/* 4 Dynamic Swirling Blades (Rotational symmetry at 0, 90, 180, 270 deg) */}
      {[0, 90, 180, 270].map((rot) => (
        <g key={rot} transform={`rotate(${rot})`}>
          {/* Dark geometric swirl cut channel */}
          <path
            d="M -3 -49 C 18 -46 36 -32 40 -10 C 32 -18 16 -24 -2 -22 C -18 -20 -30 -8 -22 10 C -20 14 -16 18 -12 21 C -24 16 -34 4 -36 -10 C -38 -25 -24 -44 -3 -49 Z"
            className="fill-black/90 dark:fill-[#0A0D14]"
          />

          {/* Central vortex aperture knife cut */}
          <path
            d="M 0 0 C 8 2 16 8 18 17 C 12 14 6 12 0 11 C -4 10 -8 7 -6 0 C -4 -1 -2 -1 0 0 Z"
            className="fill-black/90 dark:fill-[#0A0D14]"
          />

          {/* Fine inner ribbon highlight */}
          <path
            d="M 12 -38 C 24 -28 32 -14 34 2 C 28 -6 18 -12 6 -14 C 14 -22 14 -32 12 -38 Z"
            fill={`url(#${gradId})`}
            opacity="0.9"
          />
        </g>
      ))}

      {/* Center 4-point pinwheel star aperture */}
      <path
        d="M 0 -8 C 3 -3 3 -3 8 0 C 3 3 3 3 0 8 C -3 3 -3 3 -8 0 C -3 -3 -3 -3 0 -8 Z"
        className="fill-black dark:fill-[#0A0D14]"
      />
    </g>
  );
};
