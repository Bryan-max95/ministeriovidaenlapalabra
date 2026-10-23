'use client';

import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface MinistryLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  customLogoDataUrl?: string | null;
  showText?: boolean;
  variant?: 'light' | 'dark';
}

export function MinistryLogo({
  size = 'md',
  customLogoDataUrl,
  showText = false,
  variant = 'light',
}: MinistryLogoProps) {
  const [imgError, setImgError] = useState(false);

  const dimensions = {
    sm: { box: 'w-10 h-10', inner: 'w-8 h-8', icon: 'w-4 h-4', ring: 'border' },
    md: { box: 'w-14 h-14', inner: 'w-11 h-11', icon: 'w-5 h-5', ring: 'border-2' },
    lg: { box: 'w-20 h-20', inner: 'w-16 h-16', icon: 'w-8 h-8', ring: 'border-2' },
    xl: { box: 'w-24 h-24', inner: 'w-20 h-20', icon: 'w-10 h-10', ring: 'border-2' },
  }[size];

  return (
    <div className="inline-flex flex-col items-center select-none">
      {customLogoDataUrl && !imgError ? (
        <div
          className={`${dimensions.box} rounded-full overflow-hidden border-2 border-[#D4AF37] bg-white flex items-center justify-center shadow-sm shrink-0`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={customLogoDataUrl}
            alt="Logotipo Oficial MINISTERIO VIDA EN LA PALABRA"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-contain p-1"
          />
        </div>
      ) : (
        <div
          className={`${dimensions.box} rounded-full bg-[#0B1D3A] border-2 border-[#D4AF37] flex items-center justify-center shadow-sm relative shrink-0`}
          aria-label="Emblema Oficial MINISTERIO VIDA EN LA PALABRA"
        >
          <div
            className={`${dimensions.inner} rounded-full border border-[#D4AF37]/60 bg-gradient-to-b from-[#132C57] to-[#0B1D3A] flex flex-col items-center justify-center`}
          >
            <BookOpen className={`${dimensions.icon} text-[#D4AF37] stroke-[2.2]`} />
            {size !== 'sm' && (
              <span className="text-[7px] font-bold tracking-widest text-white mt-0.5 leading-none">
                VIDA
              </span>
            )}
          </div>
        </div>
      )}

      {showText && (
        <div className="mt-2.5 text-center">
          <p
            className={`font-bold tracking-tight ${
              size === 'lg' || size === 'xl' ? 'text-base' : 'text-xs'
            } ${variant === 'dark' ? 'text-white' : 'text-[#0B1D3A]'}`}
          >
            MINISTERIO VIDA EN LA PALABRA
          </p>
        </div>
      )}
    </div>
  );
}
