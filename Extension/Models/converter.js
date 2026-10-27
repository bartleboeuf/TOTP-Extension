async function parse2fas(str) {
  const parsed = JSON.parse(str);
  var accs = parsed.services;

  if(!accs.length){
    const password = window.prompt("Enter Password of 2FAS backup:");
    accs = await decryptEncrypted2fas(parsed.servicesEncrypted, password);
  }

  var accounts = [];

  accs.forEach(a => {
    var acc = new Account(
        a.name, 
        a.secret, 
        a.otp.label || a.name, 
        a.otp.account || a.name, 
        a.otp.issuer, 
        Number(a.otp.digits) || 6, 
        normalizeAlgo(a.otp.algorithm) || 'SHA-1', 
        a.otp.tokenType, 
        a.otp.tokenType === 'HOTP' ? Number(a.counter) || 0 : undefined, 
        Number(a.otp.period || a.otp.interval) || (a.type === 'hotp' ? 0 : 30),
        [a.image, a.imageUrl, a.icon].find(value => typeof value === 'string')
    );
    if(a.otp.tokenType !== "STEAM"){
      accounts.push(acc);
    }
  });
  return accounts;
}

function base64Decode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g,'');
    while (str.length % 4) str += '=';
    return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function decryptEncrypted2fas(str, password) {
  try {
      const parts = str.split(':');
      if(parts.length !== 3) throw new Error("servicesEncrypted erwartet 3 Teile (cipher:salt:iv)");

      const cipherWithTagBytes = base64Decode(parts[0]);
      const saltBytes           = base64Decode(parts[1]);
      const ivBytes             = base64Decode(parts[2]);

      const tagLength = 16;
      const authTagBytes = cipherWithTagBytes.slice(-tagLength);
      const cipherBytes   = cipherWithTagBytes.slice(0, cipherWithTagBytes.length - tagLength);

      // PBKDF2 Key
      const passwordKey = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(password),
          "PBKDF2",
          false,
          ["deriveKey"]
      );

      const aesKey = await crypto.subtle.deriveKey(
          {name:"PBKDF2", salt:saltBytes, iterations:10000, hash:"SHA-256"},
          passwordKey,
          {name:"AES-GCM", length:256},
          false,
          ["decrypt"]
      );

      // AES-GCM decrypt
      const combined = new Uint8Array(cipherBytes.length + authTagBytes.length);
      combined.set(cipherBytes);
      combined.set(authTagBytes, cipherBytes.length);

      const decrypted = await crypto.subtle.decrypt(
          {name:"AES-GCM", iv: ivBytes},
          aesKey,
          combined
      );

      const decodedText = new TextDecoder().decode(decrypted);
      return JSON.parse(decodedText);

  } catch(err) {
      console.error(err);
  }
}

async function parseJson(str) {
   try {
    var importedAccounts = JSON.parse(str);

    if (!Array.isArray(importedAccounts)) {

      // Try to convert ProtonAuth format
      if (importedAccounts.version && Array.isArray(importedAccounts.entries)) {

        const uris = importedAccounts.entries.map(entry => entry.content.uri);
        importedAccounts = [];
        uris.forEach(async uri => {
          try {
            const acc = await parseOtpauth(uri);
            if (acc) importedAccounts.push(acc);
          } catch (e) {
            console.warn('Failed to parse otpauth URI from ProtonAuth entry:', e);
          }
        });
      }else if(importedAccounts.version && importedAccounts.salt && importedAccounts.content){
        // Trying to import encrypted protonauth
        window.alert("This seems to be an encrypted Proton Authenticator backup. Please use an unencrypted backup to import the accounts.");
      }else {
        throw new Error("wrong format: JSONhas to contain an array.");
      }
    }

    return importedAccounts;
  } catch (err) {
    console.error("error importing accounts:", err);
  }
}

function parseGoogleAuth(str) {
    try{
        const u = new URL(str);
        const b64 = u.searchParams.get('data');
        if (!b64) throw new Error('No data in migration qr-code');

        const uris = parseOtpauthMigration(b64);
        if (!uris || !uris.length) throw new Error('Keine Accounts in Migration-Daten gefunden');

        return uris; // [] if no acconts found, array of Account objects if found

    } catch (e) {
        console.error('error parsing google auth migration data:', e);
        return null;
    }
}

/**
 * Takes an otpauth URI and converts it to an Account object.
 * @param {*} uri string with otpauth URI
 * @returns Account object or null if parsing failed
 */
