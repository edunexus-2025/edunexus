
import type { NextConfig } from 'next';

// Define a local interface for the remote pattern structure
interface CustomRemotePattern {
  protocol: 'http' | 'https';
  hostname: string;
  port?: string;
  pathname?: string;
}

// Read the PocketBase URL from the environment variable
// Fallback to the hardcoded URL if the environment variable is not set
const pocketbaseUrlString = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://ae8425c5-5ede-4664-bdaa-b238298ae1be-00-4oi013hd9264.sisko.replit.dev';

if (!process.env.NEXT_PUBLIC_POCKETBASE_URL && process.env.NODE_ENV !== 'test') {
  console.warn(
    `[next.config.js] WARNING: PocketBase URL is not set in environment variables (NEXT_PUBLIC_POCKETBASE_URL).
    Falling back to default: ${pocketbaseUrlString}
    Please set this variable in your .env.local file.`
  );
}

const pocketbaseRemotePatterns: Array<CustomRemotePattern> = [];

if (pocketbaseUrlString) {
  try {
    const url = new URL(pocketbaseUrlString);
    pocketbaseRemotePatterns.push({
      protocol: url.protocol.slice(0, -1) as 'http' | 'https',
      hostname: url.hostname,
      port: url.port || '',
      pathname: '/api/files/**', // Standard PocketBase file path
    });
    console.log(`[next.config.js] Successfully added PocketBase remote pattern for: ${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}/api/files/**`);
  } catch (e) {
    console.error(`[next.config.js] FATAL: Invalid PocketBase URL ('${pocketbaseUrlString}') from env/fallback. Cannot add it to image remotePatterns. Error: ${(e as Error).message}. IMAGES FROM POCKETBASE WILL LIKELY FAIL TO LOAD.`);
  }
} else {
  console.warn(`[next.config.js] WARNING: PocketBase URL is effectively undefined. Images from PocketBase will not load.`);
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
      // Re-adding the problematic Replit hostname that is causing the error
      {
        protocol: 'https',
        hostname: 'f3605bbf-1d05-4292-9f0b-d3cd0ac21935-00-2eeov1wweb7qq.sisko.replit.dev',
        port: '',
        pathname: '/api/files/**', 
      },
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
      ...pocketbaseRemotePatterns, 
    ],
  },
  experimental: {
    allowedDevOrigins: [
      'https://6000-firebase-studio-1748410223729.cluster-ancjwrkgr5dvux4qug5rbzyc2y.cloudworkstations.dev',
      'https://9000-firebase-studio-1748410223729.cluster-ancjwrkgr5dvux4qug5rbzyc2y.cloudworkstations.dev',
      'https://3000-firebase-studio-1748410223729.cluster-ancjwrkgr5dvux4qug5rbzyc2y.cloudworkstations.dev',
    ],
  },
  
};

export default nextConfig;
