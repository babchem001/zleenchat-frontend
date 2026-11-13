import type { CallRecord } from "@/src/services/calls/callService";

export const parseIncomingCallNotification = (
  data: unknown,
): CallRecord | null => {
  if (typeof data !== "object" || data === null) return null;

  const notificationData = data as Record<string, unknown>;

  if (notificationData.type !== "incoming_call") return null;

  let parsedCall: unknown;

  try {
    parsedCall =
      typeof notificationData.call === "string"
        ? JSON.parse(notificationData.call)
        : notificationData.call;
  } catch {
    return null;
  }

  if (typeof parsedCall !== "object" || parsedCall === null) return null;

  const call = parsedCall as Record<string, unknown>;
  const callId = Number(call.callId);

  if (
    !Number.isSafeInteger(callId) ||
    callId <= 0 ||
    (call.scope !== "DIRECT" && call.scope !== "GROUP") ||
    (call.type !== "AUDIO" && call.type !== "VIDEO") ||
    call.status !== "RINGING" ||
    typeof call.startedAt !== "string" ||
    typeof call.expiresAt !== "string" ||
    Date.parse(call.expiresAt) <= Date.now()
  ) {
    return null;
  }

  const conversationId =
    call.conversationId === null ? null : Number(call.conversationId);
  const groupId = call.groupId === null ? null : Number(call.groupId);

  if (
    (conversationId !== null &&
      (!Number.isSafeInteger(conversationId) || conversationId <= 0)) ||
    (groupId !== null && (!Number.isSafeInteger(groupId) || groupId <= 0))
  ) {
    return null;
  }

  return {
    ...call,
    id: callId,
    callId,
    scope: call.scope,
    conversationId,
    groupId,
    type: call.type,
    status: "RINGING",
    startedAt: call.startedAt,
    expiresAt: call.expiresAt,
    caller: call.caller as CallRecord["caller"],
    group: call.group as CallRecord["group"],
  } as CallRecord;
};
