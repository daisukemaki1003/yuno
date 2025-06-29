import { render, screen } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useAuth, withAuth } from '../useAuth';

jest.mock('next-auth/react');
jest.mock('next/navigation');

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

// テスト用のコンポーネント
function TestComponent() {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="authenticated">{auth.isAuthenticated.toString()}</div>
      <div data-testid="loading">{auth.isLoading.toString()}</div>
    </div>
  );
}

const TestWrappedComponent = () => (
  <div data-testid="protected-content">Protected Content</div>
);

const ProtectedComponent = withAuth(TestWrappedComponent);

describe('useAuth hook', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    });
  });

  it('認証済みの場合にisAuthenticatedがtrueを返す', () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Test User' } },
      status: 'authenticated',
      update: jest.fn(),
    });

    render(<TestComponent />);

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('未認証の場合にisAuthenticatedがfalseを返す', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });

    render(<TestComponent />);

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('ローディング中にisLoadingがtrueを返す', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'loading',
      update: jest.fn(),
    });

    render(<TestComponent />);

    expect(screen.getByTestId('loading')).toHaveTextContent('true');
  });
});

describe('withAuth HOC', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    });
  });

  it('認証済みの場合にコンポーネントを表示する', () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Test User' } },
      status: 'authenticated',
      update: jest.fn(),
    });

    render(<ProtectedComponent />);

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('未認証の場合にサインインページにリダイレクトする', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });

    render(<ProtectedComponent />);

    expect(mockPush).toHaveBeenCalledWith('/auth/sign-in');
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('ローディング中に適切なメッセージを表示する', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'loading',
      update: jest.fn(),
    });

    render(<ProtectedComponent />);

    expect(screen.getByText('認証状態を確認中...')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});