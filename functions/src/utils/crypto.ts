import { createCipheriv, createDecipheriv } from 'crypto';

const algorithm = 'aes-256-ecb';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error('invalid or missing ENCRYPTION_KEY');
}
const key = Buffer.from(ENCRYPTION_KEY, 'base64');

/**
 * Encrypt private key with ENCRYPTION_KEY from the env
 * @param {string} val - value to be encrypted
 * @return {string} encrypted private key
 */
export function encrypt(val: string): string {
  const cipher = createCipheriv(algorithm, key, null);
  let encrypted = cipher.update(val, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

/**
 * Decrypt encrypted cipher text with ENCRYPTION_KEY
 * @param {string} cipher - encrypted cipher text
 * @return {string} decrypted plain text
 */
export function decrypt(cipher: string): string {
  const decipher = createDecipheriv(algorithm, key, null);
  let decrypted = decipher.update(cipher, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
