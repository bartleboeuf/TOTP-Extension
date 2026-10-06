/**
 * Unit Tests for Settings Model & Preferences (settingsModel.js).
 */

describe('Settings Model & Preferences', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.session.clear();
  });

  describe('Settings Instantiation', () => {
    it('should correctly set all settings properties', () => {
      const s = new Settings('dark', 'large', false, true);
      expect(s.theme).toBe('dark');
      expect(s.fontSize).toBe('large');
      expect(s.nextCode).toBe(false);
      expect(s.masterPasswordEnabled).toBe(true);
      expect(s.showServiceImages).toBe(true);
    });
  });

  describe('createDefaultSettings()', () => {
    it('should save and return default settings with masterPasswordEnabled flag from storage', async () => {
      await browser.storage.local.set({ masterPasswordEnabled: false });

      const settings = await createDefaultSettings();
      expect(settings.theme).toBe('default');
      expect(settings.fontSize).toBe('medium');
      expect(settings.nextCode).toBe(true);
      expect(settings.masterPasswordEnabled).toBe(false);
      expect(settings.showServiceImages).toBe(true);

      const stored = await browser.storage.local.get('settings');
      expect(stored.settings.theme).toBe('default');
    });
  });

  describe('Preference Getters', () => {
    describe('isDarkMode()', () => {
      it('should return true for dark theme and false for light theme', async () => {
        await browser.storage.local.set({ settings: { theme: 'dark' } });
        expect(await isDarkMode()).toBe(true);

        await browser.storage.local.set({ settings: { theme: 'light' } });
        expect(await isDarkMode()).toBe(false);
      });
    });

    describe('isShowNextCode()', () => {
      it('should return stored nextCode preference or default to true', async () => {
        await browser.storage.local.set({ settings: { nextCode: false } });
        expect(await isShowNextCode()).toBe(false);

        await browser.storage.local.set({ settings: { nextCode: true } });
        expect(await isShowNextCode()).toBe(true);

        // Default when settings object is missing
        await browser.storage.local.clear();
        expect(await isShowNextCode()).toBe(true);
      });
    });

    describe('isShowServiceImages()', () => {
      it('should return stored preference or default to true for existing settings', async () => {
        await browser.storage.local.set({ settings: { showServiceImages: false } });
        expect(await isShowServiceImages()).toBe(false);

        await browser.storage.local.set({ settings: { showServiceImages: true } });
        expect(await isShowServiceImages()).toBe(true);

        await browser.storage.local.set({ settings: { theme: 'dark' } });
        expect(await isShowServiceImages()).toBe(true);
      });
    });

    describe('getFontSize()', () => {
      it('should return stored font size or default to "medium"', async () => {
        await browser.storage.local.set({ settings: { fontSize: 'small' } });
        expect(await getFontSize()).toBe('small');

        await browser.storage.local.clear();
        expect(await getFontSize()).toBe('medium');
      });
    });
  });
});