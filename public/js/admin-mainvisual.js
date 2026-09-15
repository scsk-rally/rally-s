(window.EfukuriContent && window.EfukuriContent.ready || Promise.resolve()).then(function () {
  'use strict';
  var store = window.EfukuriContent;
  var form = document.getElementById('mainVisualForm');
  var imageInput = document.getElementById('mainVisualImage');
  var imagePreview = document.getElementById('mainVisualImagePreview');
  var previewImage = document.getElementById('mainVisualPreviewImage');
  var message = document.getElementById('adminMessage');
  var logoutButton = document.getElementById('adminLogout');
  if (!store || !form) return;

  form.addEventListener('keydown', function (event) {
    var target = event.target;
    var tagName = target && target.tagName;
    var inputType = target && String(target.type || '').toLowerCase();
    if (event.key !== 'Enter' || event.isComposing) return;
    if (tagName === 'TEXTAREA' || tagName === 'BUTTON' || tagName === 'SELECT') return;
    if (inputType === 'file' || inputType === 'checkbox' || inputType === 'radio' || inputType === 'submit') return;
    event.preventDefault();
  });

  var fallback = store.defaults.hero[0];
  var current = Object.assign({}, fallback, store.getAll('hero')[0] || {});
  var currentImage = current.image || fallback.image;

  function field(name) { return form.elements.namedItem(name); }
  function value(name) { var input = field(name); return input ? String(input.value || '').trim() : ''; }
  function showMessage(text, kind) {
    message.textContent = text;
    message.className = 'admin-message is-' + (kind || 'success');
    message.hidden = false;
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(function () { message.hidden = true; }, 3600);
  }
  function validUrl(url) { return /^#[A-Za-z][\w:-]*$/.test(url) || store.isAllowedTargetUrl(url); }
  function setPreviewText(id, text) { var element = document.getElementById(id); if (element) element.textContent = text || ''; }
  function updatePreview() {
    setPreviewText('mainVisualPreviewTitle1', value('titleLine1'));
    setPreviewText('mainVisualPreviewTitle2', value('titleLine2'));
    setPreviewText('mainVisualPreviewLead', value('lead'));
    setPreviewText('mainVisualPreviewPrimary', value('primaryLabel'));
    setPreviewText('mainVisualPreviewSecondary', value('secondaryLabel'));
    setPreviewText('mainVisualPreviewTrust1', value('trust1'));
    setPreviewText('mainVisualPreviewTrust2', value('trust2'));
    setPreviewText('mainVisualPreviewTrust3', value('trust3'));
    imagePreview.src = currentImage;
    previewImage.src = currentImage;
  }
  function fillForm() {
    ['titleLine1','titleLine2','lead','primaryLabel','primaryUrl','secondaryLabel','secondaryUrl','trust1','trust2','trust3'].forEach(function (name) {
      if (field(name)) field(name).value = current[name] || '';
    });
    updatePreview();
  }

  form.addEventListener('input', updatePreview);
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var requiredNames = ['titleLine1','titleLine2','lead','primaryLabel','primaryUrl','secondaryLabel','secondaryUrl','trust1','trust2','trust3'];
    var missing = requiredNames.find(function (name) { return !value(name); });
    if (missing) { showMessage('すべての文言とリンクURLを入力してください。', 'error'); field(missing).focus(); return; }
    if (!validUrl(value('primaryUrl')) || !validUrl(value('secondaryUrl'))) {
      showMessage('リンクURLは「#start」のようなページ内リンク、「page.html」、または「https://...」で入力してください。', 'error');
      return;
    }
    if (!window.confirm('メインビジュアルの変更内容を保存しますか？\n保存すると会員トップへ反映されます。')) return;
    current = {
      id: current.id || 'hero-default-1',
      titleLine1: value('titleLine1'), titleLine2: value('titleLine2'), lead: value('lead'),
      primaryLabel: value('primaryLabel'), primaryUrl: value('primaryUrl'),
      secondaryLabel: value('secondaryLabel'), secondaryUrl: value('secondaryUrl'),
      trust1: value('trust1'), trust2: value('trust2'), trust3: value('trust3'),
      image: currentImage, updatedAt: new Date().toISOString()
    };
    try { store.saveAll('hero', [current]); }
    catch (error) { showMessage('保存できませんでした。入力内容を確認してください。', 'error'); return; }
    store.flush().then(function () { showMessage('メインビジュアルを更新しました。'); })
      .catch(function () { showMessage('サーバーへ保存できませんでした。', 'error'); });
  });

  imageInput.addEventListener('change', function () {
    var file = imageInput.files && imageInput.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { showMessage('画像ファイルを選択してください。', 'error'); imageInput.value = ''; return; }
    if (file.size > 12000000) { showMessage('元画像は12MB以下のものを使用してください。', 'error'); imageInput.value = ''; return; }
    var reader = new FileReader();
    reader.onerror = function () { showMessage('画像を読み込めませんでした。別の画像を選択してください。', 'error'); imageInput.value = ''; };
    reader.onload = function () {
      var source = new Image();
      source.onerror = function () { showMessage('画像を処理できませんでした。別の画像を選択してください。', 'error'); imageInput.value = ''; };
      source.onload = function () {
        var maxWidth = 1800;
        var maxHeight = 1000;
        var scale = Math.min(1, maxWidth / source.naturalWidth, maxHeight / source.naturalHeight);
        var width = Math.max(1, Math.round(source.naturalWidth * scale));
        var height = Math.max(1, Math.round(source.naturalHeight * scale));
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var context = canvas.getContext('2d');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(source, 0, 0, width, height);
        var submitButton = form.querySelector('[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        showMessage('画像を調整してアップロードしています。');
        canvas.toBlob(function (blob) {
          if (!blob) { showMessage('画像を処理できませんでした。', 'error'); if (submitButton) submitButton.disabled = false; return; }
          var data = new FormData();
          data.append('file', new File([blob], 'mainvisual.webp', { type:'image/webp' }));
          data.append('scope', 'mainvisual');
          fetch('/api/media', { method:'PUT', body:data }).then(function (response) {
            if (!response.ok) throw new Error('upload-failed');
            return response.json();
          }).then(function (body) {
            currentImage = body.url;
            updatePreview();
            showMessage('画像を' + width + '×' + height + 'pxに自動調整しました。保存するとトップページへ反映されます。');
          }).catch(function () {
            showMessage('画像をアップロードできませんでした。もう一度お試しください。', 'error');
          }).finally(function () { if (submitButton) submitButton.disabled = false; });
        }, 'image/webp', 0.88);
      };
      source.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  if (logoutButton) logoutButton.addEventListener('click', function () {
    window.EfukuriAdminLogout();
  });
  fillForm();
});
