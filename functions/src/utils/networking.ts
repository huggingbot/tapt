import { logger } from 'firebase-functions';
import { ApiResponse } from './types';

export async function makeNetworkRequest<T>(
  url: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, unknown>,
): Promise<T> {
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
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
        body,
        err: (e as Error).message || 'unknown error',
      })}`,
    );
    throw e;
  }
}
