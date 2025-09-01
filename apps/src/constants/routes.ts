export const ROUTES = {
  HOME: "/",

  // 履歴
  HISTORY: "/history",

  // 会議
  RECORD: "/record",

  // テンプレート
  TEMPLATES: "/templates",

  // テンプレート新規作成
  TEMPLATES_NEW: "/templates/new",

  // テンプレート詳細
  TEMPLATES_DETAIL: (id: string) => `/templates/${id}`,

  // サインイン
  SIGNIN: "/sign-in",

  // サインアップ
  SIGNUP: "/signup",

  // プロフィール
  PROFILE: "/profile",

  // 設定
  SETTINGS: "/settings",

  // API
  API: "/swagger",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
