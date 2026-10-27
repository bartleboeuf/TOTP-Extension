/**
 * Unit Tests for Encryption & Authentication Logic (encryption.js).
 */

describe('Encryption & Master Password Authentication', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.session.clear();
  });

  describe('AES-GCM Encryption & Decryption (encrypt & decrypt)', () => {
    it('should encrypt and decrypt a plaintext string correctly (round-trip)', async () => {
      const plaintext = 'Secret TOTP Account Data: JBSWY3DPEHPK3PXP';
      const password = 'StrongPassword123!';

      const encryptedData = await encrypt(plaintext, password);

      expect(encryptedData).toBeDefined();
      expect(Array.isArray(encryptedData.encrypted)).toBe(true);
      expect(encryptedData.iv).toHaveLength(12);
      expect(encryptedData.salt).toHaveLength(16);

      const decrypted = await decrypt(encryptedData, password);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt complex Unicode and JSON strings', async () => {
      const payload = JSON.stringify({
        accounts: [{ name: '🔒 Test & Émile 🚀', secret: 'MZXW6===' }]
      });
      const password = '🔑 Master Key 2026';

      const encryptedData = await encrypt(payload, password);
      const decrypted = await decrypt(encryptedData, password);

      expect(decrypted).toBe(payload);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(payload));
    });

    it('should reject decryption when an incorrect password is provided', async () => {
      const encryptedData = await encrypt('Sensitive payload', 'correct-password');
      await expect(decrypt(encryptedData, 'wrong-password')).rejects.toThrow();
    });

    it('should generate unique IV and salt for identical plaintexts (randomized cryptography)', async () => {
      const text = 'Identical payload';
      const password = 'IdenticalPassword';

      const enc1 = await encrypt(text, password);
      const enc2 = await encrypt(text, password);

      expect(enc1.iv).not.toEqual(enc2.iv);
      expect(enc1.salt).not.toEqual(enc2.salt);
      expect(enc1.encrypted).not.toEqual(enc2.encrypted);
    });
  });

  describe('PBKDF2 Password Hashing (hash)', () => {
    it('should generate a 512-bit hash (128 hex chars) and 16-byte salt (32 hex chars)', async () => {
      const result = await hash('myMasterPassword');

      expect(result).toBeDefined();
      expect(result.salt).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(result.hash).toHaveLength(128); // 64 bytes = 128 hex chars
    });

    it('should generate unique salts on successive calls for the same password', async () => {
      const res1 = await hash('password');
      const res2 = await hash('password');

      expect(res1.salt).not.toBe(res2.salt);
      expect(res1.hash).not.toBe(res2.hash);
    });
  });

  describe('Master Password Storage & Authentication', () => {
    it('should save hashed master password to local storage', async () => {
      await saveMasterPassword('SuperSecret123');

      const stored = await browser.storage.local.get('masterPassword');
      expect(stored.masterPassword).toBeDefined();
      expect(stored.masterPassword.hash).toBeDefined();
      expect(stored.masterPassword.salt).toBeDefined();
    });

    it('should verify the correct master password successfully', async () => {
      await saveMasterPassword('ValidPassword999');
      expect(await isMasterPassword('ValidPassword999')).toBe(true);
    });

    it('should reject an incorrect master password', async () => {
      await saveMasterPassword('ValidPassword999');
      expect(await isMasterPassword('WrongPassword')).toBe(false);
    });

    it('should change the vault password without using the stored verifier as its key', async () => {
      const oldPassword = 'OldMasterPassword';
      const oldRecord = await saveMasterPassword(oldPassword);
      const oldKey = await deriveVaultKey(oldPassword, oldRecord.vaultSalt);
      await browser.storage.local.set({ masterPasswordEnabled: true });
      await saveAccounts([
        new Account('Example', 'JBSWY3DPEHPK3PXP', 'Example:user', 'user', 'Example', 6, 'SHA-1', 'totp', 0, 30)
      ], oldKey);

      const newKey = await changePassword(oldKey, 'NewMasterPassword');
      const stored = await browser.storage.local.get(['masterPassword', 'accounts']);

      expect(await isMasterPassword('NewMasterPassword')).toBe(true);
      await expect(decrypt(stored.accounts, stored.masterPassword.hash)).rejects.toThrow();
      expect((await loadAccounts(newKey))[0].secret).toBe('JBSWY3DPEHPK3PXP');
    });

    it('should return false if no master password has been configured', async () => {
      expect(await isMasterPassword('SomePassword')).toBe(false);
    });

    it('should return false when checking an empty string', async () => {
      await saveMasterPassword('ValidPassword');
      expect(await isMasterPassword('')).toBe(false);
    });
  });
});