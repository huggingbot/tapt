import { logger } from 'firebase-functions';

/**
 * handle errors within firebase functions
 * @param {Response} res Express Response Object to handle response
 * @param {unknown} e Error object thrown
 */
export function handleError(e: unknown) {
  const error = (e as Error)?.message || 'Unexpected error';
  logger.error('error during function invocation:', error);
}
