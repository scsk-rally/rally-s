(window.EfukuriContent && window.EfukuriContent.ready || Promise.resolve()).then(function () {
  'use strict';
  var store = window.EfukuriContent;
  var form = document.getElementById('menuForm');
  var editor = document.getElementById('menuEditor');
  var preview = document.getElementById('menuPreview');
  var message = document.getElementById('adminMessage');
  var logoutButton = document.getElementById('adminLogout');
  if (!store || !form || !editor || !preview) return;

  form.addEventListener('keydown', function (event) {
    var target = event.target;
    var tagName = target && target.tagName;
    var inputType = target && String(target.type || '').toLowerCase();
    if (event.key !== 'Enter' || event.isComposing) return;
    if (tagName === 'TEXTAREA' || tagName === 'BUTTON' || tagName === 'SELECT') return;
    if (inputType === 'file' || inputType === 'checkbox' || inputType === 'radio' || inputType === 'submit') return;
    event.preventDefault();
  });

  var fallback = store.defaults.menu[0];
  var stored = store.getAll('menu')[0] || {};
  var icons = { home:'⌂', seminar:'告', fp:'時', investment:'柱', expert:'秤', video:'映', article:'本', lifeplan:'線', roboadvisor:'AI', medical:'医', learning:'学' };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function orderValue(value, fallbackOrder) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallbackOrder;
  }
  function sortItems(items) {
    return items.map(function (item, index) { return { item:item, index:index }; })
      .sort(function (a, b) {
        return orderValue(a.item.order, a.index + 1) - orderValue(b.item.order, b.index + 1) || a.index - b.index;
      })
      .map(function (entry) { return entry.item; });
  }
  function normalize() {
    var result = clone(fallback);
    var storedGroups = Array.isArray(stored.groups) ? stored.groups : [];
    result.groups = fallback.groups.map(function (group, groupIndex) {
      var savedGroup = storedGroups[groupIndex] || {};
      var savedItems = Array.isArray(savedGroup.items) ? savedGroup.items : [];
      var mergedItems = group.items.map(function (item, itemIndex) {
        var saved = savedItems.find(function (entry) { return entry && entry.id === item.id; }) || {};
        var merged = Object.assign({}, item, saved);
        merged.order = orderValue(merged.order, itemIndex + 1);
        return merged;
      });
      savedItems.forEach(function (item) {
        if (item && item.id && !mergedItems.some(function (entry) { return entry.id === item.id; })) {
          var added = Object.assign({ label:'新しいメニュー', url:'dashboard.html', visible:true, custom:true }, item);
          added.order = orderValue(added.order, mergedItems.length + 1);
          mergedItems.push(added);
        }
      });
      return {
        title: savedGroup.title || group.title,
        items: sortItems(mergedItems)
      };
    });
    result.updatedAt = stored.updatedAt || fallback.updatedAt;
    return result;
  }
  var config = normalize();

  function showMessage(text, kind) {
    message.textContent = text;
    message.className = 'admin-message is-' + (kind || 'success');
    message.hidden = false;
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(function () { message.hidden = true; }, 3600);
  }
  function createInput(className, value, label) {
    var input = document.createElement('input');
    input.className = className; input.type = 'text'; input.value = value || ''; input.required = true; input.setAttribute('aria-label', label);
    return input;
  }
  function renderEditor() {
    editor.replaceChildren();
    config.groups.forEach(function (group, groupIndex) {
      var section = document.createElement('fieldset'); section.className = 'admin-menu-group-editor'; section.dataset.group = groupIndex;
      var legend = document.createElement('legend'); legend.textContent = 'GROUP ' + String(groupIndex + 1).padStart(2, '0');
      var titleLabel = document.createElement('label'); titleLabel.className = 'admin-menu-group-title';
      var titleCaption = document.createElement('span'); titleCaption.textContent = 'グループ見出し';
      var titleInput = createInput('admin-menu-group-title-input', group.title, 'グループ' + (groupIndex + 1) + 'の見出し');
      titleLabel.append(titleCaption, titleInput); section.append(legend, titleLabel);
      group.items.forEach(function (item, itemIndex) {
        var row = document.createElement('div'); row.className = 'admin-menu-item-editor'; row.dataset.item = item.id;
        var orderLabel = document.createElement('label'); orderLabel.className = 'admin-menu-order';
        var orderCaption = document.createElement('span'); orderCaption.textContent = '表示順';
        var orderInput = document.createElement('input'); orderInput.type = 'number'; orderInput.className = 'admin-menu-order-input'; orderInput.min = '1'; orderInput.max = '99'; orderInput.step = '1'; orderInput.required = true; orderInput.value = orderValue(item.order, itemIndex + 1); orderInput.setAttribute('aria-label', item.id + 'の表示順');
        orderLabel.append(orderCaption, orderInput);
        var fields = document.createElement('div'); fields.className = 'admin-menu-item-editor__fields';
        var labelInput = createInput('admin-menu-label-input', item.label, item.id + 'のメニュー名');
        var urlInput = createInput('admin-menu-url-input', item.url, item.id + 'のリンクURL');
        labelInput.placeholder = 'メニュー名'; urlInput.placeholder = 'page.html／#section／https://...';
        fields.append(labelInput, urlInput);
        var actions = document.createElement('div'); actions.className = 'admin-menu-item-editor__actions';
        var visibleLabel = document.createElement('label'); visibleLabel.className = 'admin-menu-visible';
        var checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'admin-menu-visible-input'; checkbox.checked = item.visible !== false;
        var visibleText = document.createElement('span'); visibleText.textContent = '表示'; visibleLabel.append(checkbox, visibleText);
        actions.appendChild(visibleLabel);
        if (item.custom) {
          var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'admin-menu-item-remove'; remove.textContent = '削除'; remove.dataset.removeItem = item.id;
          actions.appendChild(remove);
        }
        row.append(orderLabel, fields, actions); section.appendChild(row);
      });
      var add = document.createElement('button'); add.type = 'button'; add.className = 'admin-menu-item-add'; add.dataset.addGroup = groupIndex; add.textContent = '＋ このグループにメニューを追加';
      section.appendChild(add);
      editor.appendChild(section);
    });
  }
  function collect() {
    var groups = Array.from(editor.querySelectorAll('.admin-menu-group-editor'));
    config.groups = groups.map(function (section, groupIndex) {
      var currentItems = config.groups[groupIndex].items;
      return {
        title: section.querySelector('.admin-menu-group-title-input').value.trim(),
        items: Array.from(section.querySelectorAll('.admin-menu-item-editor')).map(function (row) {
          var itemId = row.dataset.item;
          var currentItem = currentItems.find(function (item) { return item.id === itemId; }) || { id:itemId, custom:true };
          return {
            id: itemId,
            label: row.querySelector('.admin-menu-label-input').value.trim(),
            url: row.querySelector('.admin-menu-url-input').value.trim(),
            order: Number(row.querySelector('.admin-menu-order-input').value),
            visible: row.querySelector('.admin-menu-visible-input').checked,
            custom: Boolean(currentItem.custom)
          };
        })
      };
    });
  }
  function validUrl(url) { return /^#[A-Za-z][\w:-]*$/.test(url) || store.isAllowedTargetUrl(url); }
  function renderPreview() {
    collect(); preview.replaceChildren();
    config.groups.forEach(function (group) {
      var visibleItems = sortItems(group.items).filter(function (item) { return item.visible; });
      if (!visibleItems.length) return;
      var title = document.createElement('strong'); title.className = 'admin-menu-preview__group'; title.textContent = group.title || 'グループ見出し'; preview.appendChild(title);
      visibleItems.forEach(function (item) {
        var row = document.createElement('div'); row.className = 'admin-menu-preview__item';
        var icon = document.createElement('span'); icon.textContent = icons[item.id] || '連';
        var label = document.createElement('b'); label.textContent = item.label || 'メニュー名';
        row.append(icon, label); preview.appendChild(row);
      });
    });
  }

  renderEditor(); renderPreview();
  editor.addEventListener('click', function (event) {
    var addButton = event.target.closest('[data-add-group]');
    if (addButton) {
      collect();
      var groupIndex = Number(addButton.dataset.addGroup);
      var nextOrder = config.groups[groupIndex].items.reduce(function (max, item, index) {
        return Math.max(max, orderValue(item.order, index + 1));
      }, 0) + 1;
      config.groups[groupIndex].items.push({
        id: store.makeId('menu'), label: '新しいメニュー', url: 'dashboard.html', order: nextOrder, visible: true, custom: true
      });
      renderEditor(); renderPreview();
      var addedRows = editor.querySelectorAll('.admin-menu-group-editor[data-group="' + groupIndex + '"] .admin-menu-item-editor');
      var addedRow = addedRows[addedRows.length - 1];
      if (addedRow) { addedRow.scrollIntoView({ behavior:'smooth', block:'center' }); addedRow.querySelector('.admin-menu-label-input').focus(); }
      return;
    }
    var removeButton = event.target.closest('[data-remove-item]');
    if (removeButton) {
      collect();
      var row = removeButton.closest('.admin-menu-item-editor');
      var section = removeButton.closest('.admin-menu-group-editor');
      var removeGroupIndex = Number(section.dataset.group);
      var item = config.groups[removeGroupIndex].items.find(function (entry) { return entry.id === row.dataset.item; });
      if (!item || !window.confirm('「' + item.label + '」を削除しますか？\nこの操作は取り消せません。')) return;
      config.groups[removeGroupIndex].items = config.groups[removeGroupIndex].items.filter(function (entry) { return entry.id !== item.id; });
      renderEditor(); renderPreview(); showMessage('追加メニューを削除しました。保存すると会員サイトへ反映されます。');
    }
  });
  form.addEventListener('input', renderPreview);
  form.addEventListener('change', renderPreview);
  form.addEventListener('submit', function (event) {
    event.preventDefault(); collect();
    for (var groupIndex = 0; groupIndex < config.groups.length; groupIndex += 1) {
      var group = config.groups[groupIndex];
      if (!group.title) { showMessage('すべてのグループ見出しを入力してください。', 'error'); return; }
      for (var itemIndex = 0; itemIndex < group.items.length; itemIndex += 1) {
        var item = group.items[itemIndex];
        if (!item.label || !item.url) { showMessage('すべてのメニュー名とリンクURLを入力してください。', 'error'); return; }
        if (!Number.isInteger(item.order) || item.order < 1 || item.order > 99) { showMessage('表示順は1〜99の整数で入力してください。', 'error'); return; }
        if (!validUrl(item.url)) { showMessage('リンクURLは内部HTML、ページ内リンク、またはhttps://から始まるURLで入力してください。', 'error'); return; }
      }
    }
    if (!window.confirm('左メニューの変更内容を保存しますか？\n保存すると会員サイトへ反映されます。')) return;
    config.groups.forEach(function (group) { group.items = sortItems(group.items); });
    config.id = stored.id || 'menu-default-1'; config.updatedAt = new Date().toISOString();
    store.saveAll('menu', [config]);
    store.flush().then(function () {
      stored = clone(config); renderEditor(); renderPreview(); showMessage('左メニューを更新しました。');
    }).catch(function () { showMessage('サーバーへ保存できませんでした。', 'error'); });
  });
  if (logoutButton) logoutButton.addEventListener('click', function () { window.EfukuriAdminLogout(); });
});
