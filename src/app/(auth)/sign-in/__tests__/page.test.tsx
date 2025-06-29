import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useSession, signIn, signOut } from "next-auth/react";
import SignIn from "../page";

// Firebase auth のモック
const mockSignInWithPopup = jest.fn();
jest.mock("firebase/auth", () => ({
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
}));

jest.mock("@/lib/firebase", () => ({
  auth: {},
  provider: {},
}));

jest.mock("next-auth/react");

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockSignIn = signIn as jest.MockedFunction<typeof signIn>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;

describe("SignIn Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("未認証時にログインボタンが表示される", () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: jest.fn(),
    });

    render(<SignIn />);

    expect(screen.getByText("アカウントにサインイン")).toBeInTheDocument();
    expect(screen.getByText("Googleでログイン")).toBeInTheDocument();
  });

  it("認証済みの場合ユーザー情報とログアウトボタンが表示される", () => {
    const mockSession = {
      user: {
        name: "Test User",
        email: "test@example.com",
      },
    };

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: "authenticated",
      update: jest.fn(),
    });

    render(<SignIn />);

    expect(screen.getByText("こんにちは、Test Userさん！")).toBeInTheDocument();
    expect(screen.getByText("ログアウト")).toBeInTheDocument();
  });

  it("ログインボタンクリックでGoogle認証が実行される", async () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: jest.fn(),
    });

    const mockUser = {
      getIdToken: jest.fn().mockResolvedValue("mock-id-token"),
      refreshToken: "mock-refresh-token",
    };

    mockSignInWithPopup.mockResolvedValue({
      user: mockUser,
    });

    render(<SignIn />);

    const loginButton = screen.getByText("Googleでログイン");
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(mockSignInWithPopup).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        idToken: "mock-id-token",
        refreshToken: "mock-refresh-token",
        callbackUrl: "/",
      });
    });
  });

  it("ログアウトボタンクリックでログアウトが実行される", async () => {
    const mockSession = {
      user: {
        name: "Test User",
        email: "test@example.com",
      },
    };

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: "authenticated",
      update: jest.fn(),
    });

    render(<SignIn />);

    const logoutButton = screen.getByText("ログアウト");
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/" });
    });
  });

  it("ローディング中に適切なメッセージが表示される", () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "loading",
      update: jest.fn(),
    });

    render(<SignIn />);

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });
});
