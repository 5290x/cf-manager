// 精确判断账户是否开通 R2：避免 '-r2' 被 includes('r2') 误匹配
export function hasR2Feature(account: any): boolean {
  const features = (account.available_features || '').split(',').filter(Boolean);
  return features.includes('r2') && !features.includes('-r2');
}
