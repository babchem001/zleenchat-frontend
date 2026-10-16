import { API_BASE_URL } from "@/src/services/api/apiClient";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getToken } from "@/src/services/storage/tokenService";

let socket: Socket | null = null;

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const connectSocket = async () => {
      try {
        const token = await getToken();

        if (!token) {
          console.log("No token, socket not connecting");
          return;
        }

        // ✅ FORCE recreate socket if not connected
        if (!socket || !socket.connected) {
          socket = io(API_BASE_URL, {
            auth: { token },
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            timeout: 10000,
          });

          console.log("Creating new socket...");
        }

        socketRef.current = socket;
        if (socket.connected) {
          setConnected(true);
          // connectSocket();
        }

        // CONNECT EVENT
        socket.on("connect", () => {
          // console.log("Socket connected:", socket?.id);
          setConnected(true);

          // FORCE EMIT AFTER SMALL DELAY (VERY IMPORTANT FIX)
          setTimeout(() => {
            // console.log("Emitting user:online");
            socket?.emit("user:online");
          }, 500);
        });

        // DEBUG EVENTS
        socket.on("connect_error", (err) => {
          console.log("Socket connection error:", err.message);
        });

        socket.on("disconnect", (reason) => {
          console.log("Socket disconnected:", reason);
          setConnected(false);
        });
      } catch (error) {
        console.log("Socket init error:", error);
      }
    };

    connectSocket();
  }, []);

  return {
    socketRef,
    connected,
  };
};
