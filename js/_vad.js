/**
 * vad.js
 * Voice Activity Detection đơn giản (đo RMS thời gian thực, KHÔNG phải
 * model AI) — dùng để tự động dừng ghi khi im lặng kéo dài quá lâu,
 * thay vì chỉ dựa vào giới hạn thời lượng cứng.
 *
 * Ngưỡng SILENCE_THRESHOLD là giá trị thử nghiệm ban đầu — tuỳ độ nhạy
 * mic/noise nền thực tế mà chỉnh lại (quá thấp -> không bao giờ coi là
 * im lặng dù thực sự im; quá cao -> tự dừng dù người dùng còn đang nói khẽ).
 */
const VAD = (() => {
  const SILENCE_THRESHOLD = 0.02;
  const SILENCE_TIMEOUT_MS = 60 * 1000; // 60 giây im lặng liên tục -> tự dừng

  let analyser = null;
  let dataArray = null;
  let rafId = null;
  let silenceStart = null;
  let onSilenceTimeout = null;

  function start(analyserNode, callback) {
    analyser = analyserNode;
    dataArray = new Uint8Array(analyser.fftSize);
    onSilenceTimeout = callback;
    silenceStart = null;
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

    if (rms < SILENCE_THRESHOLD) {
      if (silenceStart === null) silenceStart = Date.now();
      else if (Date.now() - silenceStart > SILENCE_TIMEOUT_MS) {
        const cb = onSilenceTimeout;
        stop();
        if (cb) cb();
        return;
      }
    } else {
      silenceStart = null;
    }

    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    analyser = null;
    silenceStart = null;
  }

  return { start, stop };
})();
