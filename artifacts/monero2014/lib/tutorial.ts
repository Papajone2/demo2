import AppStorage from '@/lib/app-storage';

/** Per-wallet first-run tour completion. Separate key so wallet records are never touched. */
const key = (walletId: string) => `m2014.tour.v1.${walletId}`;
const resumeKey = (walletId: string) => `m2014.tour-resume.v1.${walletId}`;
export async function tutorialResume(walletId: string) {
  const value = Number(await AppStorage.getItem(resumeKey(walletId)));
  return Number.isInteger(value) && value >= 0 && value <= 3 ? value : 0;
}
export async function saveTutorialResume(walletId: string, step: number) {
  await AppStorage.setItem(resumeKey(walletId), String(step));
}

export async function isTutorialDone(walletId: string): Promise<boolean> {
  return (await AppStorage.getItem(key(walletId))) === '1';
}
export async function markTutorialDone(walletId: string): Promise<void> {
  await AppStorage.setItem(key(walletId), '1');
  await AppStorage.removeItem(resumeKey(walletId));
}
export async function resetTutorial(walletId: string): Promise<void> {
  await AppStorage.multiRemove([key(walletId), resumeKey(walletId)]);
}
