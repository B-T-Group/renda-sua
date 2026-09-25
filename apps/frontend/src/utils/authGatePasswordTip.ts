const TIP_PREFIX = 'rsAuthPasswordTipShown:';

export function shouldShowPasswordSignInTip(userSub?: string | null): boolean {
  if (!userSub || typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(`${TIP_PREFIX}${userSub}`) !== '1';
  } catch {
    return false;
  }
}

export function markPasswordSignInTipShown(userSub: string): void {
  try {
    localStorage.setItem(`${TIP_PREFIX}${userSub}`, '1');
  } catch {
    // ignore
  }
}