async function parseOtpauth(uri) {
    try {
        const u = new URL(uri);
        if (u.protocol !== 'otpauth:') return null;
        const type = u.hostname; // totp or hotp
        const path = decodeURIComponent(u.pathname).replace(/^\//, '');
        const label = path; // often "Issuer:Account"
        const params = Object.fromEntries(u.searchParams.entries());
        const secret = params.secret;
        if (!secret) return null;
        const issuer = params.issuer || (label.includes(':') ? label.split(':')[0] : undefined);
        const account = label.includes(':') ? label.split(':').slice(1).join(':') : label;

        var acc = new Account(
            issuer ? issuer + ' ' + account : label, 
            secret, 
            label, 
            account, 
            issuer, 
            Number(params.digits) || 6, 
            normalizeAlgo(params.algorithm) || 'SHA-1', 
            type, 
            type === 'hotp' ? Number(params.counter) || 0 : undefined, 
            Number(params.period || params.interval) || (type === 'hotp' ? 0 : 30),
            params.image || params.imageUrl || params.icon
        );

        return acc;
    } catch (e) {
        console.error('Failed to parse otpauth URI:', e);
        return null;
    }
}

function normalizeAlgo(a) {
  if (!a) return null;
  a = String(a).toUpperCase().replace('-', '');
  if (a.includes('SHA1')) return 'SHA-1';
  if (a.includes('SHA224')) return 'SHA-224';
  if (a.includes('SHA256')) return 'SHA-256';
  if (a.includes('SHA384')) return 'SHA-384';
  if (a.includes('SHA512')) return 'SHA-512';
  return null;
}

// ------------------ Google otpauth-migration Parser ------------------
function base64UrlToBase64(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return s;
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function readVarint(bytes, offset) {
  let result = 0;
  let shift = 0;
  let i = 0;
  while (offset + i < bytes.length) {
    const b = bytes[offset + i];
    result |= (b & 0x7f) << shift;
    i++;
    if (!(b & 0x80)) break;
    shift += 7;
  }
  return { value: result, length: i };
}

function base32Encode(bytes) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, output = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

function parseOtpauthMigration(b64data) {
  try {
    const b64 = base64UrlToBase64(b64data);
    const bytes = base64ToBytes(b64);
    let pos = 0;
    const accounts = [];
    while (pos < bytes.length) {
      const key = bytes[pos++];
      const field = key >> 3;
      const wt = key & 7;
      if (field === 1 && wt === 2) {
        const lenInfo = readVarint(bytes, pos);
        pos += lenInfo.length;
        const msgLen = lenInfo.value;
        const msgBytes = bytes.subarray(pos, pos + msgLen);
        pos += msgLen;
        // parse OTPParameters message
        const acc = {};
        let p = 0;
        while (p < msgBytes.length) {
          const k = msgBytes[p++];
          const f = k >> 3;
          const w = k & 7;
          if (f === 1 && w === 2) {
            const li = readVarint(msgBytes, p);
            p += li.length;
            const slen = li.value;
            acc.secret = msgBytes.subarray(p, p + slen);
            p += slen;
          } else if (f === 2 && w === 2) {
            const li = readVarint(msgBytes, p);
            p += li.length;
            const slen = li.value;
            const s = new TextDecoder().decode(msgBytes.subarray(p, p + slen));
            acc.name = s;
            p += slen;
          } else if (f === 3 && w === 2) {
            const li = readVarint(msgBytes, p);
            p += li.length;
            const slen = li.value;
            const s = new TextDecoder().decode(msgBytes.subarray(p, p + slen));
            acc.issuer = s;
            p += slen;
          } else if (f === 4 && w === 0) {
            const vi = readVarint(msgBytes, p);
            acc.algorithm = vi.value;
            p += vi.length;
          } else if (f === 5 && w === 0) {
            const vi = readVarint(msgBytes, p);
            acc.digits = vi.value;
            p += vi.length;
          } else if (f === 6 && w === 0) {
            const vi = readVarint(msgBytes, p);
            acc.type = vi.value;
            p += vi.length;
          } else if (f === 7 && w === 0) {
            const vi = readVarint(msgBytes, p);
            acc.counter = vi.value;
            p += vi.length;
          } else {
            // skip unknown
            if (w === 0) { const vi = readVarint(msgBytes, p); p += vi.length; }
            else if (w === 1) { p += 8; }
            else if (w === 2) { const li = readVarint(msgBytes, p); p += li.length + li.value; }
            else if (w === 5) { p += 4; }
            else break;
          }
        }
        // convert secret to base32
        if (acc.secret) {
          acc.secret = base32Encode(acc.secret);
        }
        // map enums to strings
        const algMap = {1: 'SHA1', 2: 'SHA256', 3: 'SHA512', 4: 'SHA384'};
        const typeMap = {1: 'HOTP', 2: 'TOTP'};
        const digitsMap = {1: 6, 2: 8};
        const algo = algMap[acc.algorithm] || 'SHA1';
        const type = typeMap[acc.type] || 'TOTP';
        const digits = digitsMap[acc.digits] || (acc.digits || 6);

        const issuer = acc.issuer || '';
        const name = acc.name || '';
        const label = issuer ? issuer + ':' + name : name;

        var accSingle = new Account(
            name, 
            acc.secret,
            label,
            name,
            issuer,
            digits,
            normalizeAlgo(algo) || 'SHA-1',
            type,
            acc.counter,
            30
        );

        accounts.push(accSingle);
      } else {
        // skip other fields
        if (wt === 0) {
          const vi = readVarint(bytes, pos);
          pos += vi.length;
        } else if (wt === 1) {
          pos += 8;
        } else if (wt === 2) {
          const li = readVarint(bytes, pos);
          pos += li.length + li.value;
        } else if (wt === 5) {
          pos += 4;
        } else {
          break;
        }
      }
    }
    return accounts;
  } catch (e) {
    console.warn('parseOtpauthMigration failed', e);
    return [];
  }
}