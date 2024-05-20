import crypto from 'crypto';

const algorithm = 'aes-256-ecb';
const key = Buffer.from(process.env.ENCRYPTION_KEY ?? 'qIIjmnjWZbexkGa3a2VSu8pd3ydvlHS6kcs+GDyY2hw=', 'base64');

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
