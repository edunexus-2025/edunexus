
import type { NextConfig } from 'next';

// Updated PocketBase URL to be used for image remote patterns
const pocketbaseUrlString = 'https://ae8425c5-5ede-4664-bdaa-b238298ae1be-00-4oi013hd9264.sisko.replit.dev';
const pocketbaseRemotePatterns: Array<import('next/dist/shared/lib/image-config').ImageRemotePattern> = [];

if (pocketbaseUrlString) {
  try {
    const url = new URL(pocketbaseUrlString);
    pocketbaseRemotePatterns.push({
      protocol: url.protocol.slice(0, -1) as 'http' | 'https', // Remove the trailing ':'
      hostname: url.hostname,
      port: url.port || '', // Add port if specified
      pathname: '/api/files/**', // Common path for PocketBase files
    });
    console.log(`[next.config.js] Successfully added PocketBase remote pattern: ${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}/api/files/**`);
  } catch (e) {
    console.error(`[next.config.js] FATAL: Invalid PocketBase URL ('${pocketbaseUrlString}') provided. Cannot add it to image remotePatterns. Error: ${(e as Error).message}. IMAGES FROM POCKETBASE WILL LIKELY FAIL TO LOAD.`);
  }
} else {
  console.warn(`[next.config.js] WARNING: PocketBase URL is not defined. Images from PocketBase will not load. This is unexpected if the URL is hardcoded.`);
}

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
        port: '',
        pathname: '/api/**',
      },
      {
        protocol: 'https',
        hostname: 'www.citypng.com', 
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.filecdn.in',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'education.indianexpress.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
        port: '',
        pathname: '/**',
      },
      // Removed the explicit entry for f3605bbf-1d05-4292-9f0b-d3cd0ac21935-00-2eeov1wweb7qq.sisko.replit.dev
      // Existing cluster-specific URLs, keep if still needed, otherwise remove
      {
        protocol: 'https',
        hostname: '9000-firebase-studio-1748410223729.cluster-ancjwrkgr5dvux4qug5rbzyc2y.cloudworkstations.dev',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '6000-firebase-studio-1748410223729.cluster-ancjwrkgr5dvux4qug5rbzyc2y.cloudworkstations.dev',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '3000-firebase-studio-1748410223729.cluster-ancjwrkgr5dvux4qug5rbzyc2y.cloudworkstations.dev',
        port: '',
        pathname: '/**', 
      },
      ...pocketbaseRemotePatterns, // Add the dynamically generated PocketBase pattern(s) for type: "file" fields
    ],
  },
  experimental: {
    allowedDevOrigins: [
      // Keep existing allowedDevOrigins if they are still relevant for your development environment
      'https://6000-firebase-studio-1748410223729.cluster-ancjwrkgr5dvux4qug5rbzyc2y.cloudworkstations.dev',
      'https://9000-firebase-studio-1748410223729.cluster-ancjwrkgr5dvux4qug5rbzyc2y.cloudworkstations.dev',
      'https://3000-firebase-studio-1748410223729.cluster-ancjwrkgr5dvux4qug5rbzyc2y.cloudworkstations.dev',
    ],
  },
  
};

export default nextConfig;
