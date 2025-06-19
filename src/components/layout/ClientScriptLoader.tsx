
'use client';

import { useEffect } from 'react';

export function ClientScriptLoader() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.head.appendChild(script);

    // Optional: Cleanup script on component unmount
    // return () => {
    //   document.head.removeChild(script);
    // };
  }, []);

  return null; // This component doesn't render anything itself
}
