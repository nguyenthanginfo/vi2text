/**
 * providers/azure.js
 * STT dùng Web Speech API của trình
 * duyệt (xem speech-recognizer.js), không còn gọi Azure Speech-to-Text.
 * Gọi thẳng Microsoft Azure Speech TTS REST API từ trình duyệt.
 */
const AzureProvider = (() => {
  const FALLBACK_VOICES = [
    { id: 'vi-VN-HoaiMyNeural', name: 'vi-VN-HoaiMyNeural (nữ)' },
    { id: 'vi-VN-NamMinhNeural', name: 'vi-VN-NamMinhNeural (nam)' },
  ];

  function endpointsFor(region) {
    return {
      ttsSynthesize: `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      ttsVoices: `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
    };
  }

  function escapeXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  async function synthesize(text, voice, speed, key, region) {
    if (!key || !region) throw new Error('Chưa cấu hình Azure key.');

    const ratePercent = Math.round(clamp(speed, 0.25, 4.0) * 100);
    const ssml =
      `<speak version='1.0' xml:lang='vi-VN'>` +
      `<voice xml:lang='vi-VN' name='${voice}'>` +
      `<prosody rate='${ratePercent}%'>${escapeXml(text)}</prosody>` +
      `</voice></speak>`;

    const res = await fetch(endpointsFor(region).ttsSynthesize, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      },
      body: ssml,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Azure TTS lỗi (HTTP ${res.status}): ${detail.slice(0, 200)}`);
    }
    return res.blob();
  }

  async function listVoices(key, region) {
    if (!key || !region) return FALLBACK_VOICES;
    try {
      const res = await fetch(endpointsFor(region).ttsVoices, {
        headers: { 'Ocp-Apim-Subscription-Key': key },
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) return FALLBACK_VOICES;

      const viVoices = data.filter((v) => v.Locale === 'vi-VN');
      if (viVoices.length === 0) return FALLBACK_VOICES;
      return viVoices.map((v) => ({
        id: v.ShortName,
        name: `${v.ShortName} (${v.Gender === 'Female' ? 'nữ' : 'nam'})`,
      }));
    } catch {
      return FALLBACK_VOICES;
    }
  }

  return { synthesize, listVoices };
})();
