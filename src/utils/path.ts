/**
 * クエリパラメータを除去する
 * findMatchingPathの前処理で使用します
 */
export const removeQueryParams = (pathname: string): string => {
  return pathname.split("?")[0];
};

/**
 * パスにマッチする設定を検索する
 * @param pathname 現在のパス
 * @param pathConfigs パス設定オブジェクト
 * @returns マッチしたパスまたはnull
 */
export const findMatchingPath = <T>(
  pathname: string,
  pathConfigs: Record<string, T>
): string | null => {
  // クエリパラメータを除去したパスを取得
  const pathWithoutQuery = removeQueryParams(pathname);

  // 完全一致を確認
  if (pathConfigs[pathWithoutQuery]) {
    return pathWithoutQuery;
  }

  // 部分一致を確認（長いパスから順番に）
  const sortedPaths = Object.keys(pathConfigs).sort(
    (a, b) => b.length - a.length
  );
  for (const path of sortedPaths) {
    if (pathWithoutQuery.startsWith(path)) {
      return path;
    }
  }

  return null;
};
