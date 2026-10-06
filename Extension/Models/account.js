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
  
  accounts = JSON.stringify(accounts);

  var encryptedAccounts = await encrypt(accounts, password.hash);
  
  await browser.storage.local.set({ accounts: encryptedAccounts });
}

async function loadAccounts(password) {
  if(!password){
    return browser.storage.local.get("accounts").then(result => {
    return result.accounts || [];
    });
  }
  encAccounts = await browser.storage.local.get("accounts");
  if(!encAccounts.accounts){
    return [];
  }
  return JSON.parse(await decrypt(encAccounts.accounts, password.hash));
}