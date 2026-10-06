/**
 * Unit Tests for Converter & Import Functions (converter.js).
 */

describe('Converter & Import Utilities', () => {
  describe('normalizeAlgo()', () => {
    it('should normalize various SHA casing and formatting', () => {
      expect(normalizeAlgo('sha1')).toBe('SHA-1');
      expect(normalizeAlgo('SHA-1')).toBe('SHA-1');
      expect(normalizeAlgo('SHA1')).toBe('SHA-1');
      expect(normalizeAlgo('sha256')).toBe('SHA-256');
      expect(normalizeAlgo('SHA-256')).toBe('SHA-256');
      expect(normalizeAlgo('SHA256')).toBe('SHA-256');
      expect(normalizeAlgo('SHA384')).toBe('SHA-384');
      expect(normalizeAlgo('sha-512')).toBe('SHA-512');
      expect(normalizeAlgo('SHA512')).toBe('SHA-512');
    });

    it('should return null for unsupported algorithms or falsy input', () => {
      expect(normalizeAlgo('MD5')).toBeNull();
      expect(normalizeAlgo('')).toBeNull();
      expect(normalizeAlgo(null)).toBeNull();
      expect(normalizeAlgo(undefined)).toBeNull();
    });
  });

  describe('Base64 & Base32 Conversions', () => {
    it('should convert URL-safe base64 to standard base64 with padding', () => {
      // '-' -> '+', '_' -> '/', padding with '='
      expect(base64UrlToBase64('ab-_cd')).toBe('ab+/cd==');
    });

    it('should decode base64 string to Uint8Array', () => {
      const bytes = base64ToBytes('SGVsbG8='); // "Hello"
      expect(bytes).toHaveLength(5);
      expect(new TextDecoder().decode(bytes)).toBe('Hello');
    });

    it('should encode Uint8Array bytes to Base32 string', () => {
      const bytes = new TextEncoder().encode('Hello');
      expect(base32Encode(bytes)).toBe('JBSWY3DP');
    });
  });

  describe('readVarint()', () => {
    it('should decode single-byte varints', () => {
      const bytes = new Uint8Array([0x01, 0x2A]);
      expect(readVarint(bytes, 0)).toEqual({ value: 1, length: 1 });
      expect(readVarint(bytes, 1)).toEqual({ value: 42, length: 1 });
    });

    it('should decode multi-byte varints', () => {
      // 300 = 0xAC 0x02
      const bytes = new Uint8Array([0xAC, 0x02]);
      expect(readVarint(bytes, 0)).toEqual({ value: 300, length: 2 });
    });
  });

  describe('parseOtpauth()', () => {
    it('should parse standard TOTP URI correctly', async () => {
      const uri = 'otpauth://totp/GitHub:octocat?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA1&digits=6&period=30&image=https%3A%2F%2Fexample.com%2Fgithub.png';
      const acc = await parseOtpauth(uri);

      expect(acc).toBeDefined();
      expect(acc.name).toBe('GitHub octocat');
      expect(acc.secret).toBe('JBSWY3DPEHPK3PXP');
      expect(acc.issuer).toBe('GitHub');
      expect(acc.account).toBe('octocat');
      expect(acc.digits).toBe(6);
      expect(acc.algorithm).toBe('SHA-1');
      expect(acc.type).toBe('totp');
      expect(acc.period).toBe(30);
      expect(acc.image).toBe('https://example.com/github.png');
    });

    it('should parse TOTP URI with custom parameters', async () => {
      const uri = 'otpauth://totp/CustomCorp:admin?secret=HXDMVJECJJWSRB3H&issuer=CustomCorp&algorithm=SHA256&digits=8&period=60';
      const acc = await parseOtpauth(uri);

      expect(acc).toBeDefined();
      expect(acc.name).toBe('CustomCorp admin');
      expect(acc.issuer).toBe('CustomCorp');
      expect(acc.digits).toBe(8);
      expect(acc.algorithm).toBe('SHA-256');
      expect(acc.period).toBe(60);
    });

    it('should parse HOTP URI with counter', async () => {
      const uri = 'otpauth://hotp/Bank:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Bank&counter=42';
      const acc = await parseOtpauth(uri);

      expect(acc).toBeDefined();
      expect(acc.type).toBe('hotp');
      expect(acc.counter).toBe(42);
      expect(acc.period).toBe(0);
    });

    it('should handle URL-encoded characters in account label', async () => {
      const uri = 'otpauth://totp/My%20Company%3Atest%40domain.com?secret=JBSWY3DPEHPK3PXP';
      const acc = await parseOtpauth(uri);

      expect(acc).toBeDefined();
      expect(acc.issuer).toBe('My Company');
      expect(acc.account).toBe('test@domain.com');
    });

    it('should return null for non-otpauth protocol', async () => {
      expect(await parseOtpauth('https://example.com/totp?secret=JBSWY3DPEHPK3PXP')).toBeNull();
    });

    it('should return null when secret query parameter is missing', async () => {
      expect(await parseOtpauth('otpauth://totp/Test:user?issuer=Test')).toBeNull();
    });

    it('should return null for invalid URL string', async () => {
      expect(await parseOtpauth('invalid-uri')).toBeNull();
    });
  });

  describe('Google Authenticator Migration (otpauth-migration)', () => {
    // Helper to generate a minimal Protobuf payload matching Google Authenticator migration format
    function createTestMigrationPayload() {
      const secretBytes = [0x48, 0x65, 0x6c, 0x6c, 0x6f]; // "Hello" -> Base32 "JBSWY3DP"
      const nameBytes = Array.from(new TextEncoder().encode('user@gmail.com'));
      const issuerBytes = Array.from(new TextEncoder().encode('Google'));

      const otpParamBytes = [
        (1 << 3) | 2, secretBytes.length, ...secretBytes,
        (2 << 3) | 2, nameBytes.length, ...nameBytes,
        (3 << 3) | 2, issuerBytes.length, ...issuerBytes,
        (4 << 3) | 0, 1, // SHA1
        (5 << 3) | 0, 1, // 6 digits
        (6 << 3) | 0, 2  // TOTP
      ];

      const outerBytes = [
        (1 << 3) | 2, otpParamBytes.length, ...otpParamBytes
      ];

      let binStr = '';
      for (const b of outerBytes) binStr += String.fromCharCode(b);
      return btoa(binStr);
    }

    it('should parse protobuf migration payload via parseOtpauthMigration()', () => {
      const b64 = createTestMigrationPayload();
      const accounts = parseOtpauthMigration(b64);

      expect(accounts).toBeDefined();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].name).toBe('user@gmail.com');
      expect(accounts[0].issuer).toBe('Google');
      expect(accounts[0].secret).toBe('JBSWY3DP');
      expect(accounts[0].digits).toBe(6);
      expect(accounts[0].type).toBe('TOTP');
    });

    it('should parse full otpauth-migration:// URL via parseGoogleAuth()', () => {
      const b64 = createTestMigrationPayload();
      const migrationUrl = `otpauth-migration://offline?data=${encodeURIComponent(b64)}`;
      const accounts = parseGoogleAuth(migrationUrl);

      expect(accounts).toBeDefined();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].issuer).toBe('Google');
    });

    it('should return null for migration URL without data query parameter', () => {
      expect(parseGoogleAuth('otpauth-migration://offline')).toBeNull();
    });
  });

  describe('2FAS Backup Import (parse2fas)', () => {
    it('should parse unencrypted 2FAS JSON and filter out unsupported token types', async () => {
      const twoFasJson = JSON.stringify({
        services: [
          {
            name: 'GitHub',
            secret: 'JBSWY3DPEHPK3PXP',
            otp: {
              label: 'GitHub',
              account: 'octocat',
              issuer: 'GitHub',
              digits: 6,
              algorithm: 'SHA1',
              tokenType: 'TOTP',
              period: 30
            },
            image: 'https://example.com/github.png'
          },
          {
            name: 'Steam Account',
            secret: 'STEAMSECRET',
            otp: { tokenType: 'STEAM' }
          }
        ]
      });

      const accounts = await parse2fas(twoFasJson);

      expect(accounts).toBeDefined();
      expect(accounts).toHaveLength(1); // Steam is filtered out
      expect(accounts[0].name).toBe('GitHub');
      expect(accounts[0].secret).toBe('JBSWY3DPEHPK3PXP');
      expect(accounts[0].account).toBe('octocat');
      expect(accounts[0].issuer).toBe('GitHub');
      expect(accounts[0].type).toBe('TOTP');
      expect(accounts[0].image).toBe('https://example.com/github.png');
    });

    it('should parse HOTP service from 2FAS JSON with counter', async () => {
      const twoFasJson = JSON.stringify({
        services: [
          {
            name: 'Bank HOTP',
            secret: 'JBSWY3DPEHPK3PXP',
            counter: 5,
            otp: {
              label: 'Bank',
              account: 'user',
              issuer: 'Bank',
              digits: 6,
              algorithm: 'SHA1',
              tokenType: 'HOTP'
            }
          }
        ]
      });

      const accounts = await parse2fas(twoFasJson);
      expect(accounts).toHaveLength(1);
      expect(accounts[0].counter).toBe(5);
      expect(accounts[0].type).toBe('HOTP');
    });
  });

  describe('JSON & Proton Authenticator Import (parseJson)', () => {
    it('should parse standard JSON array of accounts', async () => {
      const rawJson = JSON.stringify([
        {
          name: 'Account 1',
          secret: 'JBSWY3DPEHPK3PXP',
          digits: 6,
          algorithm: 'SHA-1',
          type: 'totp',
          period: 30,
          image: 'https://example.com/account.png'
        }
      ]);

      const accounts = await parseJson(rawJson);
      expect(accounts).toBeDefined();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].name).toBe('Account 1');
      expect(accounts[0].secret).toBe('JBSWY3DPEHPK3PXP');
      expect(accounts[0].image).toBe('https://example.com/account.png');
    });

    it('should parse Proton Authenticator JSON format with entries', async () => {
      const protonJson = JSON.stringify({
        version: 1,
        entries: [
          {
            content: {
              uri: 'otpauth://totp/Proton:user@pm.me?secret=JBSWY3DPEHPK3PXP&issuer=Proton'
            }
          }
        ]
      });

      const accounts = await parseJson(protonJson);
      expect(accounts).toBeDefined();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].issuer).toBe('Proton');
      expect(accounts[0].account).toBe('user@pm.me');
    });
  });
});