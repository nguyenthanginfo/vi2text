/**
 * text-save.js
 * Xuất TXT (giữ nguyên xuống dòng, không dồn 1 dòng) và DOCX thật
 * (dùng thư viện docx.js load qua CDN trong index.html — window.docx).
 */
const TextSave = (() => {
  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

 function sanitizeFilename(name) {
    const cleaned = (name || 'ghi-chu').trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
    return cleaned || 'ghi-chu';
  }
 
  /**
   * Chuỗi thời gian viết tắt kiểu ddMMyy_HHmm (vd: 27092026_1614).
   * Đổi thứ tự/format ở đây nếu muốn kiểu khác (ví dụ thêm giây, hoặc
   * năm đầy đủ 4 số thay vì 2 số).
   */
  function formatTimestamp(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const dd = pad(d.getDate());
    const mm = pad(d.getMonth() + 1);
    const yy = String(d.getFullYear()).slice(-2);
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${dd}${mm}${yy}_${hh}${mi}`;
  }
 
  /**
   * Tên file dùng chung cho cả 3 nút xuất: "<title>_<ddMMyy_HHmm>.<ext>".
   */
  function buildFilename(title, ext) {
    return `${sanitizeFilename(title)}_${formatTimestamp()}.${ext}`;
  }
 
  function exportTxt(text, title) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    download(blob, buildFilename(title, 'txt'));
  }
 
  /**
   * Lưu thẳng 1 Blob audio (mp3) đã có sẵn — dùng cho nút "Lưu .MP3",
   * lưu lại đúng audio vừa nghe (kể cả khi TTS đã ghép nhiều đoạn do
   * văn bản dài, xem tts.js), không tạo lại từ đầu.
   */
  function exportMp3(audioBlob, title) {
    download(audioBlob, buildFilename(title, 'mp3'));
  }
 
  async function exportDocx(text, title) {
    if (!window.docx) {
      throw new Error('Thư viện docx chưa tải được (CDN bị chặn).');
    }
    const { Document, Packer, Paragraph, TextRun } = window.docx;
 
    const lines = text.split('\n');
    const paragraphs = lines.length
      ? lines.map((line) => new Paragraph({ children: [new TextRun(line)] }))
      : [new Paragraph('')];
 
    const doc = new Document({ sections: [{ children: paragraphs }] });
    const blob = await Packer.toBlob(doc);
    download(blob, buildFilename(title, 'docx'));
  }
 
  return { exportTxt, exportDocx, exportMp3 };
})();