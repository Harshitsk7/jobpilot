import crypto from 'crypto';
import { config } from '../lib/config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha512');
}

function getSecret(): string {
  const secret = config.encryptionSecret;
  if (!secret || secret.length < 32) {
    throw new Error(
      'ENCRYPTION_SECRET must be set in .env (min 32 characters) for credential storage'
    );
  }
  return secret;
}

export function encrypt(plaintext: string): string {
  const secret = getSecret();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(secret, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return [
    salt.toString('hex'),
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted,
  ].join(':');
}

export function decrypt(encryptedPayload: string): string {
  const secret = getSecret();
  const [saltHex, ivHex, authTagHex, encrypted] = encryptedPayload.split(':');
  if (!saltHex || !ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted payload');
  }
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = deriveKey(secret, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export async function tryKeytarStore(service: string, account: string, secret: string): Promise<boolean> {
  try {
    const keytar = await import('keytar');
    await keytar.setPassword(service, account, secret);
    return true;
  } catch {
    return false;
  }
}

export async function tryKeytarGet(service: string, account: string): Promise<string | null> {
  try {
    const keytar = await import('keytar');
    return keytar.getPassword(service, account);
  } catch {
    return null;
  }
}
