/**
 * session.js
 * KHÔNG còn gọi server (đã bỏ hẳn PHP/lưu trữ phía server). "Phiên" giờ
 * chỉ là 1 id + title giữ trong bộ nhớ trình duyệt, dùng để đặt tên file
 * khi xuất TXT/DOCX.
 */
const Session = (() => {
  let current = null; // { id, title }

  function create(title) {
    current = {
      id: formatId(new Date()),
      title: title || 'Ghi chú cá nhân',
    };
    return current;
  }

  function setTitle(title) {
    if (current) current.title = title;
  }

  function get() {
    return current;
  }

  function id() {
    return current ? current.id : null;
  }

  function title() {
    return current ? current.title : 'Ghi chú cá nhân';
  }

  function formatId(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_` +
      `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    );
  }

  return { create, setTitle, get, id, title };
})();
