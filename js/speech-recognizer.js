/**
 * speech-recognizer.js
 * Thay thế cặp recorder.js + stt.js của bản voice-app gốc.
 * Dùng thẳng Web Speech API (`SpeechRecognition`) của trình duyệt — MIỄN
 * PHÍ, real-time, KHÔNG cần API key:
 *   - Chỉ nhận từ MIC.
 *   - Chỉ chạy tốt trên trình duyệt nền Chromium (Chrome, Edge...).
 *     Safari hỗ trợ chập chờn, Firefox coi như không dùng được.
 *
 * LỖI ĐÃ BIẾT TRÊN ANDROID (Chromium issue 40324711 — "Continuous speech
 * recognition is broken on Android"): engine nhận diện của Android KHÔNG
 * tuân theo `continuous`. Với continuous:true, phiên có thể tự kết thúc
 * gần như ngay sau khi start(), trước khi kịp nghe được gì. Nếu code khởi
 * động lại ngay lập tức trong onend (như cách làm bình thường trên
 * desktop), sẽ tạo ra vòng lặp start->end->start->end dồn dập — không lỗi
 * gì cả, chỉ là KHÔNG BAO GIỜ có đủ thời gian để nhận diện được từ nào.
 * Đây đúng là hiện tượng "không lỗi nhưng im lặng hoàn toàn" trên Android.
 *
 * Cách né (theo khuyến nghị trong chính issue trên): trên Android, đặt
 * continuous:false và TỰ mô phỏng chế độ liên tục bằng cách khởi động lại
 * ở onend — CÓ độ trễ nhỏ để engine kịp giải phóng tài nguyên trước khi
 * mở phiên mới, thay vì gọi lại tức thì. Đổi lại, Android có thể phát 1
 * tiếng "bíp" ngắn (âm mở/đóng phiên ghi của hệ thống) sau mỗi câu — đây
 * là giới hạn của chính engine Android, không tránh được từ phía web app.
 */
const SpeechRecognizer = (() => {
  const LANG = 'vi-VN'; // đổi nếu cần ngôn ngữ/biến thể khác

  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const IS_ANDROID = /Android/i.test(navigator.userAgent);

  // 0 trên desktop (khởi động lại ngay, giữ cảm giác liên tục mượt nhất).
  // >0 trên Android để engine có thời gian giải phóng phiên cũ trước khi
  // mở phiên mới — gọi start() ngay lập tức trên Android dễ trượt vào
  // vòng lặp end/start dồn dập nói ở trên, hoặc ném InvalidStateError vì
  // phiên trước chưa kịp dọn xong.
  const RESTART_DELAY_MS = IS_ANDROID ? 300 : 0;
  const MAX_RESTART_RETRIES = 5; // phòng khi start() ném lỗi vì phiên cũ chưa dọn xong

  let recognition = null;
  let active = false; // "người dùng đang muốn nghe" — dùng để tự khởi động lại khi engine tự ngắt
  let restartTimer = null;
  let onInterim = null;
  let onFinal = null;
  let onStatus = null; // (kind, message) — kind: 'listening' | 'stopped' | 'error'

  function isSupported() {
    return !!SpeechRecognitionCtor;
  }

  function createInstance() {
    const rec = new SpeechRecognitionCtor();
    rec.lang = LANG;
    // Desktop: continuous:true chạy tốt, Chrome tự ngắt sau một khoảng dài
    // và code khởi động lại ngay là đủ (xem onend bên dưới).
    // Android: continuous BỊ ENGINE BỎ QUA (xem chú thích đầu file) -> đặt
    // false để hành vi nhất quán, tự mô phỏng liên tục bằng cách restart.
    rec.continuous = !IS_ANDROID;
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
      scheduleRestart(rec, 0);
    };

    return rec;
  }

  /**
   * Khởi động lại 1 phiên nhận diện mới, có độ trễ (RESTART_DELAY_MS) và
   * tự thử lại vài lần nếu start() ném lỗi (thường do phiên trước — nhất
   * là trên Android — chưa kịp giải phóng xong).
   */
  function scheduleRestart(rec, attempt) {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      if (!active || recognition !== rec) return; // đã stop() hoặc đã tạo phiên khác trong lúc chờ
      try {
        rec.start();
      } catch {
        if (attempt < MAX_RESTART_RETRIES) {
          scheduleRestart(rec, attempt + 1);
        }
        // Hết số lần thử -> im lặng chờ lần 'onend' kế tiếp (nếu có) tự thử lại từ đầu.
      }
    }, RESTART_DELAY_MS);
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
    clearTimeout(restartTimer);
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
