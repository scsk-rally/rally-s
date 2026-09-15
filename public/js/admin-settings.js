(window.EfukuriAdminAuth && window.EfukuriAdminAuth.ready || Promise.resolve()).then(function () {
  'use strict';

  var auth = window.EfukuriAdminAuth;
  var form = document.getElementById('adminSettingsForm');
  var currentIdLabel = document.getElementById('currentAdminId');
  var currentPassword = document.getElementById('currentAdminPassword');
  var newId = document.getElementById('newAdminId');
  var newPassword = document.getElementById('newAdminPassword');
  var confirmPassword = document.getElementById('confirmAdminPassword');
  var alertBox = document.getElementById('settingsAlert');
  var message = document.getElementById('adminMessage');
  var submitButton = document.getElementById('adminSettingsSubmit');
  var logoutButton = document.getElementById('adminLogout');

  if (!auth || !form) return;

  form.addEventListener('keydown', function (event) {
    var target = event.target;
    var tagName = target && target.tagName;
    var inputType = target && String(target.type || '').toLowerCase();
    if (event.key !== 'Enter' || event.isComposing) return;
    if (tagName === 'TEXTAREA' || tagName === 'BUTTON' || tagName === 'SELECT') return;
    if (inputType === 'file' || inputType === 'checkbox' || inputType === 'radio' || inputType === 'submit') return;
    event.preventDefault();
  });

  currentIdLabel.textContent = auth.currentId();
  newId.value = auth.currentId();

  function showError(text) {
    alertBox.textContent = text;
    alertBox.hidden = false;
  }

  function clearError() {
    alertBox.hidden = true;
  }

  [currentPassword, newId, newPassword, confirmPassword].forEach(function (input) {
    input.addEventListener('input', clearError);
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    clearError();

    var nextId = newId.value.trim();
    if (!currentPassword.value) {
      showError('現在のパスワードを入力してください。');
      currentPassword.focus();
      return;
    }
    if (nextId.length < 3) {
      showError('新しい管理者IDは3文字以上で入力してください。');
      newId.focus();
      return;
    }
    if (newPassword.value.length < 8) {
      showError('新しいパスワードは8文字以上で入力してください。');
      newPassword.focus();
      return;
    }
    if (newPassword.value !== confirmPassword.value) {
      showError('新しいパスワードと確認入力が一致しません。');
      confirmPassword.focus();
      return;
    }

    if (!window.confirm('管理者IDとパスワードを変更しますか？\n変更後は一度ログアウトし、新しい認証情報での再ログインが必要です。')) return;

    submitButton.disabled = true;
    auth.changeCredentials(currentPassword.value, nextId, newPassword.value).then(function (result) {
      if (!result.ok) {
        submitButton.disabled = false;
        if (result.reason === 'current-password') {
          showError('現在のパスワードが正しくありません。');
          currentPassword.value = '';
          currentPassword.focus();
          return;
        }
        showError('このブラウザでは安全な認証情報の保存を利用できません。');
        return;
      }

      message.textContent = 'IDとパスワードを変更しました。再ログイン画面へ移動します。';
      message.hidden = false;
      window.setTimeout(function () {
        window.location.replace('admin-login.html');
      }, 900);
    });
  });

  if (logoutButton) {
    logoutButton.addEventListener('click', function () {
      window.EfukuriAdminLogout();
    });
  }
});
