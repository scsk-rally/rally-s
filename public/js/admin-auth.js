(function () {
  'use strict';
  var currentSession = { id:'', isOwner:false, permissions:[] };
  var ready = /admin-login\.html$/i.test(window.location.pathname)
    ? Promise.resolve()
    : (window.EfukuriAdminSession ? window.EfukuriAdminSession.ready : fetch('/api/auth/admin/session', { cache:'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('unauthorized'); return response.json();
      })).then(function (body) { currentSession = body || currentSession; });

  function verify(id, password) {
    return fetch('/api/auth/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id:id, password:password })
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        return { ok:response.ok, ipRestricted:Boolean(body.ipRestricted), retryLater:Boolean(body.retryLater) };
      });
    }).catch(function () { return { ok:false, ipRestricted:false, retryLater:false }; });
  }

  function changeCredentials(currentPassword, newId, newPassword) {
    return fetch('/api/auth/admin/credentials', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword:currentPassword, newId:newId, newPassword:newPassword })
    }).then(function (response) { return response.json(); })
      .catch(function () { return { ok:false, reason:'unsupported' }; });
  }

  function logout() {
    return fetch('/api/auth/admin/logout', { method:'POST' }).finally(function () {
      window.location.replace('admin-login.html');
    });
  }

  window.EfukuriAdminAuth = {
    ready: ready,
    currentId: function () { return currentSession.id || ''; },
    isOwner: function () { return currentSession.isOwner === true; },
    permissions: function () { return Array.isArray(currentSession.permissions) ? currentSession.permissions.slice() : []; },
    credentialVersion: function () { return ''; },
    verify: verify,
    changeCredentials: changeCredentials,
    logout: logout
  };
})();
