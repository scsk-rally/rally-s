(function () {
  'use strict';

  var auth = window.EfukuriAdminAuth;

  var form = document.getElementById('adminLoginForm');
  var idInput = document.getElementById('adminLoginId');
  var passwordInput = document.getElementById('adminLoginPassword');
  var errorBox = document.getElementById('adminLoginError');
  var errorText = document.getElementById('adminLoginErrorText');
  var toggleButton = document.getElementById('adminPasswordToggle');

  if (!form || !idInput || !passwordInput || !errorBox || !auth) return;

  function showError(text) {
    if (errorText) errorText.textContent = text;
    errorBox.hidden = false;
  }

  if (new URLSearchParams(window.location.search).get('ipDenied') === '1') {
    showError('現在のネットワークからは、この管理者アカウントを利用できません。');
  }

  [idInput, passwordInput].forEach(function (input) {
    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault();
      form.requestSubmit();
    });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var id = idInput.value.trim();
    var password = passwordInput.value;
    var submitButton = form.querySelector('[type="submit"]');
    if (submitButton && submitButton.disabled) return;
    if (submitButton) submitButton.disabled = true;

    auth.verify(id, password).then(function (result) {
      if (!result.ok) {
        showError(result.ipRestricted
          ? '現在のネットワークからは、この管理者アカウントを利用できません。'
          : result.retryLater ? 'ログイン試行回数が多いため、時間をおいて再度お試しください。'
          : 'IDまたはパスワードが正しくありません。');
        idInput.setAttribute('aria-invalid', 'true');
        passwordInput.setAttribute('aria-invalid', 'true');
        passwordInput.value = '';
        passwordInput.focus();
        if (submitButton) submitButton.disabled = false;
        return;
      }

      errorBox.hidden = true;
      window.location.replace('admin.html');
    });
  });

  [idInput, passwordInput].forEach(function (input) {
    input.addEventListener('input', function () {
      errorBox.hidden = true;
      idInput.removeAttribute('aria-invalid');
      passwordInput.removeAttribute('aria-invalid');
    });
  });

  if (toggleButton) {
    toggleButton.addEventListener('click', function () {
      var willShow = passwordInput.type === 'password';
      passwordInput.type = willShow ? 'text' : 'password';
      toggleButton.setAttribute('aria-pressed', String(willShow));
      toggleButton.setAttribute('aria-label', willShow ? 'パスワードを隠す' : 'パスワードを表示');
    });
  }
})();
