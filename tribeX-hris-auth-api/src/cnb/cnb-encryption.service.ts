import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';

@Injectable()
export class CnbEncryptionService {
  private readonly logger = new Logger(CnbEncryptionService.name);
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly key: Buffer | null;

  constructor() {
    const keyHex = process.env.CNB_ENCRYPTION_KEY;
    if (keyHex && keyHex.length === 64) {
      this.key = Buffer.from(keyHex, 'hex');
    } else {
      this.logger.warn(
        'CNB_ENCRYPTION_KEY not set or invalid (must be 64 hex chars = 32 bytes). ' +
          'Sensitive C&B fields will be stored as plaintext.',
      );
      this.key = null;
    }
  }

  encrypt(plaintext: string): string {
    if (!this.key) return plaintext;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    if (!this.key) return ciphertext;
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      // Legacy plaintext — return as-is
      return ciphertext;
    }
    try {
      const [ivHex, tagHex, encHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const enc = Buffer.from(encHex, 'hex');
      const decipher = crypto.createDecipheriv(this.ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(enc).toString('utf8') + decipher.final('utf8');
    } catch {
      // If decryption fails (e.g., corrupted or legacy data), return original
      return ciphertext;
    }
  }

  encryptNumber(value: number): string {
    return this.encrypt(String(value));
  }

  decryptToNumber(ciphertext: string): number {
    return parseFloat(this.decrypt(ciphertext)) || 0;
  }
}
