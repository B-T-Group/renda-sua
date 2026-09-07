/** GET /notifications/push-token/status */
export interface PushTokenStatusResponse {
  success: boolean;
  hasRegisteredTokens?: boolean;
  validTokenCount?: number;
  currentTokenRegistered?: boolean;
  error?: string;
}

/** POST /notifications/push-token */
export interface RegisterPushTokenBody {
  expoPushToken: string;
  deviceId?: string;
}

export interface RegisterPushTokenResponse {
  success: boolean;
  error?: string;
}
