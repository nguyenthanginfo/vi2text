# Ghi Chép — Mic App (bản Web Speech API, chỉ MIC)

Nhánh "mic-only" của `voice-app`, thay toàn bộ phần STT (nhận diện giọng
nói) từ Google Cloud/Azure (cắt chunk gửi REST) sang **Web Speech API**
có sẵn của trình duyệt — miễn phí, không cần API key, real-time. Phần
TTS ("Nghe đọc") vẫn dùng Google/Azure như bản gốc, không đổi.

## Khác gì so với `voice-app`

| | voice-app (gốc) | mic-app (bản này) |
|---|---|---|
| STT | Google Cloud / Azure REST, cắt chunk 3-5s | Web Speech API của trình duyệt |
| Nguồn thu | Chọn được: mic (nhiều thiết bị) **hoặc** âm thanh tab/hệ thống, đổi giữa chừng không gián đoạn | **Chỉ mic mặc định**, không có dropdown chọn nguồn |
| Chi phí STT | Tính theo phút qua Google/Azure | **Miễn phí** |
| Cần API key cho STT | Có | **Không** |
| Độ trễ | Vài giây/chunk | Gần thời gian thực (có dòng "đang nói" hiện tạm) |
| Trình duyệt hỗ trợ | Mọi trình duyệt hiện đại (REST call bình thường) | **Chỉ ổn định trên Chrome/Edge** (Firefox không hỗ trợ, Safari chập chờn) |
| Lưu file audio gốc | Có (`Recorder.getFullBlob()`, chưa nối UI) | **Không có** — Web Speech API không trả lại audio đã ghi |
| TTS (Nghe đọc) | Google/Azure | Không đổi — vẫn Google/Azure |

Mọi phần khác (theme sáng/tối, VU meter, VAD tự dừng khi im lặng 60s,
giới hạn 20 phút/phiên, Copy/New, đếm ký tự, autosave draft, xuất
TXT/DOCX, phím tắt Space, PWA) **giữ nguyên y hệt** `voice-app`.

## Vì sao bỏ dropdown chọn nguồn thu

`SpeechRecognition` (Web Speech API) tự quản lý việc mở mic bên trong nó
— không có API nào để truyền vào một `MediaStream` tùy ý (như audio tab
đang phát qua `getDisplayMedia`, hay 1 thiết bị mic cụ thể). Vì vậy ứng
dụng không còn gì để cho người dùng chọn — luôn là mic mặc định của hệ
thống/trình duyệt.

VU meter + VAD (tự dừng khi im lặng) vẫn hoạt động nhờ mở thêm 1
`getUserMedia()` riêng (xem `js/mic-meter.js`) chỉ để đọc mức tín hiệu —
độc lập hoàn toàn với việc `SpeechRecognition` tự thu mic bên trong nó.
Trình duyệt chỉ hỏi quyền mic 1 lần, không có gì bất thường khi 2 hệ
thống cùng đọc từ 1 mic.

## Giới hạn cần biết

- Chrome hay tự ngắt `continuous` mode sau một khoảng — `speech-recognizer.js`
  tự động `start()` lại ngay khi phát hiện việc này, nhưng nếu thấy đôi
  lúc mất vài trăm ms lúc chuyển tiếp, đó là do độ trễ tự khởi động lại
  của chính API, không phải lỗi code.
- Không có timestamp theo câu từ Web Speech API, nên không áp được
  heuristic dấu câu theo khoảng lặng như bản Google Cloud STT — mỗi kết
  quả "final" (engine tự chốt câu) được thêm dấu chấm nếu chưa có, rồi
  xuống dòng.
- Muốn đổi ngôn ngữ nhận diện: sửa hằng số `LANG` trong
  `js/speech-recognizer.js` (đang để `'vi-VN'`).
- Nếu mở bằng Firefox/trình duyệt không hỗ trợ: nút ghi âm sẽ bị disable
  kèm thông báo, không crash.
