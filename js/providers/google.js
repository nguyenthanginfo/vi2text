/**
 * providers/google.js
 * CHỈ còn phần Text-to-Speech — STT giờ dùng Web Speech API của trình
 * duyệt (xem speech-recognizer.js), không còn gọi Google Cloud STT nữa.
 * Gọi thẳng Google Cloud Text-to-Speech REST API từ trình duyệt. Key đọc
 * từ Settings (localStorage).
 */
const GoogleProvider = (() => {
  const FALLBACK_VOICES = [
    { id: 'vi-VN-Standard-A', name: 'vi-VN-Standard-A (nữ)' },
    { id: 'vi-VN-Standard-B', name: 'vi-VN-Standard-B (nam)' },
    { id: 'vi-VN-Standard-C', name: 'vi-VN-Standard-C (nữ)' },
    { id: 'vi-VN-Standard-D', name: 'vi-VN-Standard-D (nam)' },
  ];

  function base64ToBlob(base64, mime) {
    const byteChars = atob(base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  async function synthesize(text, voice, speed, ttsKey) {
    if (!ttsKey) throw new Error('Chưa cấu hình Google TTS API key.');

    const payload = {
      input: { text },
      voice: { languageCode: 'vi-VN', name: voice },
      audioConfig: { audioEncoding: 'MP3', speakingRate: clamp(speed, 0.25, 4.0) },
    };

    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error?.message || `Google TTS lỗi (HTTP ${res.status})`);
    }
    if (!data.audioContent) throw new Error('Google TTS không trả về audio.');
    return base64ToBlob(data.audioContent, 'audio/mp3');
  }

  async function listVoices(ttsKey) {
    if (!ttsKey) return FALLBACK_VOICES;
    try {
      const res = await fetch(
        `https://texttospeech.googleapis.com/v1/voices?languageCode=vi-VN&key=${ttsKey}`
      );
      const data = await res.json();
      if (!res.ok || !data.voices || data.voices.length === 0) return FALLBACK_VOICES;
      return data.voices.map((v) => ({
        id: v.name,
        name: `${v.name} (${v.ssmlGender === 'FEMALE' ? 'nữ' : 'nam'})`,
      }));
    } catch {
      return FALLBACK_VOICES;
    }
  }

  return { synthesize, listVoices };
})();
