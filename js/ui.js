/**
 * ui.js
 * Quản lý toàn bộ DOM. Không biết SpeechRecognition/Google/Azure hoạt
 * động ra sao — chỉ nhận dữ liệu và hiển thị.
 */
const UI = (() => {
  const el = {
    titleInput: document.getElementById('titleInput'),
    themeToggle: document.getElementById('themeToggle'),

    recordBtn: document.getElementById('recordBtn'),
    vuMeter: document.getElementById('vuMeter'),
    timer: document.getElementById('timer'),
    recStatus: document.getElementById('recStatus'),

    editor: document.getElementById('editor'),
    interimLine: document.getElementById('interimLine'),
    charCount: document.getElementById('charCount'),
    copyBtn: document.getElementById('copyBtn'),
    newBtn: document.getElementById('newBtn'),

    voiceSelect: document.getElementById('voiceSelect'),
    speedSelect: document.getElementById('speedSelect'),
    playBtn: document.getElementById('playBtn'),
    ttsAudio: document.getElementById('ttsAudio'),

    exportTxtBtn: document.getElementById('exportTxtBtn'),
    exportDocxBtn: document.getElementById('exportDocxBtn'),
    exportMp3Btn: document.getElementById('exportMp3Btn'),
    saveStatus: document.getElementById('saveStatus'),

    settingsPanel: document.getElementById('settingsPanel'),
    providerSelect: document.getElementById('providerSelect'),
    googleTtsKey: document.getElementById('googleTtsKey'),
    azureKey: document.getElementById('azureKey'),
    azureRegion: document.getElementById('azureRegion'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),

    toast: document.getElementById('toast'),
  };

  function setRecordingState(isRecording) {
    el.recordBtn.setAttribute('aria-pressed', String(isRecording));
    el.recStatus.textContent = isRecording ? 'Đang nghe…' : 'Sẵn sàng';
  }

  function updateTimer(seconds, maxSeconds) {
    const fmt = (s) => String(Math.floor(s)).padStart(2, '0');
    const mm = (s) => fmt(Math.floor(s / 60));
    const ss = (s) => fmt(Math.floor(s % 60));
    el.timer.textContent = `${mm(seconds)}:${ss(seconds)} / ${mm(maxSeconds)}:${ss(maxSeconds)}`;
  }

  function showTranscript(text) {
    el.editor.value = text;
    el.editor.scrollTop = el.editor.scrollHeight;
    updateCharCount();
  }

  function appendTranscript(text) {
    if (!text) return;
    const needsNewline = el.editor.value && !el.editor.value.endsWith('\n');
    el.editor.value += (needsNewline ? '\n' : '') + text;
    el.editor.scrollTop = el.editor.scrollHeight;
    updateCharCount();
  }

  function getTranscript() {
    return el.editor.value;
  }

  function updateCharCount() {
    el.charCount.textContent = `${el.editor.value.length} ký tự`;
  }

  function showInterim(text) {
    el.interimLine.textContent = text || '';
  }

  function getTitle() {
    return el.titleInput.value.trim() || 'Ghi chú cá nhân';
  }

  function setTitle(title) {
    el.titleInput.value = title || 'Ghi chú cá nhân';
  }

  function setVoiceList(voices) {
    el.voiceSelect.innerHTML = '';
    voices.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.name;
      el.voiceSelect.appendChild(opt);
    });
  }

  function getSelectedVoice() {
    return el.voiceSelect.value;
  }

  function getSelectedSpeed() {
    return parseFloat(el.speedSelect.value);
  }

  // Nút "Lưu .MP3" chỉ hiện khi có audio Cloud hợp lệ để lưu (engine Cloud,
  // đã bấm "Nghe đọc" thành công, và văn bản chưa bị sửa sau đó).
  function setMp3ButtonVisible(visible) {
    el.exportMp3Btn.style.display = visible ? '' : 'none';
  }

  function showLoading(target, message) {
    if (target === 'save') el.saveStatus.textContent = message;
  }

  function showError(message) {
    el.toast.textContent = message;
    el.toast.hidden = false;
    el.toast.style.borderColor = 'var(--danger)';
    clearTimeout(el._toastTimer);
    el._toastTimer = setTimeout(() => (el.toast.hidden = true), 4500);
  }

  function showInfo(message) {
    el.toast.textContent = message;
    el.toast.hidden = false;
    el.toast.style.borderColor = 'var(--accent)';
    clearTimeout(el._toastTimer);
    el._toastTimer = setTimeout(() => (el.toast.hidden = true), 2500);
  }

  function loadSettingsIntoForm(s) {
    el.providerSelect.value = s.provider;
    el.googleTtsKey.value = s.googleTtsKey;
    el.azureKey.value = s.azureKey;
    el.azureRegion.value = s.azureRegion;
    toggleProviderFields(s.provider);
  }

  function readSettingsForm() {
    return {
      provider: el.providerSelect.value,
      googleTtsKey: el.googleTtsKey.value.trim(),
      azureKey: el.azureKey.value.trim(),
      azureRegion: el.azureRegion.value.trim(),
    };
  }

  function toggleProviderFields(provider) {
    document.querySelectorAll('[data-provider]').forEach((elm) => {
      elm.style.display = elm.dataset.provider === provider ? '' : 'none';
    });
  }

  return {
    el,
    setRecordingState,
    updateTimer,
    showTranscript,
    appendTranscript,
    getTranscript,
    updateCharCount,
    showInterim,
    getTitle,
    setTitle,
    setVoiceList,
    getSelectedVoice,
    getSelectedSpeed,
    setMp3ButtonVisible,
    showLoading,
    showError,
    showInfo,
    loadSettingsIntoForm,
    readSettingsForm,
    toggleProviderFields,
  };
})();
