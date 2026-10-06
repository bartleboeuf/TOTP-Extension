const themeSelect = document.getElementById("themeSelect");
const fontSizeSelect = document.getElementById("fontSizeSelect");
const showNextCodeSelect = document.getElementById("showNextCodeSelect");
const showServiceImagesSelect = document.getElementById("showServiceImagesSelect");
const useMasterPasswordSelect = document.getElementById("useMasterPasswordSelect");

const saveBtn = document.getElementById("saveBtn");
const changePwBtn = document.getElementById("changePwBtn");
const resetAddonBtn = document.getElementById("resetAddonBtn");

var useMasterPasswordChanged = false;

const popup = document.getElementById("popupOverlay");
const openBtn = document.getElementById("openPopup");
const closeBtn = document.getElementById("closePopup");

openBtn.addEventListener("click", (e) => {
  e.preventDefault();
  popup.style.display = "flex";
});

closeBtn.addEventListener("click", () => {
  popup.style.display = "none";
});
popup.addEventListener("click", (e) => {
  if (e.target === popup) {
    popup.style.display = "none";
  }
});

resetAddonBtn.addEventListener("click", async () => {
    await saveAccounts([], await getSessionPassword()); // Reset saved Accounts
    await createDefaultSettings();
    window.close();
});

saveBtn.addEventListener('click', saveSettings);

document.querySelectorAll('[data-i18n]').forEach(el => {
  const key = el.getAttribute('data-i18n');
  el.textContent = browser.i18n.getMessage(key);
});

changePwBtn.addEventListener('click', async () => {
    var oldPW = getSessionPassword();
    var newPW = prompt(browser.i18n.getMessage('enterNewPasswordText'));
    await changePassword(oldPW, newPW);
});

useMasterPasswordSelect.addEventListener('change', () => {
    if(useMasterPasswordSelect.value === "true"){
        changePwBtn.style.display = "block";
    }else{
        changePwBtn.style.display = "none";
    }
    useMasterPasswordChanged = true;
});

browser.storage.local.get("settings").then(async result => {

    var settings;
    if(!result.settings){
        settings = await createDefaultSettings();
    }else{
        settings = result.settings;
    }

    if(await isDarkMode()){
        document.body.classList.add("dark");   // Dark
    }

    switch (await getFontSize()){
        case "small":
        document.body.classList.add("small");
        break;
        case "medium":
        break;
        case "large":
        document.body.classList.add("large");
        break;
        default:
        break;
    }

    if(!settings.masterPasswordEnabled){
        changePwBtn.style.display = "none";
    }
        
    // TODO
    themeSelect.value = settings.theme;
    fontSizeSelect.value = settings.fontSize;
    showNextCodeSelect.value = settings.nextCode.toString();
    showServiceImagesSelect.value = (settings.showServiceImages !== false).toString();
    useMasterPasswordSelect.value = settings.masterPasswordEnabled.toString();
});

async function saveSettings(){
    var settings = new Settings(
        themeSelect.value,
        fontSizeSelect.value,
        showNextCodeSelect.value === "true",
        useMasterPasswordSelect.value === "true",
        showServiceImagesSelect.value === "true",
    );

    await browser.storage.local.set({settings : settings});

    if(await isDarkMode()){
        document.body.classList.add("dark");   // Dark
    } else{
        document.body.classList.remove("dark");
    }

    switch (settings.fontSize){
        case "small":
        document.body.classList.add("small");
        break;
        case "medium":
            document.body.classList.remove("small");
            document.body.classList.remove("large");
        break;
        case "large":
        document.body.classList.add("large");
        break;
        default:
        break;
    }

    if(useMasterPasswordChanged){
        var result = await browser.storage.local.get("masterPasswordEnabled");
        if(settings.masterPasswordEnabled && !result.masterPasswordEnabled){ // Masterpassword got  activated
            var password;
            do{
                password = prompt(browser.i18n.getMessage('enterNewPasswordText'));
            } while (!password);
            await changePassword(undefined, password);
            await browser.storage.local.set({ masterPasswordEnabled: true });
        }else{ // Masterpassword got deactivated

            var password = await getSessionPassword();

            await browser.storage.local.set({ masterPasswordEnabled: false });
            
            browser.storage.local.get("accounts").then(async accounts => {
                if(accounts.accounts){
                    var accs = await loadAccounts(password);
                    await saveAccounts(accs, undefined);
                }
            });
        }
    }
}