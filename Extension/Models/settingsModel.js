class Settings{
    theme;
    fontSize;
    nextCode;
    masterPasswordEnabled;
    showServiceImages;
    allowRemoteImages;
    constructor(theme, fontSize, nextCode, masterPasswordEnabled, showServiceImages = true, allowRemoteImages = false){
        this.theme = theme;
        this.fontSize = fontSize;
        this.nextCode = nextCode;
        this.masterPasswordEnabled = masterPasswordEnabled;
        this.showServiceImages = showServiceImages;
        this.allowRemoteImages = allowRemoteImages;
    }
}

/**
 * Creates and saves default settings
 * @returns DefaultSettings
 */
async function createDefaultSettings(){
    var result = await browser.storage.local.get("masterPasswordEnabled");

    var settings = new Settings(
        "default",
        "medium",
        true,
        result.masterPasswordEnabled,
        true,
        false,
    );

    await browser.storage.local.set({settings: settings});

    return settings;
}

async function isDarkMode(){
    var result = await browser.storage.local.get("settings");
    if(!result.settings || result.settings.theme === "default"){
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    };
    
    return (result.settings.theme === "dark") ? true : false;
}

async function isShowNextCode(){
    var result = await browser.storage.local.get("settings");
    if(!result.settings)
        return true;

    return result.settings.nextCode;
}

async function isShowServiceImages(){
    var result = await browser.storage.local.get("settings");
    return !result.settings || result.settings.showServiceImages !== false;
}

async function isAllowRemoteImages(){
    var result = await browser.storage.local.get("settings");
    return !!(result.settings && result.settings.allowRemoteImages === true);
}

async function getFontSize(){
    var result = await browser.storage.local.get("settings");
    if(!result.settings)
        return "medium";

    return result.settings.fontSize;
}