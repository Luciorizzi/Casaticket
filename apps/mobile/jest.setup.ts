import type { ReactNode } from 'react';
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);
