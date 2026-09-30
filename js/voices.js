/**
 * voices.js
 * Adapter — lấy danh sách giọng đọc theo provider hiện tại (Settings).
 * provider: 'browser' (Web Speech API) | 'google' | 'azure'
 */
const Voices = (() => {
  /**
   * Giọng của trình duyệt. speechSynthesis.getVoices() thường trả về mảng
   * RỖNG ở lần gọi đầu (danh sách nạp bất đồng bộ) -> phải chờ sự kiện
   * 'voiceschanged'. Có timeout để không treo nếu trình duyệt không bắn sự kiện.
   * Danh sách giọng phụ thuộc hệ điều hành + trình duyệt (Edge/Chrome/
   * Android/iOS mỗi nơi một khác), chất lượng cũng không đồng đều.
   */
  async function getBrowserVoices() {
    if (!('speechSynthesis' in window)) {
      return [{ id: '', name: 'Trình duyệt không hỗ trợ giọng đọc' }];
    }

    let list = window.speechSynthesis.getVoices();
    if (list.length === 0) {
      await new Promise((resolve) => {
        const done = () => {
          window.speechSynthesis.removeEventListener('voiceschanged', done);
          resolve();
        };
        window.speechSynthesis.addEventListener('voiceschanged', done);
        setTimeout(done, 1500);
      });
      list = window.speechSynthesis.getVoices();
    }

    // Android hay báo 'vi_VN' (gạch dưới) thay vì 'vi-VN'.
    const viVoices = list.filter((v) => (v.lang || '').toLowerCase().replace('_', '-').startsWith('vi'));
    if (viVoices.length === 0) {
      return [{ id: '', name: 'Không có giọng tiếng Việt — hãy đổi trình duyệt Edge' }];
    }
    return viVoices.map((v) => ({
      id: v.voiceURI,
      name: `${v.name}${v.localService ? '' : ' (online)'}`,
    }));
  }

  async function fetchVoices() {
    const s = Settings.load();
    try {
      if (s.provider === 'browser') return await getBrowserVoices();
      if (s.provider === 'azure') return await AzureProvider.listVoices(s.azureKey, s.azureRegion);
      return await GoogleProvider.listVoices(s.googleTtsKey);
    } catch {
      return [{ id: 'default', name: 'Giọng mặc định (lỗi tải danh sách)' }];
    }
  }

  return { fetchVoices };
})();
