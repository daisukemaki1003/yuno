import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { adminAuth } from "@/lib/firebase/admin";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        idToken: { label: "ID Token", type: "text" },
        refreshToken: { label: "Refresh Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.idToken) {
          return null;
        }

        try {
          // Firebase Admin SDKでIDトークンを検証
          const decodedToken = await adminAuth.verifyIdToken(
            credentials.idToken
          );

          // ユーザー情報を取得
          const userRecord = await adminAuth.getUser(decodedToken.uid);

          return {
            id: userRecord.uid,
            email: userRecord.email || "",
            name: userRecord.displayName || "",
            image: userRecord.photoURL || "",
            refreshToken: credentials.refreshToken,
          };
        } catch (error) {
          console.error("認証エラー:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.refreshToken = user.refreshToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.refreshToken) {
        session.refreshToken = token.refreshToken as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    signUp: "/auth/signup",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
