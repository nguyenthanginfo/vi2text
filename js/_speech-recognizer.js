/**
 * speech-recognizer.js
 * Thay thế cặp recorder.js + stt.js của bản voice-app gốc.
 * Dùng thẳng Web Speech API (`SpeechRecognition`) của trình duyệt — MIỄN
 * PHÍ, real-time, KHÔNG cần API key:
 *   - Chỉ nhận từ MIC.
 *   - Chỉ chạy tốt định trên trình duyệt nền Chromium (Chrome, Edge...).
 *     Safari hỗ trợ chập chờn, Firefox coi như không dùng được.

 */
const SpeechRecognizer = (() => {
  const LANG = 'vi-VN'; // đổi nếu cần ngôn ngữ khác

  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

  let recognition = null;
  let active = false; // "người dùng đang muốn nghe" — dùng để tự khởi động lại khi engine tự ngắt
  let onInterim = null;
  let onFinal = null;
  let onStatus = null; // (kind, message) — kind: 'listening' | 'stopped' | 'error'

  function isSupported() {
    return !!SpeechRecognitionCtor;
  }

  function createInstance() {
    const rec = new SpeechRecognitionCtor();
    rec.lang = LANG;
    rec.continuous = true; // không tự dừng sau 1 câu
    rec.interimResults = true; // có kết quả "đang nói" (chưa chốt) để hiện real-time
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          if (onFinal) onFinal(text.trim());
        } else {
          interimText += text;
        }
      }
      if (onInterim) onInterim(interimText.trim());
    };

    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        active = false;
        if (onStatus) onStatus('error', 'Hệ thống từ chối quyền micro.');
        return;
      }
      // 'no-speech', 'network', 'audio-capture', 'aborted'... -> không coi
      // là fatal, để onend bên dưới tự khởi động lại nếu vẫn đang active.
      if (onStatus) onStatus('error', `Lỗi nhận diện: ${e.error}`);
    };

    rec.onend = () => {
      if (!active) {
        if (onStatus) onStatus('stopped');
        return;
      }
      // Chrome hay tự ngắt continuous mode sau 1 khoảng im lặng/thời gian
      // -> khởi động lại NGAY để người dùng cảm giác vẫn đang nghe liên tục.
      try {
        rec.start();
      } catch {
        /* đôi khi gọi start() khi chưa kịp reset state -> bỏ qua, lần
           onend kế tiếp (nếu có) sẽ thử lại */
      }
    };

    return rec;
  }

  /**
   * @param {{onInterim:Function, onFinal:Function, onStatus:Function}} handlers
   */
  function start(handlers) {
    if (!isSupported()) {
      throw new Error(
        'Trình duyệt này không hỗ trợ SpeechRecognition. Hãy dùng Chrome/Edge mới nhất.'
      );
    }
    onInterim = handlers.onInterim;
    onFinal = handlers.onFinal;
    onStatus = handlers.onStatus;

    active = true;
    recognition = createInstance();
    recognition.start();
    if (onStatus) onStatus('listening');
  }

  function stop() {
    active = false;
    if (recognition) {
      recognition.onend = null; // đã chủ động dừng -> khỏi cần auto-restart nữa
      recognition.onerror = null;
      try {
        recognition.stop();
      } catch {
        /* đã dừng rồi -> bỏ qua */
      }
    }
    recognition = null;
  }

  function isActive() {
    return active;
  }

  return { isSupported, start, stop, isActive };
})();
