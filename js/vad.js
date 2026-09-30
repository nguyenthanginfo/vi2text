/**
 * vad.js
 * "Voice Activity Detection" phiên bản KHÔNG dùng audio thật — tự dừng ghi
 * khi im lặng kéo dài quá lâu, dựa trên chính sự kiện của SpeechRecognizer
 * thay vì đo RMS từ một AnalyserNode.
 *
 * Bản trước dùng AnalyserNode lấy từ 1 getUserMedia() RIÊNG (mic-meter.js,
 * đã bị xoá) — độc lập với luồng mic mà SpeechRecognition tự quản lý. Trên
 * Android, việc mở 2 phiên ghi âm cùng lúc có thể khiến SpeechRecognition
 * chỉ nhận được im lặng (mic bị luồng kia chiếm), nên coi lượng RMS đo từ
 * luồng riêng đó là không đáng tin cho quyết định "có đang có giọng nói
 * hay không" của CHÍNH luồng mà recognizer xử lý.
 *
 * Cách mới: đếm thời gian kể từ lần cuối SpeechRecognizer thực sự trả về
 * nội dung (onInterim/onFinal khác rỗng) — gọi notifyActivity() mỗi lần đó
 * xảy ra để reset đồng hồ đếm. Cách này bám sát ĐÚNG luồng audio mà
 * recognizer xử lý, chính xác hơn suy đoán qua một luồng mic khác.
 */
const VAD = (() => {
  const SILENCE_TIMEOUT_MS = 60 * 1000; // 60 giây không có nội dung nào -> tự dừng

  let timer = null;
  let onSilenceTimeout = null;

  function start(callback) {
    onSilenceTimeout = callback;
    resetTimer();
  }

  /** Gọi mỗi khi SpeechRecognizer thực sự nhận diện được nội dung (không rỗng). */
  function notifyActivity() {
    if (!onSilenceTimeout) return; // chưa start() hoặc đã stop() rồi
    resetTimer();
  }

  function resetTimer() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const cb = onSilenceTimeout;
      stop();
      if (cb) cb();
    }, SILENCE_TIMEOUT_MS);
  }

  function stop() {
    clearTimeout(timer);
    timer = null;
    onSilenceTimeout = null;
  }

  return { start, notifyActivity, stop };
})();
