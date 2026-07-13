import type { ReactNode } from 'react';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));
