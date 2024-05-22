import { logger } from 'firebase-functions';
import { Response } from 'express';

/**
 * handle errors within firebase functions
 * @param {Response} res Express Response Object to handle response
 * @param {unknown} e Error object thrown
 */
export function handleErrorResponse(res: Response, e: unknown) {
  logger.error('error tracking transactions', e);
  const error = (e as Error)?.message || 'Unexpected error';
  res.json({ error });
}
