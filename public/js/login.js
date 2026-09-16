(function () {
  'use strict';

  var form = document.getElementById('loginForm');
  var input = document.getElementById('companyCode');
  var errorBox = document.getElementById('loginError');
  if (!form || !input || !errorBox) return;

  function returnTo() {
    var value = new URLSearchParams(window.location.search).get('returnTo');
    if (!value) return 'dashboard.html';
    try {
      var destination = new URL(value, window.location.origin);
      if (destination.origin !== window.location.origin || !/\.(?:html|htm)$/i.test(destination.pathname)) return 'dashboard.html';
      destination.searchParams.delete('efk_login');
      return destination.pathname + destination.search;
    } catch (e) {
      return 'dashboard.html';
    }
  }

  if (new URLSearchParams(window.location.search).get('linkError') === '1') errorBox.hidden = false;

  input.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    form.requestSubmit();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var submitButton = form.querySelector('[type="submit"]');
    if (submitButton && submitButton.disabled) return;
    if (submitButton) submitButton.disabled = true;
    fetch('/api/auth/member/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: input.value })
    }).then(function (response) {
      if (!response.ok) throw new Error('invalid-code');
      return response.json();
    }).then(function () {
      window.location.href = returnTo();
    }).catch(function () {
      errorBox.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      if (submitButton) submitButton.disabled = false;
    });
  });

  input.addEventListener('input', function () {
    if (!errorBox.hidden) errorBox.hidden = true;
    input.removeAttribute('aria-invalid');
  });
})();
