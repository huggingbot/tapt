import Buffer from 'node:buffer';
import crypto from 'node:crypto';

const algorithm = 'aes-256-ecb';
const key = Buffer.atob(Deno.env.get('ENCRYPTION_KEY') || '');

export const encryptPrivateKey = (privateKey: string) => {
  const cipher = crypto.createCipheriv(algorithm, key, null);
  let encrypted = cipher.update(privateKey, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
};

export const decryptPrivateKey = (encryptedPrivateKey: string) => {
  const decipher = crypto.createDecipheriv(algorithm, key, null);
  let decrypted = decipher.update(encryptedPrivateKey, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};
