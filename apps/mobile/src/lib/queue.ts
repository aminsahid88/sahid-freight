/**
 * Offline upload queue: persists items in AsyncStorage, copies each photo into
 * the app's document directory so it survives app restarts, and uploads when
 * the network allows. Runs on app start, when the app returns to the
 * foreground, after every capture, and on manual retry.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { create } from "zustand";
import api, { isNetworkError } from "./api";
import { counts, createItem, markDone, markRejected, markRetry, markUploading, prune, type QueueItem, retryNow, runnable } from "./queue-logic";

const KEY = "capture.queue.v1";
const DIR = `${FileSystem.documentDirectory ?? ""}queue/`;

interface QueueState {
  items: QueueItem[];
  hydrated: boolean;
  processing: boolean;
  hydrate: () => Promise<void>;
  enqueue: (input: { companyId: string; uri: string; name: string; mimeType: string; bytes: number; vehicleId: string | null }) => Promise<QueueItem>;
  process: () => Promise<void>;
  retry: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

async function save(items: QueueItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage full or unavailable: items stay in memory for this session */
  }
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useQueue = create<QueueState>((set, get) => ({
  items: [],
  hydrated: false,
  processing: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const items = raw ? (JSON.parse(raw) as QueueItem[]) : [];
      const { keep, dropped } = prune(items);
      for (const d of dropped) await FileSystem.deleteAsync(d.localUri, { idempotent: true }).catch(() => undefined);
      // Anything stuck "uploading" from a killed app goes back to pending.
      const fixed = keep.map((i) => (i.status === "uploading" ? { ...i, status: "pending" as const } : i));
      set({ items: fixed, hydrated: true });
      if (dropped.length || fixed.some((i, idx) => i !== keep[idx])) await save(fixed);
    } catch {
      set({ items: [], hydrated: true });
    }
  },

  enqueue: async ({ companyId, uri, name, mimeType, bytes, vehicleId }) => {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => undefined);
    const id = newId();
    const ext = name.split(".").pop() || (mimeType === "application/pdf" ? "pdf" : "jpg");
    const localUri = `${DIR}${id}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: localUri });
    const item = createItem({ id, companyId, localUri, name, mimeType, bytes, vehicleId });
    const items = [...get().items, item];
    set({ items });
    await save(items);
    void get().process();
    return item;
  },

  process: async () => {
    if (get().processing) return;
    set({ processing: true });
    try {
      for (const item of runnable(get().items)) {
        set({ items: markUploading(get().items, item.id) });
        await save(get().items);
        try {
          const form = new FormData();
          form.append("files", { uri: item.localUri, name: item.name, type: item.mimeType } as unknown as Blob);
          if (item.vehicleId) form.append("vehicleId", item.vehicleId);
          const res = await api.post<{ uploaded: Array<{ id: string }>; rejected: Array<{ filename: string; reason: string }> }>(`/companies/${item.companyId}/documents`, form, {
            headers: { "Content-Type": "multipart/form-data" },
            timeout: 120_000,
          });
          const uploadedId = res.data.uploaded[0]?.id;
          if (uploadedId) {
            set({ items: markDone(get().items, item.id, uploadedId) });
            await FileSystem.deleteAsync(item.localUri, { idempotent: true }).catch(() => undefined);
          } else {
            set({ items: markRejected(get().items, item.id, res.data.rejected[0]?.reason ?? "rejected") });
          }
        } catch (err) {
          const e = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
          if (isNetworkError(err) || (e.response?.status ?? 0) >= 500) {
            set({ items: markRetry(get().items, item.id, e.message ?? "network") });
          } else {
            set({ items: markRejected(get().items, item.id, e.response?.data?.message ?? e.message ?? "rejected") });
          }
        }
        await save(get().items);
      }
    } finally {
      set({ processing: false });
    }
  },

  retry: async (id) => {
    set({ items: retryNow(get().items, id) });
    await save(get().items);
    void get().process();
  },

  remove: async (id) => {
    const item = get().items.find((i) => i.id === id);
    if (item) await FileSystem.deleteAsync(item.localUri, { idempotent: true }).catch(() => undefined);
    const items = get().items.filter((i) => i.id !== id);
    set({ items });
    await save(items);
  },
}));

export function queueCounts(items: QueueItem[]) {
  return counts(items);
}
