/**
 * about.js — chuyển tab đơn giản, không phụ thuộc thư viện nào.
 * Mỗi nhóm tab là 1 khối .tabs; nút bấm .tabs__btn có data-tab trỏ tới
 * id của .tabs__panel tương ứng trong CÙNG khối .tabs đó.
 */
(function () {
  function wireTabGroup(group) {
    const buttons = group.querySelectorAll('.tabs__btn');
    const panels = group.querySelectorAll('.tabs__panel');

    function activate(id) {
      buttons.forEach((btn) => btn.setAttribute('aria-selected', String(btn.dataset.tab === id)));
      panels.forEach((panel) => {
        // CSS chọn theo đúng chuỗi data-active="true" (xem gioithieu.css) — PHẢI
        // dùng setAttribute/removeAttribute, KHÔNG dùng toggleAttribute(name, true):
        // toggleAttribute chỉ gán data-active="" (rỗng) chứ không phải "true",
        // nên sẽ không khớp CSS và panel vẫn bị ẩn dù đã "chuyển tab".
        if (panel.id === id) {
          panel.setAttribute('data-active', 'true');
        } else {
          panel.removeAttribute('data-active');
        }
      });
    }

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => activate(btn.dataset.tab));
    });
  }

  document.querySelectorAll('.tabs').forEach(wireTabGroup);
})();
