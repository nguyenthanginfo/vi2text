/**
 * vu-meter.js
 * Vẽ vài thanh bar nhỏ biểu thị "đang nghe" + "vừa nhận diện được gì đó".
 *
 * KHÔNG còn đọc AnalyserNode/RMS âm lượng thật như bản trước — bản đó cần
 * mở MỘT getUserMedia() RIÊNG (xem mic-meter.js cũ, đã bị xoá), độc lập
 * với luồng mic mà SpeechRecognition tự quản lý bên trong nó. Trên nhiều
 * máy Android, hệ điều hành CHỈ cho một phiên ghi âm độc quyền tại một
 * thời điểm — luồng thứ 2 khiến SpeechRecognition chỉ nhận được im lặng,
 * dẫn tới hiện tượng "mic bật/tắt liên tục, không bao giờ ra chữ".
 *
 * Thay vào đó, dùng CHÍNH sự kiện của SpeechRecognition làm tín hiệu:
 *  - start(): bật hiệu ứng nền tĩnh "đang nghe" (.vu-bar--listening).
 *  - pulse(): chớp sáng ngắn (tái dùng .vu-bar--active) — gọi mỗi khi
 *    onInterim/onFinal có nội dung. Đây LÀ tín hiệu thật (recognizer đang
 *    nhận diện được), chỉ không phải biên độ âm lượng — thực ra còn đúng
 *    hơn VU thật, vì tiếng ồn nền có thể làm VU thật nhảy dù recognizer
 *    không nhận ra chữ nào.
 */
const VUMeter = (() => {
  let bars = [];
  let pulseTimer = null;

  function mount(containerEl, barCount = 5) {
    containerEl.innerHTML = '';
    bars = [];
    for (let i = 0; i < barCount; i++) {
      const bar = document.createElement('span');
      bar.className = 'vu-bar';
      containerEl.appendChild(bar);
      bars.push(bar);
    }
  }

  function start() {
    bars.forEach((bar) => bar.classList.add('vu-bar--listening'));
  }

  function pulse() {
    clearTimeout(pulseTimer);
    bars.forEach((bar) => bar.classList.add('vu-bar--active'));
    pulseTimer = setTimeout(() => {
      bars.forEach((bar) => bar.classList.remove('vu-bar--active'));
    }, 250);
  }

  function stop() {
    clearTimeout(pulseTimer);
    pulseTimer = null;
    bars.forEach((bar) => bar.classList.remove('vu-bar--listening', 'vu-bar--active'));
  }

  return { mount, start, pulse, stop };
})();
