# Security

If you find any security vulnerability or have any concern regarding the security of this project,
please create an Issue here at github (https://github.com/GuentherAtThePhone/TOPT-Extension/issues).

Please make shure to give as much detail about your Issue as possible.
We will make shure to take care of it as fast as possible.

## Existing vaults after an upgrade

Existing master-password-protected vaults are migrated to password-derived encryption on the first successful unlock after upgrading. The older format remains in local storage until that unlock and migration succeeds; users should open the extension and unlock it after updating. Remote images from imported account data are disabled unless explicitly enabled in Settings.