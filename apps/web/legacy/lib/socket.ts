"use client";
import axios from "axios";
import { io, Socket } from "socket.io-client";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace("/api", "");

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;
  try {
    const res = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
      { refreshToken }
    );
    const newToken = res.data?.accessToken as string | undefined;
    if (newToken) localStorage.setItem("accessToken", newToken);
    return newToken || null;
  } catch {
    return null;
  }
}

// Connect to the API socket with the stored JWT. If the handshake fails
// because the access token is expired, refresh once and reconnect. On a
// second failure the caller is sent to /auth/login.
export function connectAuthedSocket(): Socket {
  const socket: Socket = io(API_URL, {
    auth: { token: getAccessToken() ?? "" },
  });

  let refreshed = false;
  socket.on("connect_error", async (err: any) => {
    if (refreshed) return;
    const msg = String(err?.message || "").toLowerCase();
    if (!msg.includes("unauthorized")) return;
    refreshed = true;
    const newToken = await refreshAccessToken();
    if (!newToken) {
      if (typeof window !== "undefined") window.location.href = "/auth/login";
      return;
    }
    (socket as any).auth = { token: newToken };
    socket.connect();
  });

  return socket;
}
