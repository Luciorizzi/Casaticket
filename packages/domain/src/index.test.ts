import { describe, expect, it } from 'vitest';

import {
  canSelfAssignRole,
  getCoverageSummary,
  isSelectableMobileRole,
  isServiceRadiusValid,
} from './index';

describe('domain guards', () => {
  it('rejects admin roles for self assignment', () => {
    expect(canSelfAssignRole('customer')).toBe(true);
    expect(canSelfAssignRole('admin')).toBe(false);
  });

  it('validates selectable mobile roles', () => {
    expect(isSelectableMobileRole('professional')).toBe(true);
    expect(isSelectableMobileRole('operator')).toBe(false);
  });

  it('enforces the service radius limits', () => {
    expect(isServiceRadiusValid(1)).toBe(true);
    expect(isServiceRadiusValid(100)).toBe(true);
    expect(isServiceRadiusValid(101)).toBe(false);
  });

  it('formats a readable coverage summary', () => {
    expect(getCoverageSummary('CABA', 25)).toBe('CABA hasta 25 km');
  });
});

