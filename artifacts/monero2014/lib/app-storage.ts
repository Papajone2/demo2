import NativeStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

let temporary = false;
const session = new Map<string, string>();
export function enableTemporaryTestStorage() {
  if (Platform.OS !== 'web') throw new Error('Temporary storage is only available for browser testing.');
  session.clear();
  temporary = true;
}
export function isTemporaryTestStorage() { return temporary; }
// Opt-in temporary storage is a NEW, disposable test session. It never bypasses
// an existing native lock or pretends to recover inaccessible persistent data.
const AppStorage = {
  getItem: async (key: string) => temporary ? session.get(key) ?? null : NativeStorage.getItem(key),
  setItem: async (key: string, value: string) => { if (temporary) session.set(key, value); else await NativeStorage.setItem(key, value); },
  removeItem: async (key: string) => { if (temporary) session.delete(key); else await NativeStorage.removeItem(key); },
  multiRemove: async (keys: readonly string[]) => { if (temporary) keys.forEach(key => session.delete(key)); else await NativeStorage.multiRemove([...keys]); },
};
export default AppStorage;
