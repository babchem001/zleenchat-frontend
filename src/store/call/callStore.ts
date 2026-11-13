import { create } from "zustand";
import type { CallRecord } from "@/src/services/calls/callService";

export type CallSignal = {
  callId: number;
  status?: string;
  [key: string]: unknown;
};

type CallStore = {
  incomingCall: CallRecord | null;
  activeCall: CallRecord | null;
  error: string | null;

  setIncomingCall: (call: CallRecord) => void;
  setActiveCall: (call: CallRecord) => void;
  applyCallSignal: (signal: CallSignal) => void;
  clearIncomingCall: (callId?: number) => void;
  clearActiveCall: (callId?: number) => void;
  setError: (error: string | null) => void;
};

export const useCallStore = create<CallStore>((set) => ({
  incomingCall: null,
  activeCall: null,
  error: null,

  setIncomingCall: (call) => set({ incomingCall: call, error: null }),
  setActiveCall: (call) => set({ activeCall: call, error: null }),

  applyCallSignal: (signal) =>
    set((state) => ({
      activeCall:
        state.activeCall?.callId === signal.callId
          ? ({ ...state.activeCall, ...signal } as CallRecord)
          : state.activeCall,
      incomingCall:
        state.incomingCall?.callId === signal.callId
          ? ({ ...state.incomingCall, ...signal } as CallRecord)
          : state.incomingCall,
    })),

  clearIncomingCall: (callId) =>
    set((state) => ({
      incomingCall:
        callId === undefined || state.incomingCall?.callId === callId
          ? null
          : state.incomingCall,
    })),

  clearActiveCall: (callId) =>
    set((state) => ({
      activeCall:
        callId === undefined || state.activeCall?.callId === callId
          ? null
          : state.activeCall,
    })),

  setError: (error) => set({ error }),
}));
