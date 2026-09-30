/**
 * app.js
 * File điều phối chính. Khác bản voice-app gốc: KHÔNG còn recorder.js/
 * audio-graph.js/stt.js/punctuation.js kiểu "cắt chunk gửi REST" — STT giờ
 * là Web Speech API của trình duyệt (xem speech-recognizer.js), chạy
 * real-time, chỉ nhận từ MIC mặc định (không chọn được nguồn/thiết bị).
 * TTS ("Nghe đọc") vẫn dùng Google/Azure như cũ, không đổi gì.
 */
(function App() {
  const DRAFT_KEY = 'draft_mic-to-text-vi-v1';
  const MAX_SECONDS = 20 * 60; // giữ giới hạn 20 phút/phiên
  // Giới hạn số KÝ TỰ tối đa cho phép gửi đi TTS trong 1 lần bấm "Nghe đọc".
  // Không phải giới hạn kỹ thuật của Google/Azure (đó là chuyện tts.js tự
  // cắt theo byte) — đây là giới hạn UX riêng để tránh văn bản quá dài làm
  // hàng chục lời gọi API tuần tự, treo nút "Nghe đọc" quá lâu. Chỉnh số
  // này nếu muốn cho phép nhiều/ít hơn.
  const MAX_TTS_CHARS = 10000;

  let recording = false;
  let lastTtsBlob = null;  // Blob mp3 (CHỈ engine Cloud) vừa phát thành công — dùng cho nút "Lưu .MP3"
  let playBtnDefaultHtml = ''; // HTML gốc (icon + chữ "Nghe đọc") của nút phát, để khôi phục sau khi đọc xong/dừng
  let startTime = null;
  let timerInterval = null;
  let draftDebounce = null;

  async function init() {
    Theme.init();
    Session.create(UI.getTitle());
    playBtnDefaultHtml = UI.el.playBtn.innerHTML;

    wireSettingsPanel();
    wireRecording();
    wireEditorActions();
    wireTtsAndSave();
    wireShortcuts();

    restoreDraftIfAny();
    await refreshVoices();
    refreshMp3Button();
    warnIfUnsupported();
  }

  function warnIfUnsupported() {
    if (SpeechRecognizer.isSupported()) return;
    UI.el.recordBtn.disabled = true;
    UI.el.recStatus.textContent = 'Trình duyệt không hỗ trợ nhận diện giọng nói';
    UI.showError(
      'Trình duyệt này không hỗ trợ Web Speech API. Hãy dùng Chrome hoặc Edge bản mới nhất (Firefox/Safari không hỗ trợ đầy đủ).'
    );
  }

  // ---------------------------------------------------------------
  // Cấu hình API (chỉ còn dùng cho TTS — "Nghe đọc")
  // ---------------------------------------------------------------

  function wireSettingsPanel() {
    UI.loadSettingsIntoForm(Settings.load());

    UI.el.providerSelect.addEventListener('change', async () => {
      const provider = UI.el.providerSelect.value;
      UI.toggleProviderFields(provider);
      // Lưu provider NGAY (không đợi bấm "Lưu cấu hình") vì danh sách giọng
      // đọc và engine đang dùng đọc provider từ Settings. Key vẫn chỉ lưu
      // khi bấm nút "Lưu cấu hình".
      Settings.save({ provider });
      TTS.stopBrowser();
      resetPlayButton();
      refreshMp3Button();
      await refreshVoices();
    });

    UI.el.saveSettingsBtn.addEventListener('click', async () => {
      Settings.save(UI.readSettingsForm());
      UI.showInfo('Đã lưu cấu hình.');
      await refreshVoices();
    });

    UI.el.themeToggle.addEventListener('click', () => Theme.toggle());
  }

  async function refreshVoices() {
    const voices = await Voices.fetchVoices();
    UI.setVoiceList(voices);
  }

  // ---------------------------------------------------------------
  // Ghi âm / nhận diện giọng nói (Web Speech API, chỉ MIC)
  // ---------------------------------------------------------------

  function wireRecording() {
    UI.el.recordBtn.addEventListener('click', onRecordClick);
  }

  async function onRecordClick() {
    if (recording) {
      finishRecording();
      return;
    }

    try {
      TTS.stopBrowser();
      resetPlayButton();
      recording = true;
      UI.setRecordingState(true);

      SpeechRecognizer.start({
        onInterim: handleInterim,
        onFinal: handleFinal,
        onStatus: handleStatus,
      });

      // Mở mic RIÊNG (độc lập với SpeechRecognition) chỉ để vẽ VU meter + VAD.
      const analyser = await MicMeter.start();
      VUMeter.mount(UI.el.vuMeter, 5);
      VUMeter.start(analyser);
      VAD.start(analyser, () => {
        finishRecording();
        UI.showInfo('Đã tự dừng do im lặng liên tục hơn 60 giây.');
      });

      startTime = Date.now();
      UI.updateTimer(0, MAX_SECONDS);
      timerInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        UI.updateTimer(elapsed, MAX_SECONDS);
        if (elapsed >= MAX_SECONDS) {
          finishRecording();
          UI.showInfo(`Đã tự dừng vì đạt giới hạn ${Math.round(MAX_SECONDS / 60)} phút.`);
        }
      }, 1000);
    } catch (err) {
      recording = false;
      UI.setRecordingState(false);
      UI.showError('Không bắt đầu được: ' + (err.message || err));
      SpeechRecognizer.stop();
      MicMeter.stop();
    }
  }

  function handleInterim(text) {
    UI.showInterim(text);
  }

  function handleFinal(text) {
    if (!text) return;
    // Web Speech API không trả timestamp -> không áp được heuristic dấu câu
    // theo khoảng lặng như bản Google Cloud STT cũ. Mỗi kết quả "final" đã
    // là 1 câu/cụm được engine tự chốt theo pause nội bộ của nó, nên chỉ
    // cần thêm dấu chấm nếu chưa có dấu câu kết thúc, rồi xuống dòng mới.
    const withPunctuation = /[.!?…,:;]\s*$/.test(text) ? text : `${text}.`;
    UI.appendTranscript(withPunctuation);
    invalidateTtsBlob();
    scheduleDraftSave();
  }

  function handleStatus(kind, message) {
    if (kind === 'error') {
      UI.showError(message);
      // 'not-allowed'/'service-not-allowed' -> SpeechRecognizer tự set active=false,
      // không tự khởi động lại -> đồng bộ lại trạng thái nút bấm ở đây.
      if (!SpeechRecognizer.isActive() && recording) {
        finishRecording();
      }
    }
  }

  function finishRecording() {
    recording = false;
    UI.setRecordingState(false);
    UI.showInterim('');
    clearInterval(timerInterval);
    SpeechRecognizer.stop();
    MicMeter.stop();
    VUMeter.stop();
    VAD.stop();
  }

  // ---------------------------------------------------------------
  // Editor: copy / new / char count / autosave draft
  // ---------------------------------------------------------------

  function wireEditorActions() {
    UI.el.editor.addEventListener('input', () => {
      UI.updateCharCount();
      invalidateTtsBlob();
      scheduleDraftSave();
    });

    UI.el.titleInput.addEventListener('input', () => {
      Session.setTitle(UI.getTitle());
      scheduleDraftSave();
    });

    UI.el.copyBtn.addEventListener('click', async () => {
      const text = UI.getTranscript();
      if (!text.trim()) {
        UI.showInfo('Chưa có văn bản để copy.');
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        UI.showInfo('Đã copy vào clipboard.');
      } catch {
        UI.showError('Không copy được (trình duyệt chặn clipboard).');
      }
    });

    UI.el.newBtn.addEventListener('click', () => {
      if (UI.getTranscript().trim() && !confirm('Xoá văn bản hiện tại và bắt đầu phiên mới?')) {
        return;
      }
      if (recording) finishRecording();
      UI.setTitle('Ghi chú cá nhân');
      UI.showTranscript('');
      UI.showInterim('');
      TTS.stopBrowser();
      resetPlayButton();
      invalidateTtsBlob();
      Session.create('Ghi chú cá nhân');
      clearDraft();
    });
  }

  // ---------------------------------------------------------------
  // TTS + Lưu file
  // ---------------------------------------------------------------

  function wireTtsAndSave() {
    UI.el.playBtn.addEventListener('click', onPlayClick);
    UI.el.exportTxtBtn.addEventListener('click', onExportTxtClick);
    UI.el.exportDocxBtn.addEventListener('click', onExportDocxClick);
    UI.el.exportMp3Btn.addEventListener('click', onExportMp3Click);
  }

  // Nút "Nghe đọc" rẽ nhánh theo engine đang chọn:
  //  - 'cloud'   (Google/Azure): tạo Blob MP3 -> phát bằng <audio>, có thể Lưu .MP3
  //  - 'browser' (Web Speech)  : đọc thẳng ra loa, bấm lần nữa để Dừng, KHÔNG có MP3
  async function onPlayClick() {
    if (TTS.getEngine() === 'browser') {
      playWithBrowser();
    } else {
      await playWithCloud();
    }
  }

  function resetPlayButton() {
    UI.el.playBtn.disabled = false;
    if (playBtnDefaultHtml) UI.el.playBtn.innerHTML = playBtnDefaultHtml;
  }

  function invalidateTtsBlob() {
    if (lastTtsBlob === null) return;
    lastTtsBlob = null;
    refreshMp3Button();
  }

  // Chỉ hiện "Lưu .MP3" khi: engine Cloud + đã có audio hợp lệ (chưa bị sửa văn bản).
  function refreshMp3Button() {
    UI.setMp3ButtonVisible(TTS.getEngine() === 'cloud' && lastTtsBlob !== null);
  }

  function playWithBrowser() {
    // Đang đọc -> bấm lần nữa là Dừng
    if (TTS.isBrowserSpeaking()) {
      TTS.stopBrowser();
      resetPlayButton();
      return;
    }

    const text = UI.getTranscript().trim();
    if (!text) {
      UI.showInfo('Chưa có văn bản để đọc.');
      return;
    }
    if (!TTS.isBrowserSupported()) {
      UI.showError('Trình duyệt này không hỗ trợ đọc văn bản. Hãy chọn Google/Azure trong phần cấu hình.');
      return;
    }

    // Engine browser không dùng <audio> -> dừng/ẩn player của lần đọc Cloud trước (nếu có)
    UI.el.ttsAudio.pause();
    UI.el.ttsAudio.hidden = true;

    UI.el.playBtn.textContent = 'Dừng đọc';
    try {
      TTS.speakBrowser(text, UI.getSelectedVoice(), UI.getSelectedSpeed(), {
        onProgress: (i, total) => {
          UI.el.playBtn.textContent = total > 1 ? `Dừng đọc (${i}/${total})` : 'Dừng đọc';
        },
        onEnd: resetPlayButton,
        onError: (err) => {
          resetPlayButton();
          UI.showError(err.message);
        },
      });
    } catch (err) {
      resetPlayButton();
      UI.showError(err.message || 'Không đọc được bằng giọng trình duyệt');
    }
  }

  async function playWithCloud() {
    const text = UI.getTranscript().trim();
    if (!text) {
      UI.showInfo('Chưa có văn bản để đọc.');
      return;
    }
    if (text.length > MAX_TTS_CHARS) {
      UI.showError(
        `Văn bản đang có ${text.length.toLocaleString('vi-VN')} ký tự, vượt giới hạn ` +
        `${MAX_TTS_CHARS.toLocaleString('vi-VN')} ký tự cho 1 lần đọc. Hãy rút gọn.`
      );
      return;
    }

    const voice = UI.getSelectedVoice();
    const speed = UI.getSelectedSpeed();

    UI.el.playBtn.disabled = true;
    UI.el.playBtn.textContent = 'Đang tạo giọng đọc…';

    try {
      const audioBlob = await TTS.synthesize(text, voice, speed, (done, total) => {
        UI.el.playBtn.textContent =
          total > 1 ? `Đang tạo giọng đọc (${done}/${total})…` : 'Đang tạo giọng đọc…';
      });
      lastTtsBlob = audioBlob; // giữ lại để nút "Lưu .MP3" dùng, không tạo lại từ đầu
      refreshMp3Button();
      const url = URL.createObjectURL(audioBlob);
      UI.el.ttsAudio.src = url;
      UI.el.ttsAudio.hidden = false;
      await UI.el.ttsAudio.play();
    } catch (err) {
      UI.showError(err.message || 'TTS service unavailable');
    } finally {
      resetPlayButton();
    }
  }

  function onExportTxtClick() {
    const text = UI.getTranscript().trim();
    if (!text) {
      UI.showInfo('Chưa có văn bản để xuất.');
      return;
    }
    TextSave.exportTxt(text, UI.getTitle());
    UI.showLoading('save', 'Đã lưu .txt ✓');
  }

  async function onExportDocxClick() {
    const text = UI.getTranscript().trim();
    if (!text) {
      UI.showInfo('Chưa có văn bản để xuất.');
      return;
    }
    try {
      await TextSave.exportDocx(text, UI.getTitle());
      UI.showLoading('save', 'Đã lưu .docx ✓');
    } catch (err) {
      UI.showError(err.message || 'Xuất DOCX thất bại');
    }
  }
  
  function onExportMp3Click() {
    if (!lastTtsBlob) {
      UI.showInfo('Chưa có audio để lưu — chọn giọng Google/Azure rồi bấm "Nghe đọc" trước.');
      return;
    }
    TextSave.exportMp3(lastTtsBlob, UI.getTitle());
    UI.showLoading('save', 'Đã lưu .mp3 ✓');
  }

  // ---------------------------------------------------------------
  // Autosave draft (localStorage) — xoá khi bấm "New"
  // ---------------------------------------------------------------

  function scheduleDraftSave() {
    clearTimeout(draftDebounce);
    draftDebounce = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ title: UI.getTitle(), text: UI.getTranscript() })
        );
      } catch {
        /* localStorage đầy hoặc bị chặn — bỏ qua, không phải lỗi nghiêm trọng */
      }
    }, 500);
  }

  function restoreDraftIfAny() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft && draft.text) {
        UI.setTitle(draft.title);
        UI.showTranscript(draft.text);
        Session.setTitle(draft.title);
        UI.showInfo('Đã khôi phục bản nháp lần trước.');
      }
    } catch {
      /* draft hỏng -> bỏ qua */
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }

  // ---------------------------------------------------------------
  // Phím tắt: Space bật/tắt ghi âm (trừ khi đang gõ vào 1 field khác)
  // ---------------------------------------------------------------

  function wireShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Space') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
      e.preventDefault();
      onRecordClick();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
