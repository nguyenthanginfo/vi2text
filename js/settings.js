/**
 * settings.js — cấu hình provider + API key CHO TTS (đọc lại), lưu trong
 * localStorage. STT giờ dùng Web Speech API của trình duyệt (miễn phí,
 * không cần key) nên không còn field "Google STT key" như bản voice-app
 * gốc — chỉ còn key cho phần "Nghe đọc".
 *
 * Với Azure: dùng 1 subscription key + 1 region cho TTS.
 */
const Settings = (() => {
  const KEY = 'micapp_settings_v1';

  function defaults() {
    return {
      provider: 'browser',
      //provider: 'google', // 'google' | 'azure' — chỉ ảnh hưởng TTS
      googleTtsKey: '',
      azureKey: '',
      azureRegion: '',
    };
  }

  function load() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { ...defaults(), ...stored };
    } catch {
      return defaults();
    }
  }

  function save(partial) {
    const merged = { ...load(), ...partial };
    localStorage.setItem(KEY, JSON.stringify(merged));
    return merged;
  }

  return { load, save };
})();
