(window.EfukuriContent && window.EfukuriContent.ready || Promise.resolve()).then(function () {
  'use strict';

  var store = window.EfukuriContent;
  var form = document.getElementById('sectionSettingsForm');
  var sectionId = form && form.getAttribute('data-section-id');
  var status = document.getElementById('sectionSettingsStatus');
  var submitButton = form && form.querySelector('[type="submit"]');

  if (!store || !form || !sectionId || !store.limits.section) return;

  function field(name) { return form.elements.namedItem(name); }
  function value(name) {
    var input = field(name);
    return input ? String(input.value || '').trim() : '';
  }
  function setValue(name, nextValue) {
    var input = field(name);
    if (input) input.value = nextValue || '';
  }
  function showStatus(text, kind) {
    if (!status) return;
    status.textContent = text;
    status.className = 'admin-section-settings__status is-' + (kind || 'success');
    status.hidden = false;
  }
  function currentItem() {
    var fallback = store.defaults.section.find(function (item) { return item.id === sectionId; }) || {};
    var stored = store.getAll('section').find(function (item) { return item.id === sectionId; }) || {};
    return Object.assign({}, fallback, stored);
  }
  function populate() {
    var item = currentItem();
    ['eyebrow', 'title', 'lead', 'note', 'badgeText', 'linkLabel', 'linkUrl'].forEach(function (name) {
      setValue(name, item[name]);
    });
    var badgeVisible = field('badgeVisible');
    if (badgeVisible) badgeVisible.checked = item.badgeVisible !== false;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!value('title')) {
      showStatus('見出しタイトルを入力してください。', 'error');
      field('title').focus();
      return;
    }
    if (field('linkUrl') && !store.isAllowedTargetUrl(value('linkUrl'))) {
      showStatus('リンクURLは https:// で始まるURL、または内部HTMLを入力してください。', 'error');
      field('linkUrl').focus();
      return;
    }
    if (!window.confirm('トップページの見出し設定を保存しますか？\n保存すると会員トップへ反映されます。')) return;

    var next = currentItem();
    ['eyebrow', 'title', 'lead', 'note', 'badgeText', 'linkLabel', 'linkUrl'].forEach(function (name) {
      if (field(name)) next[name] = value(name);
    });
    if (field('badgeVisible')) next.badgeVisible = field('badgeVisible').checked;
    next.id = sectionId;
    next.visible = true;
    next.updatedAt = new Date().toISOString();

    var items = store.getAll('section');
    var found = false;
    items = items.map(function (item) {
      if (item.id !== sectionId) return item;
      found = true;
      return next;
    });
    if (!found) items.push(next);

    if (submitButton) submitButton.disabled = true;
    showStatus('サーバーへ保存しています…');
    store.saveAll('section', items);
    store.flush().then(function () {
      showStatus('見出し設定を保存しました。会員トップへ反映されています。');
    }).catch(function () {
      showStatus('サーバーへ保存できませんでした。通信状態を確認してください。', 'error');
    }).finally(function () {
      if (submitButton) submitButton.disabled = false;
    });
  });

  populate();
});
