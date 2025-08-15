export const ROUTES = {
  HOME: "/",
  DASHBOARD: "/dashboard",
  HISTORY: "/history",
  RECORD: "/record",
  TEMPLATES: "/templates",
  TEMPLATES_NEW: "/templates/new",
  TEMPLATES_DETAIL: (id: string) => `/templates/${id}`,
  SIGNIN: "/sign-in",
  SIGNUP: "/signup",
  PROFILE: "/profile",
  SETTINGS: "/settings",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
