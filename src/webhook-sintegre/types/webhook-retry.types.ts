export const MAX_RETRY_ATTEMPTS = 5;
export const RETRY_DELAY_MS = 60000; // 1 minute in milliseconds

export interface RetryInfo {
  retryCount: number;
  retryHistory: Date[];
  nextRetryAt?: Date;
}

export interface RetryUpdateData extends RetryInfo {
  downloadStatus: 'FAILED';
  errorMessage: string;
}
