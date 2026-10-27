const themeSelect = document.getElementById("themeSelect");
const fontSizeSelect = document.getElementById("fontSizeSelect");
const showNextCodeSelect = document.getElementById("showNextCodeSelect");
const showServiceImagesSelect = document.getElementById("showServiceImagesSelect");
const allowRemoteImagesSelect = document.getElementById("allowRemoteImagesSelect");
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
    const oldKey = await getSessionPassword();
    var newPW = prompt(browser.i18n.getMessage('enterNewPasswordText'));
    if (!newPW) return;
    await changePassword(oldKey, newPW);
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
    allowRemoteImagesSelect.value = (settings.allowRemoteImages === true).toString();
    useMasterPasswordSelect.value = settings.masterPasswordEnabled.toString();
});

async function saveSettings(){
    var settings = new Settings(
        themeSelect.value,
        fontSizeSelect.value,
        showNextCodeSelect.value === "true",
        useMasterPasswordSelect.value === "true",
        showServiceImagesSelect.value === "true",
        allowRemoteImagesSelect.value === "true",
    );

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
            const password = prompt(browser.i18n.getMessage('enterNewPasswordText'));
            if(password){
                await changePassword(undefined, password);
            }else{
                settings.masterPasswordEnabled = false;
                useMasterPasswordSelect.value = "false";
            }
        }else{ // Masterpassword got deactivated
            const sessionKey = await getSessionPassword();
            const accounts = await loadAccounts(sessionKey);
            await browser.storage.local.set({ accounts, masterPasswordEnabled: false });
            await browser.storage.local.remove("masterPassword");
            await browser.storage.session.remove(["isAuthenticated", "sessionKey", "sessionPassword"]);
        }
    }

    await browser.storage.local.set({settings});
}