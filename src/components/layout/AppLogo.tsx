'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { AppConfig } from '@/lib/constants'; // Import AppConfig

type AppLogoProps = {
  className?: string;
  iconSize?: number;
  mainTextSize?: string;
  taglineTextSize?: string;
};

export function AppLogo({
  className,
  iconSize = 36,
  mainTextSize = 'text-2xl',
  taglineTextSize = 'text-xs'
}: AppLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const logoSrc = mounted && resolvedTheme === 'dark' ? '/2.jpg' : '/1.jpg';
  
  const appNameDisplay = AppConfig.appName; // Use AppConfig for the name
  const appTagline = "The Online Test Platform"; // Define the tagline
  const logoAltText = `${appNameDisplay} Logo`;

  return (
    <Link href="/" className={`flex flex-col items-start ${className}`}>
      <div className="flex items-center gap-2">
        <Image
          src={logoSrc}
          alt={logoAltText}
          width={iconSize}
          height={iconSize}
          className="rounded-sm"
          data-ai-hint="app brand logo"
          priority
        />
        <span className={`${mainTextSize} font-bold text-primary`}>{appNameDisplay}</span>
      </div>
      <span className={`${taglineTextSize} text-muted-foreground pl-${iconSize / 4 + 8} ml-1`}>
        {appTagline} 
      </span>
    </Link>
  );
}
