"use client";
import { auth, provider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import React from "react";
import { useSession, signIn as nextAuthSignIn, signOut } from "next-auth/react";

export default function SignIn() {
  const { data: session, status } = useSession();

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (user) {
        const idToken = await user.getIdToken();
        const refreshToken = user.refreshToken;

        await nextAuthSignIn("credentials", {
          idToken,
          refreshToken,
          callbackUrl: "/",
        });
      }
    } catch (error) {
      console.error("サインインエラー:", error);
    }
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  if (status === "loading") {
    return <div>読み込み中...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            アカウントにサインイン
          </h2>
        </div>
        {session ? (
          <div className="text-center">
            <p className="mb-4">こんにちは、{session.user?.name}さん！</p>
            <button
              onClick={handleSignOut}
              className="rounded bg-red-500 px-4 py-2 font-bold text-white shadow hover:bg-red-700"
            >
              ログアウト
            </button>
          </div>
        ) : (
          <button
            onClick={signInWithGoogle}
            className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
          >
            Googleでログイン
          </button>
        )}
      </div>
    </div>
  );
}
