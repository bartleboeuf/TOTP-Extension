# README

This project provides a browser extension to generate TOTP´s with. 
TOTP´s can be added by scanning QR-Codes or by importing from Apps.

This extension is local only. All the secrets are stored local and all the calculation of the codes is local as well.
Scanning and processing QR-Codes also happens locally on your machine. No telemetry data is collected.
No data ever leaves your machine!

![Couldn´t display picture.](/Examples/images/Popup_view.png "View of the Popup window.")
![Couldn´t display picture.](/Examples/images/Edit_view.png "View of the Edit window.")

## Installation

| Browser   | Install from ... | Notes |
| :-------: | ---------------- | ------ |
| <img src="https://github.com/user-attachments/assets/b0136512-56a5-4856-8c50-4971c957a24f" alt="Get for Firefox"> | <a href="https://addons.mozilla.org/de/firefox/addon/2fa-authenticator/">Firefox Add-ons</a> | Only available for Firefox Desktop |
| <img src="https://github.com/user-attachments/assets/5463ef88-873b-4516-8514-5277664cfde7" alt="Get for Chrome"> | <a href="https://chromewebstore.google.com/detail/totp-authenticator/aipfbkoohmnbdpbmnpikfohkgmmpmghk">Chrome Web Store</a> | Should work for all Chromium based browser |
| <img src="https://github.com/user-attachments/assets/3a7569f8-688b-4eb1-a643-8d0fe173aefe" alt="Get for Microsoft Edge"> | <a href="https://chromewebstore.google.com/detail/totp-authenticator/aipfbkoohmnbdpbmnpikfohkgmmpmghk">Chrome Web Store</a> | Available through Chrome Web Store |
| <img src="https://github.com/user-attachments/assets/938f080c-fe64-4e48-8b89-4bfceabb56e6" alt="Get for Opera"> | <a href="https://chromewebstore.google.com/detail/totp-authenticator/aipfbkoohmnbdpbmnpikfohkgmmpmghk">Chrome Web Store</a> | Available through Chrome Web Store |

## Usage

The extension provides the ability to generate TOTP´s (and HTOP´s) within your Browser. No need for an extra app on your smartphone or your PC. All the magic happens right where you need it.

Just add the Browser extension using the links above.

On the first start you are asked to set a new master password. To diable the master password, just leave the field empty.

After upgrading an existing installation, the first successful master-password unlock migrates the account vault to password-derived encryption. Until this migration completes, the previous vault format remains in local storage. Remote service images are not loaded unless explicitly enabled in Settings.

**Language:** Currently available: English (default), German.
The default language provided by your browser is used. There is no way to manually change the language from the extension.

## Development

Visual Studio Code is the recommended IDE for development, but you can use whatever editor you want.

To run the extension during development, make shure to first clone the repository. Then, in Firefox, go to: about:debugging - This Firefox - load temporary add-on - select `Extension/manifest.json`

## Running Tests (AI-Generated)

This project includes automated unit and integration tests covering TOTP/HOTP calculation (RFC 6238 & RFC 4226), converter imports, encryption, and models.

### Option 1: In the Browser (Zero Setup)
Simply open [`tests/index.html`](tests/index.html) in any web browser (Firefox, Chrome, Edge) to run all tests with an interactive visual dashboard.

### Option 2: Using Node.js
If Node.js is installed, run:
```bash
npm test
```


## Design decisions

The extenison is local only. No syncing is planned nor wanted.

There will never be telemetrics be collected by the extension itself. (However the store it was installed from might collect data. Therefore, please see the stores terms.)

The extension is as minimalistic as possible, while also providing all necessary functions.

## License

The name "TOTP Authenticator" and the project logo are property of the original author.

You may use, modify, and distribute the source code of this project under the MIT License.

However:

- You may not distribute modified versions using the original project name.
- You may not use the official logo without permission.
- Any redistribution must include attribution to the original project and author.
