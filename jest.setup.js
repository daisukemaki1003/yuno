import '@testing-library/jest-dom';

// NextAuth.js のモック
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  SessionProvider: ({ children }) => children,
}));

// Firebase のモック
jest.mock('./src/app/lib/firebase', () => ({
  auth: {},
  provider: {},
  adminAuth: {},
}));

// Next.js router のモック
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));