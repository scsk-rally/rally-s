(window.EfukuriAdminAuth && window.EfukuriAdminAuth.ready || Promise.resolve()).then(function () {
  'use strict';

  var downloadButton = document.getElementById('backupDownloadButton');
  var restoreFile = document.getElementById('backupRestoreFile');
  var restoreFileLabel = document.getElementById('backupRestoreFileLabel');
  var restoreButton = document.getElementById('backupRestoreButton');
  var status = document.getElementById('backupStatus');

  if (!downloadButton || !restoreFile || !restoreButton || !status) return;

  function showStatus(text, kind) {
    status.textContent = text;
    status.className = 'admin-settings-alert admin-backup-status is-' + (kind || 'success');
    status.hidden = false;
  }

  function filenameFromDisposition(response) {
    var disposition = response.headers.get('Content-Disposition') || '';
    var match = disposition.match(/filename="?([^";]+)"?/i);
    return match ? match[1] : 'efukuri-backup.json';
  }

  downloadButton.addEventListener('click', function () {
    downloadButton.disabled = true;
    showStatus('バックアップファイルを作成しています…');
    fetch('/api/backup', { cache:'no-store', credentials:'same-origin' }).then(function (response) {
      if (!response.ok) throw new Error('download-failed');
      return response.blob().then(function (blob) { return { blob:blob, filename:filenameFromDisposition(response) }; });
    }).then(function (result) {
      var url = URL.createObjectURL(result.blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      showStatus('バックアップファイルを保存しました。');
    }).catch(function () {
      showStatus('バックアップを作成できませんでした。再度お試しください。', 'error');
    }).finally(function () {
      downloadButton.disabled = false;
    });
  });

  restoreFile.addEventListener('change', function () {
    var file = restoreFile.files && restoreFile.files[0];
    restoreButton.disabled = !file;
    restoreFileLabel.textContent = file ? file.name : 'JSONファイルを選択';
    status.hidden = true;
  });

  restoreButton.addEventListener('click', function () {
    var file = restoreFile.files && restoreFile.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showStatus('バックアップファイルは5MB以下のものを選択してください。', 'error');
      return;
    }
    restoreButton.disabled = true;
    showStatus('ファイルを検証しています…');
    file.text().then(function (text) {
      try { return JSON.parse(text); }
      catch (error) { throw new Error('invalid-json'); }
    }).then(function (backup) {
      var confirmation = backup && backup.version >= 2
        ? 'バックアップからリストアしますか？\n現在のCMSコンテンツ・企業情報・権限制限管理者' + (backup.version >= 4 ? '・アクセス日次集計' : '') + 'は、選択したファイルの内容に置き換わります。\nオーナーのIDとパスワードは変更されません。'
        : '旧形式のバックアップからリストアしますか？\n現在のCMSコンテンツと企業情報は置き換わりますが、管理者設定は現在のまま保持されます。';
      if (!window.confirm(confirmation)) throw new Error('restore-cancelled');
      showStatus('バックアップをリストアしています…');
      return fetch('/api/backup', {
        method:'PUT',
        headers:{ 'Content-Type':'application/json' },
        credentials:'same-origin',
        body:JSON.stringify(backup)
      });
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) throw new Error(body.error || 'restore-failed');
        return body;
      });
    }).then(function (body) {
      var adminResult = body.managedAdminsRestored
        ? '、権限制限管理者 ' + body.managedAdmins + '件'
        : '、管理者設定は現在のまま';
      var analyticsResult = body.analyticsRestored ? '、アクセス日次集計 ' + body.analyticsDaily + '件' : '';
      showStatus('リストアが完了しました（企業情報 ' + body.companies + '件' + adminResult + analyticsResult + '）。');
      restoreFile.value = '';
      restoreFileLabel.textContent = 'JSONファイルを選択';
    }).catch(function (error) {
      if (error.message === 'restore-cancelled') {
        status.hidden = true;
        return;
      }
      var message = error.message === 'invalid-json'
        ? 'JSONファイルの形式が正しくありません。'
        : error.message === 'unsupported-backup-format'
          ? 'このサイトで作成された対応形式のバックアップを選択してください。'
          : 'リストアできませんでした。ファイルの内容を確認してください。';
      showStatus(message, 'error');
    }).finally(function () {
      restoreButton.disabled = !(restoreFile.files && restoreFile.files[0]);
    });
  });
});
