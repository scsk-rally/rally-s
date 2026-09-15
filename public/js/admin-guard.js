// 管理画面の保護はサーバーProxyとHttpOnly Cookieで行い、画面表示も権限に合わせます。
(function () {
  'use strict';

  window.EfukuriAdminLogout = function () {
    return fetch('/api/auth/admin/logout', { method:'POST' }).finally(function () {
      window.location.replace('admin-login.html');
    });
  };

  if (/admin-login\.html$/i.test(window.location.pathname)) return;

  function domReady() {
    if (document.readyState !== 'loading') return Promise.resolve();
    return new Promise(function (resolve) { document.addEventListener('DOMContentLoaded', resolve, { once:true }); });
  }

  var sessionReady = fetch('/api/auth/admin/session', { cache:'no-store' }).then(function (response) {
    if (!response.ok) throw new Error('unauthorized');
    return response.json();
  }).then(function (session) {
    session.permissions = Array.isArray(session.permissions) ? session.permissions : [];
    session.hasPermission = function (permission) {
      return session.isOwner === true || session.permissions.indexOf(permission) !== -1;
    };
    return session;
  });

  window.EfukuriAdminSession = { ready:sessionReady };

  Promise.all([sessionReady, domReady()]).then(function (values) {
    var session = values[0];
    document.body.classList.toggle('admin-is-limited', !session.isOwner);

    fetch('/api/admin-access-logs', {
      method:'POST', credentials:'same-origin', keepalive:true,
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ path:window.location.pathname })
    }).catch(function () {});

    Array.prototype.forEach.call(document.querySelectorAll('[data-admin-permission]'), function (link) {
      if (session.hasPermission(link.getAttribute('data-admin-permission'))) return;
      link.classList.add('is-disabled');
      link.setAttribute('aria-disabled', 'true');
      link.setAttribute('tabindex', '-1');
      link.addEventListener('click', function (event) { event.preventDefault(); });
    });

    if (!session.isOwner) {
      Array.prototype.forEach.call(document.querySelectorAll('a[href="admin-settings.html"]'), function (link) {
        link.classList.add('is-disabled');
        link.setAttribute('aria-disabled', 'true');
        link.setAttribute('tabindex', '-1');
        link.addEventListener('click', function (event) { event.preventDefault(); });
      });
    }

    if (new URLSearchParams(window.location.search).get('denied') === '1') {
      var notice = document.createElement('div');
      notice.className = 'admin-permission-notice';
      notice.setAttribute('role', 'alert');
      notice.textContent = 'この管理画面へのアクセス権限がありません。利用可能なメニューを選択してください。';
      var main = document.querySelector('.admin-main');
      if (main) main.prepend(notice);
    }
  }).catch(function () {
    window.location.replace('admin-login.html');
  });
})();
