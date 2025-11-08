/**
 * Retry utility with exponential backoff
 * Used for Twilio API calls and other external services
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED']
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on last attempt
      if (attempt === opts.maxRetries) {
        throw error;
      }

      // Check if error is retryable
      const errorCode = error?.code || error?.status || '';
      const isRetryable = opts.retryableErrors.some(code => 
        errorCode.toString().includes(code) || 
        error?.message?.includes(code)
      );

      // Also retry Twilio rate limit errors (429)
      const isRateLimit = error?.status === 429 || error?.code === 20429;

      if (!isRetryable && !isRateLimit) {
        // Not a retryable error, throw immediately
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      );

      console.warn(
        `⚠️ [RETRY] Attempt ${attempt + 1}/${opts.maxRetries} failed, retrying in ${delay}ms...`,
        error?.message || error
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Retry Twilio API calls specifically
 */
export async function retryTwilioCall<T>(
  fn: () => Promise<T>,
  operation: string = 'Twilio operation'
): Promise<T> {
  return retryWithBackoff(fn, {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', '429']
  }).catch(error => {
    console.error(`❌ [TWILIO-RETRY] ${operation} failed after retries:`, error);
    throw error;
  });
}

