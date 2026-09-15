(function () {
  'use strict';
  var frame = document.getElementById('fpConsultationFrame');
  var note = document.getElementById('fpConsultationNote');
  if (!frame || !note) return;
  window.EfukuriMemberSession.then(function (body) {
    if (!body || !body.authenticated || !body.company) throw new Error('session-expired');
    var url = new URL(body.company.fpConsultationUrl || 'https://kagoya-consul.co.jp/fp_lp/');
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid-url');
    frame.src = url.href;
    note.textContent = '※提携先サイト「' + url.hostname + '」の相談予約フォームを表示しています。';
  }).catch(function () {
    note.textContent = '相談予約フォームを読み込めませんでした。ページを再読み込みするか、再度ログインしてください。';
  });
})();
