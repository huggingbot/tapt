interface RetryOptions {
  retries?: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  retries: 2,
};

export async function retry<T>(func: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries } = Object.assign({}, DEFAULT_RETRY_OPTIONS, options);
  try {
    return await func();
  } catch (error) {
    if (retries && retries > 0) {
      return retry(func, { retries: retries - 1 });
    } else {
      throw error;
    }
  }
}
