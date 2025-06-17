
'use client'; 

import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

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

  // To avoid hydration mismatch for the image src, we default to light mode logo
  // and only switch to dark mode logo *after* the component has mounted on the client.
  const logoSrc = mounted && resolvedTheme === 'dark' ? '/2.jpg' : '/1.jpg';
  
  // Hardcode the app name for display to ensure consistency
  const appNameDisplay = "EduNexus"; 
  const logoAltText = "EduNexus Logo"; 

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
        The Online Test Platform
      </span>
    </Link>
  );
}
