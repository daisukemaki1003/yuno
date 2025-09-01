import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { ROUTES } from "@/constants/routes";

// 認証が不要なパス
const publicPaths = [
  ROUTES.SIGNIN,
  "/api/auth",
];

// 認証が必要なパス
const protectedPaths = [
  ROUTES.DASHBOARD,
  ROUTES.HISTORY,
  "/minutes",
  "/record",
  "/templates",
];

export default withAuth(
  function middleware(req: any) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // ログイン済みでサインインページにアクセスした場合、ヒストリーページにリダイレクト
    if (token && pathname === ROUTES.SIGNIN) {
      return NextResponse.redirect(new URL(ROUTES.HISTORY, req.url));
    }

    // ログイン済みでホームページにアクセスした場合、ヒストリーページにリダイレクト
    if (token && pathname === "/") {
      return NextResponse.redirect(new URL(ROUTES.HISTORY, req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        // 公開パスの場合は認証不要
        if (publicPaths.some(path => pathname.startsWith(path))) {
          return true;
        }

        // 保護されたパスの場合は認証必要
        if (protectedPaths.some(path => pathname.startsWith(path))) {
          return !!token;
        }

        // その他のパスは認証不要
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのリクエストパスにマッチ:
     * - api/auth (NextAuth用)
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化ファイル)
     * - favicon.ico (ファビコン)
     * - 画像ファイル
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};