(function () {
  'use strict';
  var account = document.getElementById('adminLogAccount');
  var action = document.getElementById('adminLogAction');
  var from = document.getElementById('adminLogFrom');
  var to = document.getElementById('adminLogTo');
  var refresh = document.getElementById('adminLogRefresh');
  var csv = document.getElementById('adminLogCsv');
  var status = document.getElementById('adminLogStatus');
  var rows = document.getElementById('adminLogRows');
  var count = document.getElementById('adminLogCount');
  var previous = document.getElementById('adminLogPrevious');
  var next = document.getElementById('adminLogNext');
  var page = document.getElementById('adminLogPage');
  var offset = 0;
  var pageSize = 200;
  var adminsLoaded = false;

  var actionLabels = {
    'admin.login':'ログイン成功', 'admin.login.success':'ログイン成功',
    'admin.login.failure':'ログイン失敗', 'admin.login.blocked':'ログイン制限',
    'admin.login.ip-denied':'IP制限で拒否',
    'admin.logout':'ログアウト', 'admin.page.view':'管理画面閲覧'
  };
  var pathLabels = {
    '/admin.html':'管理トップ', '/admin-settings.html':'管理者設定', '/admin-access-logs.html':'管理者アクセスログ',
    '/admin-analytics.html':'アクセス分析', '/admin-companies.html':'企業コード管理', '/admin-notices.html':'お知らせ投稿',
    '/admin-seminars.html':'セミナー投稿', '/admin-topics.html':'トピック', '/admin-consultations.html':'相談サービス',
    '/admin-experts.html':'専門家管理', '/admin-videos.html':'動画投稿', '/admin-services.html':'サービス管理',
    '/admin-mainvisual.html':'メインビジュアル管理', '/admin-menu.html':'メニュー管理'
  };

  function jstDate(date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit' }).format(date);
  }
  function jstTime(value) {
    return new Intl.DateTimeFormat('ja-JP', { timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).format(new Date(value));
  }
  function browserLabel(userAgent) {
    if (!userAgent || userAgent === '不明') return '不明';
    var browser = /Edg\/([\d.]+)/.exec(userAgent) || /Chrome\/([\d.]+)/.exec(userAgent) || /Firefox\/([\d.]+)/.exec(userAgent) || /Version\/([\d.]+).*Safari/.exec(userAgent);
    var name = /Edg\//.test(userAgent) ? 'Edge' : /Chrome\//.test(userAgent) ? 'Chrome' : /Firefox\//.test(userAgent) ? 'Firefox' : /Safari\//.test(userAgent) ? 'Safari' : 'その他';
    var os = /Windows/.test(userAgent) ? 'Windows' : /Android/.test(userAgent) ? 'Android' : /iPhone|iPad/.test(userAgent) ? 'iOS' : /Mac OS/.test(userAgent) ? 'macOS' : '';
    return name + (browser ? ' ' + browser[1].split('.')[0] : '') + (os ? ' / ' + os : '');
  }
  function query(format) {
    var params = new URLSearchParams({ from:from.value, to:to.value, offset:String(offset) });
    if (account.value) params.set('adminId', account.value);
    if (action.value) params.set('action', action.value);
    if (format) params.set('format', format);
    return params;
  }
  function setBusy(busy, message) {
    refresh.disabled = busy; csv.disabled = busy; previous.disabled = busy; next.disabled = busy;
    if (message) status.textContent = message;
  }
  function appendCell(row, value, className, title) {
    var cell = document.createElement('td'); cell.textContent = value;
    if (className) cell.className = className;
    if (title) cell.title = title;
    row.appendChild(cell);
  }
  function render(body) {
    if (!adminsLoaded) {
      (body.admins || []).forEach(function (id) { var option = document.createElement('option'); option.value = id; option.textContent = id; account.appendChild(option); });
      adminsLoaded = true;
    }
    rows.replaceChildren();
    if (!body.logs.length) {
      var emptyRow = document.createElement('tr'); var empty = document.createElement('td'); empty.colSpan = 6; empty.className = 'admin-log-empty'; empty.textContent = '検索条件に一致するアクセス履歴はありません。'; emptyRow.appendChild(empty); rows.appendChild(emptyRow);
    }
    body.logs.forEach(function (log) {
      var row = document.createElement('tr');
      appendCell(row, jstTime(log.occurredAt), 'admin-log-time');
      appendCell(row, log.adminId, 'admin-log-id');
      appendCell(row, actionLabels[log.action] || log.action, 'admin-log-action admin-log-action--' + log.action.split('.').pop());
      appendCell(row, pathLabels[log.path] || (log.path || 'ログイン画面'), 'admin-log-path', log.path);
      appendCell(row, log.ipAddress || '不明', 'admin-log-ip');
      appendCell(row, browserLabel(log.userAgent), 'admin-log-browser', log.userAgent);
      rows.appendChild(row);
    });
    count.textContent = body.total.toLocaleString('ja-JP') + '件';
    page.textContent = Math.floor(offset / pageSize) + 1 + 'ページ';
    previous.disabled = offset === 0;
    next.disabled = offset + body.logs.length >= body.total;
  }
  function load() {
    if (!from.value || !to.value || from.value > to.value) { status.textContent = '正しい集計期間を指定してください。'; return; }
    setBusy(true, 'アクセス履歴を読み込んでいます…');
    fetch('/api/admin-access-logs?' + query().toString(), { cache:'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('load-failed'); return response.json();
    }).then(function (body) {
      render(body); status.textContent = from.value + '〜' + to.value + ' の履歴を表示しています。';
    }).catch(function () { status.textContent = 'アクセス履歴を読み込めませんでした。'; })
      .finally(function () { refresh.disabled = false; csv.disabled = false; });
  }

  var today = new Date(); var start = new Date(today.getTime()); start.setDate(start.getDate() - 29);
  from.value = jstDate(start); to.value = jstDate(today);
  refresh.addEventListener('click', function () { offset = 0; load(); });
  previous.addEventListener('click', function () { offset = Math.max(0, offset - pageSize); load(); });
  next.addEventListener('click', function () { offset += pageSize; load(); });
  csv.addEventListener('click', function () {
    setBusy(true, 'CSVを作成しています…');
    fetch('/api/admin-access-logs?' + query('csv').toString(), { cache:'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('csv-failed'); return Promise.all([response.blob(), response.headers.get('content-disposition')]);
    }).then(function (values) {
      var match = (values[1] || '').match(/filename="?([^";]+)"?/i); var url = URL.createObjectURL(values[0]);
      var link = document.createElement('a'); link.href = url; link.download = match ? match[1] : 'efukuri-admin-access-log.csv'; link.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000); status.textContent = 'CSVをダウンロードしました。';
    }).catch(function () { status.textContent = 'CSVを作成できませんでした。'; })
      .finally(function () { refresh.disabled = false; csv.disabled = false; });
  });
  document.getElementById('adminLogout').addEventListener('click', function () { window.EfukuriAdminLogout(); });
  window.EfukuriAdminSession.ready.then(function (session) { if (!session.isOwner) window.location.replace('admin.html?denied=1'); else load(); });
}());
