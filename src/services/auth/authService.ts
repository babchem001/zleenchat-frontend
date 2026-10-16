import apiClient from "../api/apiClient";
import { saveToken } from "../storage/tokenService";

type LoginResponse = {
  access_token: string;
};

type RegisterPayload = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  invitationCode: string;
  phoneNumber?: string;

  countryCode?: string;
  country?: string;
  state?: string;
  city?: string;
  timezone?: string;
};

type InvitationCodeResponse = {
  success: boolean;
  message: string;
};

type VerifyInvitationCodePayload = {
  email: string;
  invitationCode: string;
};

type VerifyInvitationCodeResponse = {
  success: boolean;
  message: string;
  email?: string;
  requiresPhoneVerification?: boolean;
};

type InvitationRegistrationStateResponse = {
  success: boolean;
  message: string;
  requiresPhoneVerification: boolean;
};

type ValidateSessionUser = {
  sub: number;
  email: string;
  firstName: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  username: string;
};

type ValidateSessionResponse = {
  success: boolean;
  user: ValidateSessionUser;
};

const loginUser = async (
  email: string,
  password: string,
): Promise<LoginResponse> => {
  const response = await apiClient.post("/auth/login", {
    email,
    password,
  });

  await saveToken(response.data.access_token);
  return response.data;
};

type AccountDeletionResponse = {
  success: boolean;
  message: string;
  deletionStatus: string;
  deletionRequestedAt: string;
  deletionScheduledFor: string;
  legalHold: boolean;
};

const requestAccountDeletion = async (
  password: string,
): Promise<AccountDeletionResponse> => {
  const response = await apiClient.post("/auth/request-deletion", {
    password,
    confirmDeletion: true,
  });

  return response.data;
};

const validateSession = async (
  token: string,
): Promise<ValidateSessionResponse> => {
  const response = await apiClient.get("/auth/session", {
    headers: {
      Authorization: `Bearer ${token},`,
    },
    timeout: 3000,
  });
  return response.data;
};

type LogoutResponse = {
  success: boolean;
  message: string;
  sessionRevoked: boolean;
};
const logoutUser = async (): Promise<LogoutResponse> => {
  const response = await apiClient.post("/auth/logout");
  return response.data;
};

const requestInvitationCode = async (
  email: string,
  phoneNumber?: string,
): Promise<InvitationCodeResponse> => {
  const payload: {
    email: string;
    phoneNumber?: string;
  } = {
    email,
  };

  if (phoneNumber?.trim()) {
    payload.phoneNumber = phoneNumber.trim();
  }

  const response = await apiClient.post("/auth/invitation-code", payload);
  return response.data;
};

const verifyInvitationCode = async (
  payload: VerifyInvitationCodePayload,
): Promise<VerifyInvitationCodeResponse> => {
  const response = await apiClient.post("/auth/invitation-code/verify", {
    email: payload.email,
    invitationCode: payload.invitationCode,
  });

  return response.data;
};

// Phone-bound invitation verification for invited users.
type VerifyPhoneInvitationCodeResponse = {
  success: boolean;
  message: string;
  invitationId?: number;
  phoneNumber?: string;
  attemptsRemaining?: number;
};

const verifyPhoneInvitationCode = async (
  phoneNumber: string,
  smsCode: string,
): Promise<VerifyPhoneInvitationCodeResponse> => {
  const response = await apiClient.post("/auth/invitation-phone/verify", {
    phoneNumber,
    smsCode,
  });

  return response.data;
};

const getInvitationRegistrationState = async (
  email: string,
  invitationCode: string,
): Promise<InvitationRegistrationStateResponse> => {
  const response = await apiClient.post("/auth/invitation-registration-state", {
    email,
    invitationCode,
  });

  return response.data;
};

const registerUser = async (payload: RegisterPayload): Promise<any> => {
  const response = await apiClient.post("/auth/register", payload);

  return response.data;
};

export {
  loginUser,
  validateSession,
  logoutUser,
  requestInvitationCode,
  verifyInvitationCode,
  getInvitationRegistrationState,
  verifyPhoneInvitationCode,
  registerUser,
  requestAccountDeletion,
};
