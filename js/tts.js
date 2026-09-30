/**
 * tts.js
 * Adapter — chọn provider (Google/Azure) theo Settings.
 *
 * Google giới hạn input.text/input.ssml TỐI ĐA 5000 BYTE UTF-8 mỗi lần
 * gọi text:synthesize (không phải 5000 KÝ TỰ — tiếng Việt có dấu chiếm
 * 2-3 byte/ký tự nên giới hạn ký tự thực tế thấp hơn nhiều). Text dài
 * hơn giới hạn sẽ bị Google từ chối thẳng, không tự cắt giúp.
 *
 * Xử lý: tự cắt text thành nhiều đoạn <5000 byte (ưu tiên cắt theo dòng
 * -> câu -> từ, tránh cắt giữa từ khi có thể), gọi text:synthesize TUẦN
 * TỰ cho từng đoạn, rồi ghép các Blob MP3 lại thành 1 file phát liên
 * tục. Ghép Blob MP3 thô (không giải mã/mã hoá lại) là cách nối phổ
 * biến và phát được liên tục trên hầu hết trình duyệt/trình phát vì
 * MPEG frame không phụ thuộc 1 header duy nhất cho cả file như WAV.
 */
const TTS = (() => {
  // An toàn hơn hẳn 5000 để chừa chỗ cho phần "input"/"voice"/"audioConfig"
  // còn lại của JSON payload (Google tính giới hạn trên chính field text/ssml,
  // nhưng để dư an toàn, tránh sát ngưỡng).
  const MAX_BYTES_PER_CALL = 4500;

  function utf8ByteLength(str) {
    return new TextEncoder().encode(str).length;
  }

  /**
   * Cắt text thành nhiều đoạn <= maxBytes (đo theo byte UTF-8 thật, không
   * phải độ dài chuỗi). Ưu tiên cắt theo ranh giới tự nhiên: dòng -> câu
   * -> từ, để tránh cắt ngang từ khi có thể. Trường hợp cực hiếm 1 từ tự
   * nó đã vượt giới hạn thì đành chấp nhận gửi riêng từ đó (không xảy ra
   * với văn bản tiếng Việt bình thường).
   */
  function splitTextForTts(text, maxBytes = MAX_BYTES_PER_CALL) {
    const chunks = [];
    let current = '';

    function flush() {
      if (current.trim()) chunks.push(current.trim());
      current = '';
    }

    function pushWithSeparator(piece, sep) {
      const candidate = current ? current + sep + piece : piece;
      if (utf8ByteLength(candidate) <= maxBytes) {
        current = candidate;
        return true;
      }
      return false;
    }

    const paragraphs = text.split('\n');
    for (const para of paragraphs) {
      if (pushWithSeparator(para, '\n')) continue;

      flush();
      if (utf8ByteLength(para) <= maxBytes) {
        current = para;
        continue;
      }

      // 1 đoạn (dòng) tự nó đã vượt giới hạn -> cắt tiếp theo câu
      const sentences = para.split(/(?<=[.!?…])\s+/);
      for (const sentence of sentences) {
        if (pushWithSeparator(sentence, ' ')) continue;

        flush();
        if (utf8ByteLength(sentence) <= maxBytes) {
          current = sentence;
          continue;
        }

        // 1 câu tự nó vẫn vượt giới hạn -> cắt cứng theo từ
        const words = sentence.split(/\s+/);
        for (const w of words) {
          if (pushWithSeparator(w, ' ')) continue;
          flush();
          current = w; // cực hiếm: 1 từ vẫn vượt giới hạn -> gửi riêng, chấp nhận
        }
      }
    }
    flush();
    return chunks;
  }

  async function synthesizeOne(text, voice, speed) {
    const s = Settings.load();
    if (s.provider === 'azure') {
      return AzureProvider.synthesize(text, voice, speed, s.azureKey, s.azureRegion);
    }
    return GoogleProvider.synthesize(text, voice, speed, s.googleTtsKey);
  }

  /**
   * @param {(done:number, total:number) => void} [onProgress] gọi lại sau
   *   mỗi đoạn đã xong, để UI hiện "đang tạo phần x/y" khi văn bản dài.
   * @returns {Promise<Blob>} 1 Blob MP3 duy nhất, phát liên tục.
   */
  async function synthesize(text, voice, speed, onProgress) {
    const chunks = splitTextForTts(text);
    if (chunks.length === 0) throw new Error('Text is empty');

    const blobs = [];
    for (let i = 0; i < chunks.length; i++) {
      const blob = await synthesizeOne(chunks[i], voice, speed);
      blobs.push(blob);
      if (onProgress) onProgress(i + 1, chunks.length);
    }

    return chunks.length === 1 ? blobs[0] : new Blob(blobs, { type: 'audio/mp3' });
  }

  // ---------------------------------------------------------------
  // ENGINE "BROWSER" — Web Speech API (speechSynthesis)
  //
  // Khác engine Cloud: KHÔNG trả về Blob/file audio, chỉ phát thẳng ra
  // loa -> không có "Lưu .MP3" và không có thanh tua. Bù lại miễn phí,
  // không cần API key, không có giới hạn 5000 byte.
  //
  // Chrome có lỗi nổi tiếng: 1 utterance dài (~15s trở lên) bị cắt ngang
  // im lặng, nhất là với giọng "Google". Cách né: cắt text thành đoạn
  // ngắn và đọc TUẦN TỰ (xong đoạn này mới speak() đoạn kế), thay vì xếp
  // hàng hết một lượt — cách này còn giúp hủy (Dừng) chính xác hơn.
  // ---------------------------------------------------------------

  // ~600 byte UTF-8 ≈ 250-300 ký tự tiếng Việt có dấu ≈ vài câu ngắn.
  const BROWSER_MAX_BYTES_PER_UTTERANCE = 600;

  let browserSession = null; // { cancelled, current } — phiên đọc đang chạy (nếu có)

  function getEngine() {
    return Settings.load().provider === 'browser' ? 'browser' : 'cloud';
  }

  function isBrowserSupported() {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  function isBrowserSpeaking() {
    return browserSession !== null;
  }

  function stopBrowser() {
    if (!browserSession) return;
    browserSession.cancelled = true; // chặn onend/onerror của utterance đang dở gọi tiếp đoạn sau
    browserSession = null;
    if (isBrowserSupported()) window.speechSynthesis.cancel();
  }

  /**
   * @param {string} text
   * @param {string} voiceId voiceURI của giọng chọn trong dropdown ('' = giọng mặc định tiếng Việt)
   * @param {number} speed 0.75 .. 2.0 (map thẳng sang utterance.rate)
   * @param {{onProgress?:(index:number,total:number)=>void, onEnd?:()=>void, onError?:(err:Error)=>void}} [handlers]
   *   onProgress(index, total): gọi khi BẮT ĐẦU đọc đoạn thứ index (1-based).
   */
  function speakBrowser(text, voiceId, speed, handlers = {}) {
    if (!isBrowserSupported()) {
      throw new Error('Trình duyệt này không hỗ trợ đọc văn bản (speechSynthesis).');
    }
    stopBrowser();

    const chunks = splitTextForTts(text, BROWSER_MAX_BYTES_PER_UTTERANCE);
    if (chunks.length === 0) throw new Error('Text is empty');

    const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceId) || null;
    const session = { cancelled: false, current: null };
    browserSession = session;

    function finish(err) {
      if (browserSession === session) browserSession = null;
      if (err) {
        if (handlers.onError) handlers.onError(err);
      } else if (handlers.onEnd) {
        handlers.onEnd();
      }
    }

    function speakChunk(i) {
      if (session.cancelled) return;
      if (i >= chunks.length) return finish();

      const u = new SpeechSynthesisUtterance(chunks[i]);
      u.lang = voice ? voice.lang : 'vi-VN';
      if (voice) u.voice = voice;
      u.rate = Math.max(0.1, Math.min(10, speed));

      u.onend = () => speakChunk(i + 1);
      u.onerror = (e) => {
        if (session.cancelled) return;
        // 'canceled'/'interrupted' xảy ra khi bị cancel() — không phải lỗi thật
        if (e.error === 'canceled' || e.error === 'interrupted') return;
        session.cancelled = true;
        finish(new Error(`Lỗi đọc bằng giọng trình duyệt: ${e.error || 'không rõ'}`));
      };

      // Giữ tham chiếu: Chrome có thể thu gom rác utterance đang đọc và
      // làm sự kiện onend không bao giờ bắn.
      session.current = u;
      if (handlers.onProgress) handlers.onProgress(i + 1, chunks.length);
      window.speechSynthesis.speak(u);
    }

    speakChunk(0);
  }

  return {
    synthesize,
    getEngine,
    isBrowserSupported,
    isBrowserSpeaking,
    speakBrowser,
    stopBrowser,
  };
})();
