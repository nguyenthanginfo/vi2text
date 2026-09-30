/**
 * vu-meter.js
 * Vẽ vài thanh bar nhỏ biểu thị mức tín hiệu audio thực tế đang thu được
 * (kiểu "mic test"). Đọc dữ liệu từ AnalyserNode của audio-graph.js —
 * không tốn diện tích lớn, chỉ vài div/span nhỏ.
 */
const VUMeter = (() => {
  let analyser = null;
  let dataArray = null;
  let rafId = null;
  let bars = [];

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

  function start(analyserNode) {
    analyser = analyserNode;
    dataArray = new Uint8Array(analyser.fftSize);
    loop();
  }

  function loop() {
    if (!analyser) return;
    analyser.getByteTimeDomainData(dataArray);

    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / dataArray.length);
    const level = Math.min(1, rms * 4); // hệ số khuếch đại hiển thị, chỉnh nếu thấy quá nhạy/lì

    bars.forEach((bar, i) => {
      const barThreshold = ((i + 1) / bars.length) * 0.6;
      bar.classList.toggle('vu-bar--active', level >= barThreshold);
    });

    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    bars.forEach((bar) => bar.classList.remove('vu-bar--active'));
  }

  return { mount, start, stop };
})();
