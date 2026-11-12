import AppStorage from '@/lib/app-storage';

/** Per-wallet first-run tour completion. Separate key so wallet records are never touched. */
const key = (walletId: string) => `m2014.tour.v1.${walletId}`;

export async function isTutorialDone(walletId: string): Promise<boolean> {
  return (await AppStorage.getItem(key(walletId))) === '1';
}
export async function markTutorialDone(walletId: string): Promise<void> {
  await AppStorage.setItem(key(walletId), '1');
}
export async function resetTutorial(walletId: string): Promise<void> {
  await AppStorage.removeItem(key(walletId));
}
