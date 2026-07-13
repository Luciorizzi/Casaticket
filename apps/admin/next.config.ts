import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@casaticket/domain', '@casaticket/types', '@casaticket/ui', '@casaticket/validation'],
};

export default nextConfig;

