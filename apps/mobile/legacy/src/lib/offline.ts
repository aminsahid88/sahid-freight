import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";

export function subscribeToNetworkStatus(callback: (isConnected: boolean) => void) {
  return NetInfo.addEventListener((state) => {
    callback(!!state.isConnected);
  });
}

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !!state.isConnected;
}

export async function cacheData(key: string, data: any) {
  try {
    await AsyncStorage.setItem(`cache_${key}`, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {}
}

export async function getCachedData<T>(key: string): Promise<{ data: T; cachedAt: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(`cache_${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
