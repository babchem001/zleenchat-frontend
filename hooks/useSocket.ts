import { API_BASE_URL } from "@/src/services/api/apiClient";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getToken } from "@/src/services/storage/tokenService";

let sharedSocket: Socket | null = null;

export const useSocket = (enabled = true) => {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const connectSocket = async () => {
      if (!enabled) {
        if (sharedSocket) {
          sharedSocket.removeAllListeners();
          sharedSocket.disconnect();
          sharedSocket = null;
        }

        setSocket(null);
        setConnected(false);
        return;
      }

      try {
        const token = await getToken();

        if (cancelled) return;

        if (!token) {
          setSocket(null);
          setConnected(false);
          return;
        }

        if (!sharedSocket) {
          const createdSocket = io(API_BASE_URL, {
            auth: { token },
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            timeout: 10000,
          });

          createdSocket.on("connect", () => {
            setTimeout(() => {
              createdSocket.emit("user:online");
            }, 500);
          });

          createdSocket.on("connect_error", (error) => {
            console.log("Socket connection error:", error.message);
          });

          sharedSocket = createdSocket;
        } else if (!sharedSocket.connected && !sharedSocket.active) {
          sharedSocket.auth = { token };
          sharedSocket.connect();
        }

        setSocket(sharedSocket);
        setConnected(sharedSocket.connected);
      } catch (error) {
        console.log("Socket init error:", error);
      }
    };

    void connectSocket();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  socketRef.current = socket;

  return { socketRef, socket, connected };
};