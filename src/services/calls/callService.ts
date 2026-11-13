import apiClient from "@/src/services/api/apiClient";

export type CallType = "AUDIO" | "VIDEO";
export type CallScope = "DIRECT" | "GROUP";

export interface CallParticipant {
  userId: number;
  role: string;
  status: string;
  user?: {
    id: number;
    username?: string | null;
    avatarUrl?: string | null;
  };
}

export interface CallRecord {
  callId: number;
  id?: number;
  scope: CallScope;
  conversationId: number | null;
  groupId: number | null;
  type: CallType;
  status: string;
  startedAt: string;
  expiresAt: string;
  caller?: {
    id: number;
    username: string;
    avatarUrl?: string | null;
  } | null;
  callerId?: number;
  startedById?: number;
  recipientId?: number;
  group?: {
    id: number;
    name: string;
  } | null;
  inviteeCount?: number;
  busyCount?: number;
  acceptedAt?: string | null;
  activeAt?: string | null;
  endedAt?: string | null;
  participants?: CallParticipant[];
  [key: string]: unknown;
}

export interface CallActionResult {
  callId: number;
  status?: string;
  [key: string]: unknown;
}

export interface CallCredentials {
  callId: number;
  type: CallType;
  serverUrl: string;
  participantToken: string;
}

type ApiObject = Record<string, unknown>;

const asObject = (value: unknown, label: string): ApiObject => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`The server returned an invalid ${label}.`);
  }

  return value as ApiObject;
};

const positiveId = (value: unknown, label: string): number => {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`The server returned an invalid ${label}.`);
  }

  return id;
};

const nullableId = (value: unknown, label: string): number | null =>
  value === null || value === undefined ? null : positiveId(value, label);

const assertCallType = (type: CallType): CallType => {
  if (type !== "AUDIO" && type !== "VIDEO") {
    throw new Error("Call type must be AUDIO or VIDEO.");
  }

  return type;
};

const normalizeCall = (payload: unknown): CallRecord => {
  const envelope = asObject(payload, "call response");
  const source =
    envelope.call === undefined
      ? envelope
      : asObject(envelope.call, "call record");

  const groupId = nullableId(source.groupId, "group ID");
  const rawScope = source.scope;
  const scope: CallScope =
    rawScope === "GROUP" || (rawScope !== "DIRECT" && groupId !== null)
      ? "GROUP"
      : "DIRECT";

  const type = source.type;
  if (type !== "AUDIO" && type !== "VIDEO") {
    throw new Error("The server returned an invalid call type.");
  }

  const status =
    typeof source.status === "string"
      ? source.status
      : typeof envelope.status === "string"
        ? envelope.status
        : "";

  const startedAt = source.startedAt;
  const expiresAt = source.expiresAt;

  if (
    !status ||
    typeof startedAt !== "string" ||
    typeof expiresAt !== "string"
  ) {
    throw new Error("The server returned an incomplete call record.");
  }

  const caller = source.caller ?? envelope.caller;
  const group = source.group ?? envelope.group;

  return {
    ...source,
    callId: positiveId(
      source.callId ?? source.id ?? envelope.callId,
      "call ID",
    ),
    id: source.id === undefined ? undefined : positiveId(source.id, "call ID"),
    scope,
    conversationId: nullableId(source.conversationId, "conversation ID"),
    groupId,
    type,
    status,
    startedAt,
    expiresAt,
    caller:
      typeof caller === "object" && caller !== null
        ? (caller as CallRecord["caller"])
        : undefined,
    group:
      typeof group === "object" && group !== null
        ? (group as CallRecord["group"])
        : undefined,
    participants: Array.isArray(source.participants)
      ? (source.participants as CallParticipant[])
      : undefined,
  };
};

const normalizeAction = (
  payload: unknown,
  fallbackCallId: number,
): CallActionResult => {
  const envelope = asObject(payload, "call action response");
  const source =
    envelope.call === undefined
      ? envelope
      : asObject(envelope.call, "call action");

  const status =
    typeof source.status === "string"
      ? source.status
      : typeof envelope.status === "string"
        ? envelope.status
        : undefined;

  return {
    ...envelope,
    ...source,
    callId: positiveId(
      source.callId ?? source.id ?? envelope.callId ?? fallbackCallId,
      "call ID",
    ),
    ...(status ? { status } : {}),
  };
};

export const startDirectCall = async (
  recipientId: number,
  type: CallType,
): Promise<CallRecord> => {
  const validRecipientId = positiveId(recipientId, "recipient ID");

  const response = await apiClient.post<unknown>(
    `/calls/direct/start/${validRecipientId}`,
    { type: assertCallType(type) },
  );

  return normalizeCall(response.data);
};

export const startGroupCall = async (
  groupId: number,
  type: CallType,
): Promise<CallRecord> => {
  const validGroupId = positiveId(groupId, "group ID");

  const response = await apiClient.post<unknown>(
    `/calls/groups/${validGroupId}/start`,
    { type: assertCallType(type) },
  );

  return normalizeCall(response.data);
};

export const acceptCall = async (callId: number): Promise<CallActionResult> => {
  const validCallId = positiveId(callId, "call ID");
  const response = await apiClient.post<unknown>(
    `/calls/${validCallId}/accept`,
  );

  return normalizeAction(response.data, validCallId);
};

export const declineCall = async (
  callId: number,
): Promise<CallActionResult> => {
  const validCallId = positiveId(callId, "call ID");
  const response = await apiClient.post<unknown>(
    `/calls/${validCallId}/decline`,
  );

  return normalizeAction(response.data, validCallId);
};

export const markCallJoined = async (
  callId: number,
): Promise<CallActionResult> => {
  const validCallId = positiveId(callId, "call ID");
  const response = await apiClient.post<unknown>(
    `/calls/${validCallId}/joined`,
  );

  return normalizeAction(response.data, validCallId);
};

export const endCall = async (callId: number): Promise<CallActionResult> => {
  const validCallId = positiveId(callId, "call ID");
  const response = await apiClient.post<unknown>(`/calls/${validCallId}/end`);

  return normalizeAction(response.data, validCallId);
};

export const leaveCall = async (callId: number): Promise<CallActionResult> => {
  const validCallId = positiveId(callId, "call ID");
  const response = await apiClient.post<unknown>(`/calls/${validCallId}/leave`);

  return normalizeAction(response.data, validCallId);
};

export const getCallCredentials = async (
  callId: number,
): Promise<CallCredentials> => {
  const validCallId = positiveId(callId, "call ID");
  const response = await apiClient.post<unknown>(`/calls/${validCallId}/token`);
  const data = asObject(response.data, "LiveKit token response");

  const participantToken = data.participantToken ?? data.token;
  const serverUrl = data.serverUrl;
  const type = data.type;

  if (
    typeof participantToken !== "string" ||
    !participantToken ||
    typeof serverUrl !== "string" ||
    !serverUrl ||
    (type !== "AUDIO" && type !== "VIDEO")
  ) {
    throw new Error("The server returned incomplete LiveKit credentials.");
  }

  return {
    callId: positiveId(data.callId ?? validCallId, "call ID"),
    type,
    serverUrl,
    participantToken,
  };
};
