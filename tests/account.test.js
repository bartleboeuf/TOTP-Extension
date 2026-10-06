/**
 * Unit Tests for Account Model & Storage Operations (account.js).
 */

describe('Account Model & Storage', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.session.clear();
  });

  describe('Account Instantiation', () => {
    it('should correctly set all account properties', () => {
      const acc = new Account(
        'GitHub user',
        'JBSWY3DPEHPK3PXP',
        'GitHub:user',
        'user',
        'GitHub',
        6,
        'SHA-1',
        'totp',
        0,
        30
      );

      expect(acc.name).toBe('GitHub user');
      expect(acc.secret).toBe('JBSWY3DPEHPK3PXP');
      expect(acc.label).toBe('GitHub:user');
      expect(acc.account).toBe('user');
      expect(acc.issuer).toBe('GitHub');
      expect(acc.digits).toBe(6);
      expect(acc.algorithm).toBe('SHA-1');
      expect(acc.type).toBe('totp');
      expect(acc.counter).toBe(0);
      expect(acc.period).toBe(30);
    });
  });

  describe('Account Storage (saveAccounts & loadAccounts)', () => {
    it('should preserve an imported image URL without requiring host permissions', async () => {
      const accountsList = [
        new Account('GitHub', 'JBSWY3DPEHPK3PXP', 'GitHub:user', 'user', 'GitHub', 6, 'SHA-1', 'totp', 0, 30, 'https://example.com/logo.png')
      ];

      await saveAccounts(accountsList, null);
      const loaded = await loadAccounts(null);

      expect(loaded[0].image).toBe('https://example.com/logo.png');
    });

    it('should save and load accounts without encryption when password is null', async () => {
      const accountsList = [
        new Account('Google', 'JBSWY3DPEHPK3PXP', 'Google:u', 'u', 'Google', 6, 'SHA-1', 'totp', 0, 30),
        new Account('GitHub', 'HXDMVJECJJWSRB3H', 'GitHub:u', 'u', 'GitHub', 6, 'SHA-1', 'totp', 0, 30)
      ];

      await saveAccounts(accountsList, null);
      const loaded = await loadAccounts(null);

      expect(loaded).toHaveLength(2);
      expect(loaded[0].name).toBe('Google');
      expect(loaded[1].name).toBe('GitHub');
    });

    it('should save and load accounts with encryption when master password hash is provided', async () => {
      const accountsList = [
        new Account('Proton', 'JBSWY3DPEHPK3PXP', 'Proton:u', 'u', 'Proton', 6, 'SHA-256', 'totp', 0, 30)
      ];

      const pwHash = await hash('MyMasterKey123');
      await saveAccounts(accountsList, pwHash);

      // Verify raw storage contains encrypted payload object (not plaintext JSON array)
      const rawStored = await browser.storage.local.get('accounts');
      expect(rawStored.accounts.encrypted).toBeDefined();
      expect(rawStored.accounts.iv).toBeDefined();
      expect(rawStored.accounts.salt).toBeDefined();

      // Verify decrypted accounts match original
      const decryptedAccounts = await loadAccounts(pwHash);
      expect(decryptedAccounts).toHaveLength(1);
      expect(decryptedAccounts[0].name).toBe('Proton');
      expect(decryptedAccounts[0].secret).toBe('JBSWY3DPEHPK3PXP');
    });

    it('should return empty array when no accounts are saved', async () => {
      const loaded = await loadAccounts(null);
      expect(loaded).toEqual([]);
    });
  });
});