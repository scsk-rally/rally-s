Promise.all([
  window.EfukuriContent && window.EfukuriContent.ready || Promise.resolve(),
  window.EfukuriAdminSession && window.EfukuriAdminSession.ready || Promise.resolve({ isOwner:true, permissions:[] })
]).then(function (readyValues) {
  'use strict';

  var store = window.EfukuriContent;
  var type = document.body.getAttribute('data-content-type');
  var form = document.getElementById('contentForm');
  var list = document.getElementById('contentList');
  var count = document.getElementById('contentCount');
  var submitLabel = document.getElementById('contentSubmitLabel');
  var cancelButton = document.getElementById('contentCancel');
  var logoutButton = document.getElementById('adminLogout');
  var message = document.getElementById('adminMessage');
  var imageInput = document.getElementById('contentImage');
  var imagePreview = document.getElementById('contentImagePreview');
  var imageRemove = document.getElementById('contentImageRemove');
  var editingId = null;
  var currentImage = '';
  var adminSession = readyValues[1] || { isOwner:true, permissions:[] };
  var canManageNotices = adminSession.isOwner === true || (Array.isArray(adminSession.permissions) && adminSession.permissions.indexOf('notice') !== -1);

  if (!store || !form || !list || !store.limits[type]) return;

  if (type === 'seminar' && !canManageNotices && field('postToNotice')) {
    field('postToNotice').disabled = true;
    field('postToNotice').closest('label').title = 'お知らせの権限がある管理者のみ変更できます。';
  }

  form.addEventListener('keydown', function (event) {
    var target = event.target;
    var tagName = target && target.tagName;
    var inputType = target && String(target.type || '').toLowerCase();
    if (event.key !== 'Enter' || event.isComposing) return;
    if (tagName === 'TEXTAREA' || tagName === 'BUTTON' || tagName === 'SELECT') return;
    if (inputType === 'file' || inputType === 'checkbox' || inputType === 'radio' || inputType === 'submit') return;
    event.preventDefault();
  });

  function showMessage(text, kind) {
    message.textContent = text;
    message.className = 'admin-message is-' + (kind || 'success');
    message.hidden = false;
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(function () { message.hidden = true; }, 3600);
  }
  function field(name) { return form.elements.namedItem(name); }
  function value(name) { var input = field(name); return input ? String(input.value || '').trim() : ''; }
  function setValue(name, nextValue) { var input = field(name); if (input) input.value = nextValue || ''; }
  function contentNoun() { return type === 'service' ? 'サービス' : type === 'expert' ? '専門家' : type === 'consultation' ? '相談サービス' : type === 'topic' ? 'トピック' : '投稿'; }
  function isFixedType() { return type === 'consultation' || type === 'topic'; }
  function setImage(image) {
    currentImage = image || '';
    if (!imagePreview) return;
    imagePreview.src = currentImage;
    imagePreview.hidden = !currentImage;
    if (imageRemove) imageRemove.hidden = !currentImage;
  }
  function resetForm() {
    editingId = null;
    form.reset();
    setImage('');
    submitLabel.textContent = isFixedType() ? '変更する項目を選択' : contentNoun() + 'を追加';
    cancelButton.hidden = true;
    if (field('visible')) field('visible').checked = true;
  }
  function validateSchedule(startAt, endAt) {
    if (startAt && endAt && new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      showMessage('公開終了日時は、公開開始日時より後に設定してください。', 'error');
      return false;
    }
    return true;
  }
  function collectItem(existing) {
    var now = new Date().toISOString();
    var item = {
      id: existing ? existing.id : store.makeId(type),
      title: value('title'), visible: Boolean(field('visible') && field('visible').checked),
      startAt: value('startAt'), endAt: value('endAt'),
      createdAt: existing ? existing.createdAt : now, updatedAt: now
    };
    if (type === 'notice') {
      item.body = value('body'); item.linkUrl = value('linkUrl'); item.linkLabel = value('linkLabel') || '詳細を見る';
    }
    if (type === 'seminar') {
      item.summary = value('summary'); item.eventDate = value('eventDate'); item.eventTime = value('eventTime');
      item.format = value('format'); item.audience = value('audience'); item.instructor = value('instructor');
      item.agenda = value('agenda'); item.linkUrl = value('linkUrl'); item.image = currentImage;
      item.postToNotice = Boolean(field('postToNotice') && field('postToNotice').checked);
      item.noticeId = existing ? (existing.noticeId || '') : '';
    }
    if (type === 'video') {
      item.category = value('category'); item.youtubeUrl = value('youtubeUrl');
      item.youtubeId = store.extractYouTubeId(item.youtubeUrl); item.image = currentImage;
      item.duration = value('duration') || (existing && existing.youtubeId === item.youtubeId ? (existing.duration || '') : '');
      item.order = Math.min(5, Math.max(1, parseInt(value('order'), 10) || 1));
    }
    if (type === 'service') {
      item.category = value('category'); item.hint = value('hint'); item.description = value('description');
      item.buttonLabel = value('buttonLabel') || 'サービスを見る'; item.targetUrl = value('targetUrl');
      item.linkMode = value('linkMode') === 'direct' ? 'direct' : 'iframe';
      item.order = Math.max(1, parseInt(value('order'), 10) || 1);
    }
    if (type === 'expert') {
      item.englishLabel = value('englishLabel'); item.consultationLabel = value('consultationLabel');
      item.description = value('description'); item.buttonLabel = value('buttonLabel') || '相談へ進む';
      item.recipientName = value('recipientName'); item.targetUrl = value('targetUrl');
      item.order = Math.max(1, parseInt(value('order'), 10) || 1); item.image = currentImage;
    }
    if (type === 'consultation') {
      item.tag = value('tag'); item.description = value('description');
      item.buttonLabel = value('buttonLabel') || '相談する'; item.targetUrl = value('targetUrl');
      item.order = Math.min(3, Math.max(1, parseInt(value('order'), 10) || 1)); item.image = currentImage;
      item.visible = true;
    }
    if (type === 'topic') {
      item.badge = value('badge'); item.icon = value('icon'); item.subtitle = value('subtitle');
      item.buttonLabel = value('buttonLabel') || '詳しく見る'; item.targetUrl = value('targetUrl');
      item.order = Math.min(4, Math.max(1, parseInt(value('order'), 10) || 1)); item.visible = true;
    }
    return item;
  }
  function validate(item) {
    if (!item.title) { showMessage('タイトルを入力してください。', 'error'); field('title').focus(); return false; }
    if (!validateSchedule(item.startAt, item.endAt)) return false;
    if (type === 'notice' && Array.from(item.body || '').length > 50) {
      showMessage('お知らせ本文は50文字以内で入力してください（現在' + Array.from(item.body || '').length + '文字）。', 'error');
      field('body').focus();
      return false;
    }
    if (type === 'seminar' && item.postToNotice && Array.from(String(item.summary || '').replace(/\r?\n/g, ' ')).length > 50) {
      showMessage('お知らせにも投稿する場合、概要は50文字以内で入力してください（現在' + Array.from(String(item.summary || '').replace(/\r?\n/g, ' ')).length + '文字）。', 'error');
      field('summary').focus();
      return false;
    }
    if (type === 'video' && !item.youtubeId) { showMessage('正しいYouTube URLを入力してください。', 'error'); field('youtubeUrl').focus(); return false; }
    if (type === 'video' && item.duration && !/^(?:\d+:[0-5]\d|\d+:[0-5]\d:[0-5]\d)$/.test(item.duration)) { showMessage('再生時間は「3:21」または「1:02:30」の形式で入力してください。', 'error'); field('duration').focus(); return false; }
    if (type === 'seminar' && !item.eventDate) { showMessage('開催日を入力してください。', 'error'); field('eventDate').focus(); return false; }
    if (type === 'service' && !store.isAllowedTargetUrl(item.targetUrl)) { showMessage('対象URLは「https://...」または内部のHTMLファイル名で入力してください。', 'error'); field('targetUrl').focus(); return false; }
    if (type === 'expert' && !store.isAllowedTargetUrl(item.targetUrl)) { showMessage('対象URLは「https://...」または内部のHTMLファイル名で入力してください。', 'error'); field('targetUrl').focus(); return false; }
    if (type === 'expert' && !item.image) { showMessage('専門家の画像を選択してください。', 'error'); if (imageInput) imageInput.focus(); return false; }
    if (type === 'consultation' && !store.isAllowedTargetUrl(item.targetUrl)) { showMessage('リンクURLは「https://...」または内部のHTMLファイル名で入力してください。', 'error'); field('targetUrl').focus(); return false; }
    if (type === 'topic' && !store.isAllowedTargetUrl(item.targetUrl) && !/^#[A-Za-z][\w:-]*$/.test(item.targetUrl)) { showMessage('リンクURLは「https://...」、内部のHTMLファイル名、または「#video-section」のようなページ内リンクで入力してください。', 'error'); field('targetUrl').focus(); return false; }
    return true;
  }
  function formatDateTime(value) {
    if (!value) return '指定なし';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('ja-JP', { year:'numeric', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }).format(date);
  }
  function publicationLabel(item) {
    if (!item.visible) return '非表示';
    var now = Date.now();
    if (item.startAt && now < new Date(item.startAt).getTime()) return '公開予約';
    if (item.endAt && now > new Date(item.endAt).getTime()) return '公開終了';
    return '公開中';
  }
  function createButton(label, className, handler) {
    var button = document.createElement('button'); button.type = 'button'; button.className = className; button.textContent = label;
    button.addEventListener('click', handler); return button;
  }
  function syncSeminarNotice(item, existing, changes) {
    if (type !== 'seminar') return true;
    if (!canManageNotices) {
      item.noticeId = existing ? (existing.noticeId || '') : '';
      item.postToNotice = Boolean(item.noticeId);
      return true;
    }
    var notices = store.getAll('notice');
    var linkedNoticeId = existing ? (existing.noticeId || '') : '';
    var linkedNotice = notices.find(function (notice) { return notice.id === linkedNoticeId; }) || null;

    if (!item.postToNotice) {
      if (linkedNoticeId) {
        if (!window.confirm('「お知らせにも投稿する」を解除しますか？\n連動しているお知らせも削除されます。')) return false;
        changes.notice = notices.filter(function (notice) { return notice.id !== linkedNoticeId; });
      }
      item.noticeId = '';
      return true;
    }

    if (!linkedNotice && notices.length >= store.limits.notice) {
      showMessage('お知らせは最大3件です。お知らせを1件削除してから保存してください。', 'error');
      return false;
    }

    var now = new Date().toISOString();
    var notice = {
      id: linkedNotice ? linkedNotice.id : store.makeId('notice'),
      title: item.title,
      body: String(item.summary || '').replace(/\r?\n/g, ' '),
      linkUrl: 'seminar.html',
      linkLabel: 'セミナー情報を見る',
      visible: item.visible,
      startAt: item.startAt,
      endAt: item.endAt,
      createdAt: linkedNotice ? linkedNotice.createdAt : now,
      updatedAt: now,
      sourceType: 'seminar',
      sourceId: item.id
    };
    item.noticeId = notice.id;
    if (linkedNotice) {
      notices = notices.map(function (entry) { return entry.id === notice.id ? notice : entry; });
    } else {
      notices.push(notice);
    }
    changes.notice = notices;
    return true;
  }
  function startEdit(item) {
    editingId = item.id;
    Array.prototype.forEach.call(form.elements, function (input) {
      if (!input.name || input.type === 'file' || input.type === 'checkbox') return;
      if (input.type === 'radio') {
        var selectedValue = Object.prototype.hasOwnProperty.call(item, input.name) ? item[input.name] : input.name === 'linkMode' ? 'iframe' : '';
        input.checked = String(input.value) === String(selectedValue);
        return;
      }
      if (Object.prototype.hasOwnProperty.call(item, input.name)) input.value = item[input.name] || '';
    });
    if (field('visible')) field('visible').checked = item.visible === true;
    if (field('postToNotice')) field('postToNotice').checked = Boolean(item.postToNotice || item.noticeId);
    setImage(item.image || '');
    submitLabel.textContent = '変更を保存'; cancelButton.hidden = false;
    form.querySelector('.admin-submit').disabled = false;
    form.scrollIntoView({ behavior:'smooth', block:'start' });
  }
  function removeItem(item) {
    var linkedSeminars = type === 'notice' ? store.getAll('seminar').filter(function (seminar) {
      return seminar.noticeId === item.id || (item.sourceType === 'seminar' && item.sourceId === seminar.id);
    }) : [];
    var warning = '「' + item.title + '」を削除しますか？';
    if (type === 'seminar' && item.noticeId) warning += '\n連動しているお知らせも同時に削除されます。';
    if (type === 'notice' && linkedSeminars.length) warning += '\n連動元セミナーの「お知らせにも投稿する」設定も解除されます。';
    warning += '\nこの操作は取り消せません。';
    if (!window.confirm(warning)) return;
    var changes = {};
    if (type === 'seminar' && item.noticeId) changes.notice = store.getAll('notice').filter(function (notice) { return notice.id !== item.noticeId; });
    if (type === 'notice' && linkedSeminars.length) {
      var linkedIds = linkedSeminars.map(function (seminar) { return seminar.id; });
      changes.seminar = store.getAll('seminar').map(function (seminar) {
        if (linkedIds.indexOf(seminar.id) !== -1) {
          seminar.noticeId = '';
          seminar.postToNotice = false;
          seminar.updatedAt = new Date().toISOString();
        }
        return seminar;
      });
    }
    var remaining = store.getAll(type).filter(function (entry) { return entry.id !== item.id; });
    if (type === 'video') {
      remaining.sort(function (a, b) { return (Number(a.order) || 999) - (Number(b.order) || 999) || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(); });
      remaining.forEach(function (entry, index) { entry.order = index + 1; });
    }
    changes[type] = remaining;
    store.saveBatch(changes);
    store.flush().then(function () {
      if (editingId === item.id) resetForm();
      render(); showMessage(contentNoun() + 'を削除しました。');
    }).catch(function () { render(); showMessage('サーバーへ保存できませんでした。', 'error'); });
  }
  function toggleItem(item) {
    var willShow = !item.visible;
    if (!window.confirm('「' + item.title + '」を' + (willShow ? '表示' : '非表示') + 'にしますか？\n会員サイトの表示状態が変更されます。')) return;
    var items = store.getAll(type).map(function (entry) {
      if (entry.id === item.id) entry.visible = willShow;
      return entry;
    });
    var changes = {}; changes[type] = items;
    if (type === 'seminar' && item.noticeId) {
      var notices = store.getAll('notice').map(function (notice) {
        if (notice.id === item.noticeId) notice.visible = willShow;
        return notice;
      });
      changes.notice = notices;
    }
    store.saveBatch(changes);
    store.flush().then(function () { render(); showMessage(willShow ? '表示にしました。' : '非表示にしました。'); })
      .catch(function () { render(); showMessage('サーバーへ保存できませんでした。', 'error'); });
  }
  function render() {
    var items = store.getAll(type);
    if (type === 'video') {
      items.sort(function (a, b) { return (Number(a.order) || 999) - (Number(b.order) || 999) || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(); });
      items.forEach(function (item, index) { if (!(Number(item.order) >= 1)) item.order = index + 1; });
    }
    if (type === 'service' || type === 'expert' || isFixedType()) {
      items.sort(function (a, b) { return (Number(a.order) || 999) - (Number(b.order) || 999) || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(); });
    }
    list.replaceChildren(); count.textContent = items.length + ' / ' + store.limits[type] + '件';
    items.forEach(function (item, index) {
      var row = document.createElement('article'); row.className = 'admin-content-item';
      var number = document.createElement('span'); number.className = 'admin-content-item__number'; number.textContent = String(index + 1).padStart(2, '0');
      var info = document.createElement('div'); info.className = 'admin-content-item__info';
      var head = document.createElement('div'); head.className = 'admin-content-item__head';
      var title = document.createElement('strong'); title.textContent = item.title;
      var state = document.createElement('span'); state.className = 'admin-content-item__state is-' + publicationLabel(item); state.textContent = publicationLabel(item);
      head.append(title, state);
      var schedule = document.createElement('small');
      schedule.textContent = type === 'video'
        ? '表示順：' + item.order + ' ／ 公開：' + formatDateTime(item.startAt) + ' 〜 ' + formatDateTime(item.endAt)
        : type === 'service'
        ? '表示順：' + item.order + ' ／ 開き方：' + (item.linkMode === 'direct' ? '直接リンク' : 'iframe表示') + ' ／ 対象：' + item.targetUrl
        : type === 'expert' || isFixedType()
          ? '表示順：' + item.order + ' ／ 対象：' + item.targetUrl
          : '公開：' + formatDateTime(item.startAt) + ' 〜 ' + formatDateTime(item.endAt);
      info.append(head, schedule);
      var actions = document.createElement('div'); actions.className = 'admin-company__actions';
      if (isFixedType()) {
        actions.append(createButton('編集', 'admin-company__edit', function () { startEdit(item); }));
      } else {
        actions.append(createButton(item.visible ? '非表示' : '表示', 'admin-content-item__toggle', function () { toggleItem(item); }), createButton('編集', 'admin-company__edit', function () { startEdit(item); }), createButton('削除', 'admin-company__delete', function () { removeItem(item); }));
      }
      row.append(number, info, actions); list.appendChild(row);
    });
    if (!items.length) { var empty = document.createElement('p'); empty.className = 'admin-content-empty'; empty.textContent = '投稿はまだありません。'; list.appendChild(empty); }
    form.querySelector('.admin-submit').disabled = isFixedType() ? !editingId : !editingId && items.length >= store.limits[type];
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var items = store.getAll(type); var existing = items.find(function (item) { return item.id === editingId; }) || null;
    if (!existing && items.length >= store.limits[type]) { showMessage('登録上限は' + store.limits[type] + '件です。', 'error'); return; }
    var item = collectItem(existing); if (!validate(item)) return;
    if (!window.confirm('「' + item.title + '」を' + (existing ? '更新' : '追加') + 'しますか？\n保存すると会員サイトへ反映されます。')) return;
    var changes = {};
    if (!syncSeminarNotice(item, existing, changes)) return;
    if (isFixedType() && existing) {
      var previousOrder = Number(existing.order) || 1;
      items = items.map(function (entry) {
        if (entry.id !== item.id && Number(entry.order) === Number(item.order)) entry.order = previousOrder;
        return entry;
      });
    }
    if (type === 'video') {
      var orderedVideos = items.filter(function (entry) { return entry.id !== item.id; });
      orderedVideos.sort(function (a, b) { return (Number(a.order) || 999) - (Number(b.order) || 999) || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(); });
      var desiredIndex = Math.min(orderedVideos.length, Math.max(0, Number(item.order) - 1));
      orderedVideos.splice(desiredIndex, 0, item);
      orderedVideos.forEach(function (entry, index) { entry.order = index + 1; });
      items = orderedVideos;
    } else if (existing) items = items.map(function (entry) { return entry.id === item.id ? item : entry; });
    else items.push(item);
    changes[type] = items;
    try { store.saveBatch(changes); } catch (error) { showMessage('保存できませんでした。入力内容を確認してください。', 'error'); return; }
    store.flush().then(function () {
      resetForm(); render(); showMessage(existing ? contentNoun() + 'を更新しました。' : contentNoun() + 'を追加しました。');
    }).catch(function () { showMessage('サーバーへ保存できませんでした。', 'error'); });
  });
  cancelButton.addEventListener('click', resetForm);
  if (imageInput) imageInput.addEventListener('change', function () {
    var file = imageInput.files && imageInput.files[0]; if (!file) return;
    if (!/^image\//.test(file.type)) { showMessage('画像ファイルを選択してください。', 'error'); imageInput.value = ''; return; }
    if (file.size > 12000000) { showMessage('画像は12MB以下のものを使用してください。', 'error'); imageInput.value = ''; return; }
    var submitButton = form.querySelector('.admin-submit');
    if (submitButton) submitButton.disabled = true;
    showMessage('画像をアップロードしています。');
    var data = new FormData(); data.append('file', file); data.append('scope', type);
    fetch('/api/media', { method:'PUT', body:data }).then(function (response) {
      if (!response.ok) throw new Error('upload-failed');
      return response.json();
    }).then(function (body) {
      setImage(body.url);
      showMessage('画像をアップロードしました。保存すると公開サイトへ反映されます。');
    }).catch(function () {
      showMessage('画像をアップロードできませんでした。もう一度お試しください。', 'error');
      imageInput.value = '';
    }).finally(function () { if (submitButton) submitButton.disabled = false; });
  });
  if (imageRemove) imageRemove.addEventListener('click', function () { setImage(''); if (imageInput) imageInput.value = ''; });
  if (logoutButton) logoutButton.addEventListener('click', function () { window.EfukuriAdminLogout(); });
  resetForm(); render();
});
