import { useEffect } from "react";
import type { CallRecord } from "@/src/services/calls/callService";
import { useSocket } from "@/hooks/useSocket";
import { useCallStore, type CallSignal } from "@/src/store/call/callStore";

export const useCallCoordinator = (enabled: boolean) => {
  const { socket } = useSocket(enabled);

  useEffect(() => {
    if (!enabled || !socket) return;

    const onIncoming = (payload: CallRecord) => {
      useCallStore.getState().setIncomingCall(payload);
    };

    const onRinging = (payload: CallRecord) => {
      useCallStore.getState().setActiveCall(payload);
    };

    const onUpdate = (payload: CallSignal) => {
      useCallStore.getState().applyCallSignal(payload);
    };

    const onMissed = (payload: CallSignal) => {
      useCallStore.getState().applyCallSignal({
        ...payload,
        status: payload.status ?? "MISSED",
      });
      useCallStore.getState().clearIncomingCall(payload.callId);
    };

    const onEnded = (payload: CallSignal) => {
      useCallStore.getState().applyCallSignal(payload);
      useCallStore.getState().clearIncomingCall(payload.callId);
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:ringing", onRinging);
    socket.on("call:accepted", onUpdate);
    socket.on("call:declined", onUpdate);
    socket.on("call:busy", onUpdate);
    socket.on("call:active", onUpdate);
    socket.on("call:participant-left", onUpdate);
    socket.on("call:missed", onMissed);
    socket.on("call:ended", onEnded);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:ringing", onRinging);
      socket.off("call:accepted", onUpdate);
      socket.off("call:declined", onUpdate);
      socket.off("call:busy", onUpdate);
      socket.off("call:active", onUpdate);
      socket.off("call:participant-left", onUpdate);
      socket.off("call:missed", onMissed);
      socket.off("call:ended", onEnded);
    };
  }, [enabled, socket]);
};
