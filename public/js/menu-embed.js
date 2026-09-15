(window.EfukuriContent && window.EfukuriContent.ready || Promise.resolve()).then(function () {
  'use strict';

  var store = window.EfukuriContent;
  var id = new URLSearchParams(window.location.search).get('id') || '';
  var stored = store && store.getAll('menu')[0];
  var groups = stored && Array.isArray(stored.groups) ? stored.groups : [];
  var foundGroup = null;
  var item = null;

  groups.some(function (group) {
    var items = Array.isArray(group.items) ? group.items : [];
    item = items.find(function (entry) { return entry && entry.id === id; }) || null;
    if (item) foundGroup = group;
    return Boolean(item);
  });

  var pageTitle = document.getElementById('menuPageTitle');
  var category = document.getElementById('menuPageCategory');
  var groupTitle = document.getElementById('menuGroupTitle');
  var navTitle = document.getElementById('menuNavTitle');
  var navLink = document.getElementById('menuNavLink');
  var frame = document.getElementById('menuFrame');
  var note = document.getElementById('menuEmbedNote');
  var menuToggle = document.getElementById('menuToggle');
  var sideNav = document.getElementById('sideNav');

  if (!item || item.visible === false || !store.isAllowedTargetUrl(item.url)) {
    pageTitle.textContent = 'ページを表示できません';
    category.textContent = 'MENU NOT FOUND';
    groupTitle.textContent = '会員メニュー';
    navTitle.textContent = '会員ホームへ戻る';
    navLink.href = 'dashboard.html';
    frame.removeAttribute('src');
    note.textContent = 'メニューが非表示、削除済み、またはリンクURLが正しくありません。';
  } else {
    document.title = item.label + ' | rally 資産形成';
    pageTitle.textContent = item.label;
    category.textContent = foundGroup.title || '会員メニュー';
    groupTitle.textContent = foundGroup.title || '会員メニュー';
    navTitle.textContent = item.label;
    navLink.href = 'embed-menu.html?id=' + encodeURIComponent(item.id);
    frame.title = item.label;

    try {
      var parsed = new URL(item.url, window.location.href);
      if (window.location.protocol === 'file:' && parsed.protocol === 'file:') {
        parsed.searchParams.set('fromMenu', '1');
        window.location.replace(parsed.href);
        return;
      }
      frame.src = parsed.href;
      note.textContent = parsed.origin === window.location.origin
        ? '※サイト内ページをiframeで表示しています。'
        : '※提携先サイト「' + parsed.hostname + '」をiframeで表示しています。';
    } catch (e) {
      frame.src = item.url;
      note.textContent = '※登録されたページをiframeで表示しています。';
    }
  }

  if (menuToggle && sideNav) {
    menuToggle.addEventListener('click', function () {
      var isOpen = sideNav.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }
});
