/**
 * mic-meter.js
 * Thay thế audio-graph.js của bản voice-app gốc.
 *
 * Web Speech API (SpeechRecognition) tự quản lý việc thu mic bên trong nó
 * — không cho ứng dụng truy cập vào MediaStream/AnalyserNode của phần thu
 * đó. Vì vậy, muốn vẫn có VU meter (hiển thị mức tín hiệu) và VAD (tự dừng
 * khi im lặng lâu), app phải tự mở MỘT getUserMedia() RIÊNG, độc lập, chỉ
 * để phân tích mức âm lượng — không liên quan gì đến việc nhận diện giọng
 * nói (việc đó do SpeechRecognizer lo).
 *
 * Trình duyệt sẽ chỉ hỏi quyền mic 1 lần (đã cấp thì dùng chung), nên
 * không có gì bất thường khi có 2 "người dùng mic" chạy song song.
 */
const MicMeter = (() => {
  let ctx = null;
  let analyser = null;
  let sourceNode = null;
  let stream = null;

  async function start() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    // CHỈ nối tới analyser để đọc mức tín hiệu — KHÔNG nối ra destination,
    // tránh phát ngược tiếng mic ra loa (vọng/hú âm thanh).
    sourceNode.connect(analyser);
    return analyser;
  }

  function getAnalyser() {
    return analyser;
  }

  function stop() {
    if (sourceNode) sourceNode.disconnect();
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (ctx) ctx.close().catch(() => {});
    ctx = null;
    analyser = null;
    sourceNode = null;
    stream = null;
  }

  return { start, getAnalyser, stop };
})();
