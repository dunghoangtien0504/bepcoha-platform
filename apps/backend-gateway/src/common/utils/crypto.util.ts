import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Mã hóa/giải mã API token của hệ thống bên thứ ba (Jira/GitLab) trước khi lưu DB.
 * Dùng CREDENTIAL_SECRET làm khóa gốc, băm SHA-256 thành khóa 32 byte cho AES-256-GCM.
 */
const deriveKey = (secret: string): Buffer => createHash('sha256').update(secret).digest();

export const encryptSecret = (plain: string, secret: string): string => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
};

export const decryptSecret = (payload: string, secret: string): string => {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Cấu trúc credential đã mã hóa không hợp lệ');
  }
  const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
};
