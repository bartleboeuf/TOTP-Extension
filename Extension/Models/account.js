class Account {
  name;
  secret;
  label;
  account;
  issuer;
  digits;
  algorithm;
  type;
  counter;
  period;
  image;
  constructor(name, secret, label, account, issuer, digits, algorithm, type, counter, period, image) {
    this.name = name;
    this.secret = secret;
    this.label = label;
    this.account = account;
    this.issuer = issuer;
    this.digits = digits;
    this.algorithm = algorithm;
    this.type = type;
    this.counter = counter;
    this.period = period;
    this.image = image;
  }
}

async function saveAccounts(accounts, password) {
  if(!password){
    await browser.storage.local.set({ accounts });
    return;
  }
  
  const encryptedAccounts = await encrypt(JSON.stringify(accounts), password);
  
  await browser.storage.local.set({ accounts: encryptedAccounts });
}

async function loadAccounts(password) {
  const { accounts } = await browser.storage.local.get("accounts");
  if(!accounts){
    return [];
  }

  if(Array.isArray(accounts)){
    if(password){
      await saveAccounts(accounts, password);
    }
    return accounts;
  }
  if(!password){
    throw new Error("A master password is required to unlock the account vault");
  }

  const decrypted = accounts.version === 2
    ? await decrypt(accounts, password)
    : await loadLegacyAccounts(accounts);
  const loadedAccounts = JSON.parse(decrypted);

  if(accounts.version !== 2){
    const stagedCiphertext = await encrypt(JSON.stringify(loadedAccounts), password);
    await browser.storage.local.set({ accountsMigration: stagedCiphertext });
    const { accountsMigration } = await browser.storage.local.get("accountsMigration");
    const verifiedAccounts = JSON.parse(await decrypt(accountsMigration, password));
    if(JSON.stringify(verifiedAccounts) !== JSON.stringify(loadedAccounts)){
      throw new Error("The migrated account vault could not be verified");
    }
    await browser.storage.local.set({ accounts: accountsMigration });
    await browser.storage.local.remove("accountsMigration");
  }
  return loadedAccounts;
}

async function loadLegacyAccounts(encryptedAccounts) {
  const { masterPassword } = await browser.storage.local.get("masterPassword");
  if(!masterPassword || !masterPassword.hash){
    throw new Error("The legacy account vault cannot be migrated without its password verifier");
  }
  return decrypt(encryptedAccounts, masterPassword.hash);
}