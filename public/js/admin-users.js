(window.EfukuriAdminAuth && window.EfukuriAdminAuth.ready || Promise.resolve()).then(function () {
  'use strict';

  var auth = window.EfukuriAdminAuth;
  var form = document.getElementById('adminUserForm');
  var idInput = document.getElementById('managedAdminId');
  var passwordInput = document.getElementById('managedAdminPassword');
  var passwordHint = document.getElementById('managedPasswordHint');
  var ipRangesInput = document.getElementById('managedAdminIpRanges');
  var submitButton = document.getElementById('adminUserSubmit');
  var submitLabel = document.getElementById('adminUserSubmitLabel');
  var cancelButton = document.getElementById('adminUserCancel');
  var list = document.getElementById('adminUserList');
  var count = document.getElementById('adminUserCount');
  var status = document.getElementById('adminUsersStatus');
  var analyticsPermission = form && form.querySelector('input[name="permission"][value="analytics"]');
  var analyticsCompanyScope = document.getElementById('analyticsCompanyScope');
  var analyticsCompanyOptions = document.getElementById('analyticsCompanyOptions');
  var admins = [];
  var companies = [];
  var editingId = '';
  var currentIp = '';
  var ipDialog = document.getElementById('adminIpDialog');
  var ipDialogForm = document.getElementById('adminIpDialogForm');
  var ipDialogAdmin = document.getElementById('adminIpDialogAdmin');
  var ipDialogRanges = document.getElementById('adminIpDialogRanges');
  var ipDialogClose = document.getElementById('adminIpDialogClose');
  var ipDialogCancel = document.getElementById('adminIpDialogCancel');
  var ipDialogTarget = '';

  if (!auth || !auth.isOwner() || !form) return;

  var permissionLabels = {
    companies:'企業コード', notice:'お知らせ', seminar:'セミナー', topic:'トピック',
    consultation:'相談サービス', expert:'専門家', video:'動画', service:'サービス',
    mainvisual:'メインビジュアル', menu:'左メニュー', analytics:'アクセス分析'
  };

  function companyNames(ids) {
    return ids.map(function (id) {
      var company = companies.find(function (item) { return item.id === id; });
      return company ? company.name : '削除済み企業';
    });
  }

  function selectedAnalyticsCompanyIds() {
    if (!analyticsPermission.checked) return [];
    return Array.prototype.filter.call(analyticsCompanyOptions.querySelectorAll('input[name="analyticsCompanyId"]'), function (input) { return input.checked; })
      .map(function (input) { return input.value; });
  }

  function toggleAnalyticsScope() {
    analyticsCompanyScope.hidden = !analyticsPermission.checked;
    Array.prototype.forEach.call(analyticsCompanyOptions.querySelectorAll('input'), function (input) { input.disabled = !analyticsPermission.checked; });
  }

  function renderCompanyOptions() {
    analyticsCompanyOptions.replaceChildren();
    companies.forEach(function (company) {
      var label = document.createElement('label');
      var input = document.createElement('input'); input.type = 'checkbox'; input.name = 'analyticsCompanyId'; input.value = company.id;
      var text = document.createElement('span'); text.textContent = company.name;
      label.append(input, text); analyticsCompanyOptions.appendChild(label);
    });
    if (!companies.length) {
      var empty = document.createElement('p'); empty.className = 'admin-company-scope__empty'; empty.textContent = '登録済み企業がありません。先に企業コードを登録してください。'; analyticsCompanyOptions.appendChild(empty);
    }
    toggleAnalyticsScope();
  }

  function showStatus(text, kind) {
    status.textContent = text;
    status.className = 'admin-settings-alert admin-users-status is-' + (kind || 'success');
    status.hidden = false;
  }
  function selectedPermissions() {
    return Array.prototype.filter.call(form.querySelectorAll('input[name="permission"]'), function (input) { return input.checked; })
      .map(function (input) { return input.value; });
  }
  function parseIpRanges(value) {
    return String(value || '').split(/[\n,]+/).map(function (item) { return item.trim().toLowerCase(); }).filter(Boolean);
  }
  function resetForm() {
    editingId = '';
    form.reset();
    passwordInput.required = true;
    passwordHint.textContent = '8文字以上';
    if (ipRangesInput) ipRangesInput.value = '';
    submitLabel.textContent = '管理者を追加';
    cancelButton.hidden = true;
    toggleAnalyticsScope();
  }
  function startEdit(admin) {
    editingId = admin.id;
    idInput.value = admin.id;
    passwordInput.value = '';
    passwordInput.required = false;
    passwordHint.textContent = '変更する場合のみ入力';
    if (ipRangesInput) ipRangesInput.value = (admin.allowedIpRanges || []).join('\n');
    Array.prototype.forEach.call(form.querySelectorAll('input[name="permission"]'), function (input) {
      input.checked = admin.permissions.indexOf(input.value) !== -1;
    });
    Array.prototype.forEach.call(analyticsCompanyOptions.querySelectorAll('input[name="analyticsCompanyId"]'), function (input) {
      input.checked = admin.analyticsCompanyIds.indexOf(input.value) !== -1;
    });
    toggleAnalyticsScope();
    submitLabel.textContent = '変更を保存';
    cancelButton.hidden = false;
    form.scrollIntoView({ behavior:'smooth', block:'start' });
  }
  function request(method, body) {
    return fetch('/api/admin-users', {
      method:method,
      headers:{ 'Content-Type':'application/json' },
      credentials:'same-origin',
      body:method === 'GET' ? undefined : JSON.stringify(body)
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (result) {
        if (!response.ok) throw new Error(result.error || 'admin-save-failed');
        if (result.currentIp) {
          currentIp = result.currentIp;
          Array.prototype.forEach.call(document.querySelectorAll('.current-admin-ip'), function (element) { element.textContent = currentIp; });
        }
        return result;
      });
    });
  }
  function createButton(label, className, handler) {
    var button = document.createElement('button');
    button.type = 'button'; button.className = className; button.textContent = label;
    button.addEventListener('click', handler); return button;
  }
  function removeAdmin(admin) {
    if (!window.confirm('管理者「' + admin.id + '」を削除しますか？\n削除後はこの管理者IDでログインできません。この操作は取り消せません。')) return;
    request('DELETE', { id:admin.id }).then(function (body) {
      admins = body.admins || [];
      if (editingId === admin.id) resetForm();
      render(); showStatus('管理者を削除しました。');
    }).catch(function () { showStatus('管理者を削除できませんでした。', 'error'); });
  }
  function editIpPolicy(admin) {
    if (!ipDialog || !ipDialogRanges) return;
    ipDialogTarget = admin.id;
    ipDialogAdmin.textContent = admin.id + (admin.isOwner ? '（オーナー）' : '');
    ipDialogRanges.value = (admin.allowedIpRanges || []).join('\n');
    ipDialog.showModal();
    ipDialogRanges.focus();
  }
  function render() {
    list.replaceChildren();
    count.textContent = admins.length + '名';
    admins.forEach(function (admin) {
      var row = document.createElement('article'); row.className = 'admin-user-row';
      var info = document.createElement('div'); info.className = 'admin-user-row__info';
      var title = document.createElement('strong'); title.textContent = admin.id;
      var role = document.createElement('span'); role.className = 'admin-user-row__role' + (admin.isOwner ? ' is-owner' : '');
      role.textContent = admin.isOwner ? 'オーナー' : '権限制限管理者';
      var permissionText = document.createElement('small');
      permissionText.textContent = admin.isOwner ? 'すべての管理機能・全企業のアクセス分析' : admin.permissions.map(function (key) {
        if (key !== 'analytics') return permissionLabels[key] || key;
        var names = companyNames(admin.analyticsCompanyIds);
        return 'アクセス分析（' + (names.length ? names.join('・') : '企業未設定') + '）';
      }).join('・');
      info.append(title, role, permissionText);
      var ipPolicy = document.createElement('small');
      ipPolicy.className = 'admin-user-row__ip-policy' + ((admin.allowedIpRanges || []).length ? ' is-set' : '');
      ipPolicy.textContent = (admin.allowedIpRanges || []).length ? '接続元IP制限：' + admin.allowedIpRanges.length + '件' : '接続元IP制限：なし';
      info.append(ipPolicy);
      var actions = document.createElement('div'); actions.className = 'admin-company__actions';
      actions.append(createButton('IP設定', 'admin-company__edit admin-ip-policy-button', function () { editIpPolicy(admin); }));
      if (!admin.isOwner) actions.append(
        createButton('編集', 'admin-company__edit', function () { startEdit(admin); }),
        createButton('削除', 'admin-company__delete', function () { removeAdmin(admin); })
      );
      row.append(info, actions); list.appendChild(row);
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var id = idInput.value.trim();
    var password = passwordInput.value;
    var permissions = selectedPermissions();
    var analyticsCompanyIds = selectedAnalyticsCompanyIds();
    var allowedIpRanges = parseIpRanges(ipRangesInput && ipRangesInput.value);
    if (!/^[A-Za-z0-9._-]{3,50}$/.test(id)) { showStatus('管理者IDは3〜50文字の半角英数字・記号（._-）で入力してください。', 'error'); idInput.focus(); return; }
    if (!editingId && password.length < 8) { showStatus('パスワードは8文字以上で入力してください。', 'error'); passwordInput.focus(); return; }
    if (editingId && password && password.length < 8) { showStatus('新しいパスワードは8文字以上で入力してください。', 'error'); passwordInput.focus(); return; }
    if (!permissions.length) { showStatus('少なくとも1つの管理権限を選択してください。', 'error'); return; }
    if (permissions.indexOf('analytics') !== -1 && !analyticsCompanyIds.length) { showStatus('アクセス分析を許可する企業を1社以上選択してください。', 'error'); return; }
    if (allowedIpRanges.length > 50) { showStatus('許可IPは最大50件までです。', 'error'); ipRangesInput.focus(); return; }
    var action = editingId ? '管理者「' + editingId + '」のID・パスワード・権限設定を更新しますか？' : '管理者「' + id + '」を追加しますか？';
    if (!window.confirm(action + '\n選択した管理画面だけが操作可能になります。')) return;

    var wasEditing = Boolean(editingId);
    submitButton.disabled = true;
    request(wasEditing ? 'PUT' : 'POST', wasEditing
      ? { currentId:editingId, id:id, password:password, permissions:permissions, analyticsCompanyIds:analyticsCompanyIds, allowedIpRanges:allowedIpRanges }
      : { id:id, password:password, permissions:permissions, analyticsCompanyIds:analyticsCompanyIds, allowedIpRanges:allowedIpRanges }
    ).then(function (body) {
      admins = body.admins || [];
      resetForm(); render(); showStatus(wasEditing ? '管理者設定を更新しました。' : '管理者を追加しました。');
    }).catch(function (error) {
      showStatus(error.message === 'duplicate-admin-id' ? '同じ管理者IDがすでに登録されています。' : '管理者を保存できませんでした。', 'error');
    }).finally(function () { submitButton.disabled = false; });
  });
  cancelButton.addEventListener('click', resetForm);
  analyticsPermission.addEventListener('change', toggleAnalyticsScope);
  if (ipDialogClose) ipDialogClose.addEventListener('click', function () { ipDialog.close(); });
  if (ipDialogCancel) ipDialogCancel.addEventListener('click', function () { ipDialog.close(); });
  if (ipDialogForm) ipDialogForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var ranges = parseIpRanges(ipDialogRanges.value);
    if (ranges.length > 50) { showStatus('許可IPは最大50件までです。', 'error'); return; }
    request('PATCH', { id:ipDialogTarget, allowedIpRanges:ranges }).then(function (body) {
      admins = body.admins || [];
      ipDialog.close(); render(); showStatus(ranges.length ? '接続元IP制限を保存しました。' : '接続元IP制限を解除しました。');
    }).catch(function (error) {
      showStatus(error.message === 'current-ip-required'
        ? 'オーナーの設定には、現在接続しているIPを含めてください。'
        : error.message === 'invalid-ip-range' ? 'IPアドレスまたはCIDRの形式を確認してください。' : '接続元IP設定を保存できませんでした。', 'error');
    });
  });

  request('GET').then(function (body) {
    admins = body.admins || [];
    companies = body.companies || [];
    renderCompanyOptions(); render();
  })
    .catch(function () { showStatus('管理者一覧を読み込めませんでした。', 'error'); });
});
