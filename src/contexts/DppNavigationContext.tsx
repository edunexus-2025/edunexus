
'use client';

import React, { createContext, useState, useContext, ReactNode, Dispatch, SetStateAction, useEffect } from 'react';

interface DppNavigationContextType {
  backToLessonUrl: string | null;
  setBackToLessonUrl: Dispatch<SetStateAction<string | null>>;
  providerMounted: boolean; // For debugging
}

const DppNavigationContext = createContext<DppNavigationContextType | undefined>(undefined);

export const DppNavigationProvider = ({ children }: { children: ReactNode }) => {
  const [backToLessonUrl, setBackToLessonUrl] = useState<string | null>(null);
  const [providerMounted, setProviderMounted] = useState(false);

  useEffect(() => {
    setProviderMounted(true);
    console.log("DppNavigationProvider: Mounted. Initial backToLessonUrl:", backToLessonUrl);
    return () => {
      console.log("DppNavigationProvider: Unmounted.");
      setProviderMounted(false);
    };
  }, [backToLessonUrl]); // Log when backToLessonUrl changes too

  const value = { backToLessonUrl, setBackToLessonUrl, providerMounted };

  return (
    <DppNavigationContext.Provider value={value}>
      {children}
    </DppNavigationContext.Provider>
  );
};

export const useDppNavigation = () => {
  const context = useContext(DppNavigationContext);
  if (context === undefined) {
    console.error("useDppNavigation error: Hook called outside of DppNavigationProvider. This is a critical error.");
    throw new Error('useDppNavigation must be used within a DppNavigationProvider');
  }
  // console.log("useDppNavigation: Hook called successfully, context providerMounted:", context.providerMounted, "URL:", context.backToLessonUrl);
  return context;
};
