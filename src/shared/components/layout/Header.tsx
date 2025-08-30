"use client";

import {useState, useEffect} from "react";
import {Button} from "@/shared/components/ui/Button";
import {User, Plus, LogOut} from "lucide-react";
import {cn} from "@/lib/utils";
import RecButton from "../ui/RecButton";
import {usePathname, useRouter} from "next/navigation";
import {useSession, signOut} from "next-auth/react";
import {ROUTES} from "@/constants/routes";
import {findMatchingPath} from "@/shared/utils/path";
import Image from "next/image";

// ページ設定の型定義
interface PageConfig {
  title: string;
  showActionButton?: boolean;
  actionButtonIcon?: React.ComponentType<{className?: string}>;
  actionButtonText?: string;
  onActionClick?: () => void;
}

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const {data: session} = useSession();

  // ページ設定マップ
  const pageConfigs: Record<string, PageConfig> = {
    [ROUTES.HISTORY]: {
      title: "議事録一覧",
      showActionButton: true,
      actionButtonIcon: Plus,
      actionButtonText: "新規作成",
      onActionClick: () => {
        // 新規議事録作成の処理
        console.log("新規議事録作成");
      },
    },
    [ROUTES.RECORD]: {
      title: "文字起こし",
      showActionButton: false,
    },
    [ROUTES.TEMPLATES]: {
      title: "テンプレート",
      showActionButton: true,
      actionButtonIcon: Plus,
      actionButtonText: "新規テンプレート",
      onActionClick: () => {
        // 新規テンプレート作成の処理
        router.push(ROUTES.TEMPLATES_NEW);
      },
    },
    [ROUTES.TEMPLATES_NEW]: {
      title: "新規テンプレート",
      showActionButton: false,
    },
  };

  // 現在のページ設定を取得
  const getCurrentPageConfig = (): PageConfig => {
    const matchingPath = findMatchingPath(pathname, pageConfigs);
    if (matchingPath) return pageConfigs[matchingPath];
    return {title: "Yuno"}; // デフォルト設定
  };

  const currentPageConfig = getCurrentPageConfig();

  const handleUserButtonClick = () => {
    if (session) {
      setShowUserMenu(!showUserMenu);
    } else {
      router.push(ROUTES.SIGNIN);
    }
  };

  const handleSignOut = async () => {
    await signOut({callbackUrl: ROUTES.HOME});
    setShowUserMenu(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 0);
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        showUserMenu &&
        !(event.target as Element).closest("[data-user-menu]")
      ) {
        setShowUserMenu(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    document.addEventListener("click", handleClickOutside);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showUserMenu]);

  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-20 shrink-0 items-center justify-between px-8 transition-all duration-200",
        isScrolled ? "h-14 bg-white shadow-sm" : "bg-[#EFF0F5]"
      )}
    >
      <h1
        className={cn(
          "text-2xl font-bold text-gray-800 transition-all duration-200",
          isScrolled ? "text-lg" : "text-2xl"
        )}
      >
        {currentPageConfig.title}
      </h1>
      <div className="flex items-center gap-4">
        {/* アクションボタン */}
        {currentPageConfig.showActionButton &&
          currentPageConfig.actionButtonIcon && (
            <Button
              size="sm"
              variant="default"
              onClick={currentPageConfig.onActionClick}
            >
              <currentPageConfig.actionButtonIcon className="h-4 w-4" />
              {currentPageConfig.actionButtonText}
            </Button>
          )}

        <RecButton isRecording={true} recordingTime="00:42:18" />
        {/* <RecButton isRecording={false} /> */}

        {/* ユーザーメニュー */}
        <div className="relative" data-user-menu>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-gray-500 hover:bg-gray-800"
            onClick={handleUserButtonClick}
          >
            {session?.user?.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name || "User"}
                className="rounded-full"
                width={24}
                height={24}
              />
            ) : (
              <User className="h-6 w-6 text-white" />
            )}
          </Button>

          {/* ドロップダウンメニュー */}
          {showUserMenu && session && (
            <div
              className="absolute top-12 right-0 z-50 w-48 rounded-lg border border-gray-200 bg-white shadow-xl"
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "4px",
              }}
            >
              <div className="py-1">
                <div className="border-b border-gray-100 px-4 py-3 text-sm text-gray-700">
                  <div className="font-medium text-gray-900">
                    {session.user?.name || "ユーザー"}
                  </div>
                  <div className="truncate text-gray-500">
                    {session.user?.email || "メールアドレス未設定"}
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  ログアウト
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
