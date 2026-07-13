import { describe, expect, it } from 'vitest';

import { adminModuleLinks } from '@casaticket/ui';

describe('admin module registry', () => {
  it('exposes the expected base modules', () => {
    expect(adminModuleLinks).toHaveLength(7);
    expect(adminModuleLinks.map((item) => item.href)).toEqual([
      '/',
      '/users',
      '/professionals',
      '/categories',
      '/requests',
      '/claims',
      '/settings',
    ]);
  });
});

