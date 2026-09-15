(window.EfukuriContent && window.EfukuriContent.ready || Promise.resolve()).then(function () {
  'use strict';

  var store = window.EfukuriContent;
  var id = new URLSearchParams(window.location.search).get('id') || '';
  var item = store && store.getPublished('expert').find(function (expert) { return expert.id === id; });
  var title = document.getElementById('expertPageTitle');
  var category = document.getElementById('expertCategory');
  var navTitle = document.getElementById('expertNavTitle');
  var frame = document.getElementById('expertFrame');
  var note = document.getElementById('expertEmbedNote');

  if (!item || !store.isAllowedTargetUrl(item.targetUrl)) {
    title.textContent = '相談窓口を表示できません';
    category.textContent = 'EXPERT NOT FOUND';
    navTitle.textContent = '専門家相談';
    frame.removeAttribute('src');
    note.textContent = '相談窓口が非表示、公開期間外、または対象URLが正しくありません。';
    return;
  }

  document.title = item.title + '相談 | rally 資産形成';
  title.textContent = item.title + '相談';
  category.textContent = item.consultationLabel || '専門家へ相談する';
  navTitle.textContent = item.title;
  frame.title = item.title + '相談';
  frame.src = item.targetUrl;

  try {
    var parsed = new URL(item.targetUrl, window.location.href);
    note.textContent = parsed.origin === window.location.origin
      ? '※サイト内の申し込みページを表示しています。'
      : '※提携先サイト「' + parsed.hostname + '」を表示しています。';
  } catch (e) {
    note.textContent = '※登録された専門家相談ページを表示しています。';
  }
});
