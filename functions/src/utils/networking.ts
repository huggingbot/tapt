import { logger } from 'firebase-functions';
import { ApiResponse } from './types';

export async function makeNetworkRequest<T>(
  url: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, unknown>,
): Promise<T> {
  let status = 500;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    status = res.status;
    const jsonResp: ApiResponse<T> = await res.json();
    if (!jsonResp.data || !jsonResp.success) {
      throw new Error(`[${res.status}] Failed: ${jsonResp.message}`);
    }
    return jsonResp.data;
  } catch (e: unknown) {
    logger.error(
      `Error making network request: ${JSON.stringify({
        url,
        method,
        status,
        body,
        err: (e as Error).message || 'unknown error',
        stack: (e as Error).stack,
      })}`,
    );
    throw e;
  }
}
