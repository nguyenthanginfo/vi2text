/**
 * theme.js — quản lý theme sáng/tối, lưu lựa chọn vào localStorage.
 * Token màu thực tế nằm ở css/style.css ([data-theme="dark"/"light"]).
 */
const Theme = (() => {
  const KEY = 'micapp_theme';

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  function load() {
    return localStorage.getItem(KEY) || 'dark';
  }

  function toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    apply(next);
    localStorage.setItem(KEY, next);
    return next;
  }

  function init() {
    apply(load());
  }

  return { init, toggle };
})();
