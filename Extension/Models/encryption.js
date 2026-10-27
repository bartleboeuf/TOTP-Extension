async function encrypt(text, password) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );

  return {
    version: 2,
    encrypted: Array.from(new Uint8Array(encrypted)),
    iv: Array.from(iv),
    salt: Array.from(salt)
  };
}

async function decrypt(encryptedData, password) {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  const { encrypted, iv, salt } = encryptedData;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(salt),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    new Uint8Array(encrypted)
  );
  return dec.decode(decrypted);
}

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new Error("Invalid cryptographic salt");
  }
  return new Uint8Array(hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
}

async function derivePasswordHash(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-512"
    },
    key,
    512
  );
  return bytesToHex(new Uint8Array(derivedBits));
}

async function hash(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    salt: bytesToHex(salt),
    hash: await derivePasswordHash(password, salt)
  };
}

async function deriveVaultKey(password, vaultSalt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(vaultSalt),
      iterations: 100000,
      hash: "SHA-256"
    },
    key,
    256
  );
  return bytesToHex(new Uint8Array(derivedBits));
}

function createVaultSalt() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}

async function createMasterPasswordRecord(password) {
  if (!password) {
    throw new Error("A non-empty master password is required");
  }

  return {
    ...(await hash(password)),
    vaultSalt: createVaultSalt()
  };
}

async function saveMasterPassword(password) {
  const passwordRecord = await createMasterPasswordRecord(password);
  await browser.storage.local.set({ masterPassword: passwordRecord });
  return passwordRecord;
}

async function setMasterPassword() {
  const password = await setPassword();
  if (!password) {
    await browser.storage.local.set({ masterPasswordEnabled: false });
    await browser.storage.local.remove("masterPassword");
    await browser.storage.session.remove(["isAuthenticated", "sessionKey", "sessionPassword"]);
    return undefined;
  }

  const passwordRecord = await createMasterPasswordRecord(password);
  const sessionKey = await deriveVaultKey(password, passwordRecord.vaultSalt);
  const { accounts } = await browser.storage.local.get("accounts");
  const updates = {
    masterPassword: passwordRecord,
    masterPasswordEnabled: true
  };
  if (Array.isArray(accounts)) {
    updates.accounts = await encrypt(JSON.stringify(accounts), sessionKey);
  }
  await browser.storage.local.set(updates);
  await browser.storage.session.set({ isAuthenticated: true, sessionKey });
  return sessionKey;
}

async function isMasterPassword(password) {
  const { masterPassword } = await browser.storage.local.get("masterPassword");
  if (!password || !masterPassword || !masterPassword.hash || !masterPassword.salt) {
    return false;
  }

  const derivedHash = await derivePasswordHash(password, hexToBytes(masterPassword.salt));
  return derivedHash === masterPassword.hash;
}

async function getSessionPassword() {
  const { isInitialized } = await browser.storage.local.get("isInitialized");

  if (!isInitialized) {
    const sessionKey = await setMasterPassword();
    await browser.storage.local.set({ isInitialized: true });
    return sessionKey;
  }

  const { masterPasswordEnabled } = await browser.storage.local.get("masterPasswordEnabled");
  if (!masterPasswordEnabled) {
    return undefined;
  }

  const session = await browser.storage.session.get(["isAuthenticated", "sessionKey"]);
  if (session.isAuthenticated && session.sessionKey) {
    return session.sessionKey;
  }

  let password;
  while (true) {
    password = await setPassword();
    if (await isMasterPassword(password)) {
      break;
    }
  }

  const { masterPassword } = await browser.storage.local.get("masterPassword");
  if (!masterPassword.vaultSalt) {
    masterPassword.vaultSalt = createVaultSalt();
    await browser.storage.local.set({ masterPassword });
  }

  const sessionKey = await deriveVaultKey(password, masterPassword.vaultSalt);
  await loadAccounts(sessionKey);
  await browser.storage.session.set({ isAuthenticated: true, sessionKey });
  return sessionKey;
}

async function changePassword(oldKey, newPassword) {
  if (!newPassword) {
    throw new Error("A non-empty master password is required");
  }

  const { accounts } = await browser.storage.local.get("accounts");
  const decryptedAccounts = accounts
    ? await loadAccounts(oldKey)
    : [];
  const passwordRecord = await createMasterPasswordRecord(newPassword);
  const sessionKey = await deriveVaultKey(newPassword, passwordRecord.vaultSalt);

  const updates = {
    masterPassword: passwordRecord,
    masterPasswordEnabled: true
  };
  if (accounts) {
    updates.accounts = await encrypt(JSON.stringify(decryptedAccounts), sessionKey);
  }
  await browser.storage.local.set(updates);
  await browser.storage.session.set({ isAuthenticated: true, sessionKey });
  await browser.storage.session.remove("sessionPassword");
  return sessionKey;
}
