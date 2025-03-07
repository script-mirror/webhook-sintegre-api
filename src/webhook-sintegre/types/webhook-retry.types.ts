export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes

export interface RetryInfo {
  retryCount: number;
  retryHistory: Date[];
  nextRetryAt: Date | null;
  downloadStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'PROCESSED';
}

export interface RetryUpdateData extends RetryInfo {
  downloadStatus: 'FAILED';
  errorMessage: string;
}
