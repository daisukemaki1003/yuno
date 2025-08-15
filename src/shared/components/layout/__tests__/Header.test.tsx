import { render, screen, fireEvent } from '@testing-library/react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Header from '../Header';

jest.mock('next-auth/react');
jest.mock('next/navigation');

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

// RecButtonのモック
jest.mock('../../ui/RecButton', () => {
  return function MockRecButton() {
    return <div data-testid="rec-button">RecButton</div>;
  };
});

describe('Header Component', () => {
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
    mockUsePathname.mockReturnValue('/');
  });

  it('未認証時にユーザーボタンクリックでサインインページにリダイレクト', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });

    render(<Header />);

    const userButton = screen.getAllByRole('button').find(button => 
      button.querySelector('svg[class*="lucide-user"]')
    );
    fireEvent.click(userButton!);

    expect(mockPush).toHaveBeenCalledWith('/auth/sign-in');
  });

  it('認証済み時にユーザーボタンクリックでドロップダウンメニューを表示', () => {
    const mockSession = {
      user: {
        name: 'Test User',
        email: 'test@example.com',
        image: 'https://example.com/avatar.jpg',
      },
    };

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    });

    render(<Header />);

    const userButton = screen.getAllByRole('button').find(button => 
      button.querySelector('svg[class*="lucide-user"]') || button.querySelector('img')
    );
    fireEvent.click(userButton!);

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('ログアウト')).toBeInTheDocument();
  });

  it('ユーザーアバター画像が表示される', () => {
    const mockSession = {
      user: {
        name: 'Test User',
        email: 'test@example.com',
        image: 'https://example.com/avatar.jpg',
      },
    };

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    });

    render(<Header />);

    const avatar = screen.getByAltText('Test User');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('ログアウトボタンクリックでログアウト処理が実行される', () => {
    const mockSession = {
      user: {
        name: 'Test User',
        email: 'test@example.com',
      },
    };

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    });

    render(<Header />);

    // ユーザーボタンをクリックしてメニューを表示
    const userButton = screen.getAllByRole('button').find(button => 
      button.querySelector('svg[class*="lucide-user"]')
    );
    fireEvent.click(userButton!);

    // ログアウトボタンをクリック
    const logoutButton = screen.getByText('ログアウト');
    fireEvent.click(logoutButton);

    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' });
  });

  it('パスに応じてページタイトルが変更される', () => {
    mockUsePathname.mockReturnValue('/history');
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });

    render(<Header />);

    expect(screen.getByText('議事録一覧')).toBeInTheDocument();
  });

  it('デフォルトタイトルが表示される', () => {
    mockUsePathname.mockReturnValue('/unknown-path');
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });

    render(<Header />);

    expect(screen.getByText('Yuno')).toBeInTheDocument();
  });
});