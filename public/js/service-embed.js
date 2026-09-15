(window.EfukuriContent && window.EfukuriContent.ready || Promise.resolve()).then(function () {
  'use strict';

  var store = window.EfukuriContent;
  var id = new URLSearchParams(window.location.search).get('id') || '';
  var item = store && store.getPublished('service').find(function (service) { return service.id === id; });
  var title = document.getElementById('servicePageTitle');
  var category = document.getElementById('serviceCategory');
  var navTitle = document.getElementById('serviceNavTitle');
  var frame = document.getElementById('serviceFrame');
  var note = document.getElementById('serviceEmbedNote');

  if (!item || !store.isAllowedTargetUrl(item.targetUrl)) {
    title.textContent = 'サービスを表示できません';
    category.textContent = 'SERVICE NOT FOUND';
    navTitle.textContent = '会員向けサービス';
    frame.removeAttribute('src');
    note.textContent = 'サービスが非表示、公開期間外、または対象URLが正しくありません。';
    return;
  }

  if (item.linkMode === 'direct') {
    window.location.replace(item.targetUrl);
    return;
  }

  document.title = item.title + ' | rally 資産形成';
  title.textContent = item.title;
  category.textContent = item.category || '会員向けサービス';
  navTitle.textContent = item.title;
  frame.title = item.title;
  frame.src = item.targetUrl;

  try {
    var parsed = new URL(item.targetUrl, window.location.href);
    note.textContent = parsed.origin === window.location.origin
      ? '※サイト内ページを表示しています。'
      : '※提携先サイト「' + parsed.hostname + '」をiframeで表示しています。';
  } catch (e) {
    note.textContent = '※登録されたサービスページを表示しています。';
  }
});
