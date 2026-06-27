import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;

/**
 * Băm mật khẩu bằng scrypt (không phụ thuộc package ngoài theo tinh thần 5S - SEIRI).
 * Định dạng lưu: <saltHex>:<hashHex>.
 */
export const hashPassword = (plain: string): string => {
  const salt = randomBytes(16);
  const derived = scryptSync(plain, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
};

export const verifyPassword = (plain: string, stored: string): boolean => {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const derived = scryptSync(plain, Buffer.from(saltHex, 'hex'), KEY_LENGTH);
  const expected = Buffer.from(hashHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
};
