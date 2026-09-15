(window.EfukuriCompanies && window.EfukuriCompanies.ready || Promise.resolve()).then(function () {
  'use strict';

  var registry = window.EfukuriCompanies;
  var form = document.getElementById('companyForm');
  var codeInput = document.getElementById('adminCompanyCode');
  var fixedLinkInput = document.getElementById('adminCompanyFixedLink');
  var fixedLinkCopy = document.getElementById('adminCompanyFixedLinkCopy');
  var fixedLinkRotate = document.getElementById('adminCompanyFixedLinkRotate');
  var nameInput = document.getElementById('adminCompanyName');
  var pensionNameInput = document.getElementById('adminPensionName');
  var pensionUrlInput = document.getElementById('adminPensionUrl');
  var stockPlanNameInput = document.getElementById('adminStockPlanName');
  var stockPlanUrlInput = document.getElementById('adminStockPlanUrl');
  var fpConsultationUrlInput = document.getElementById('adminFpConsultationUrl');
  var logoInput = document.getElementById('adminCompanyLogo');
  var logoPreview = document.getElementById('adminCompanyLogoPreview');
  var logoRemove = document.getElementById('adminCompanyLogoRemove');
  var list = document.getElementById('companyList');
  var count = document.getElementById('companyCount');
  var submitLabel = document.getElementById('companySubmitLabel');
  var cancelButton = document.getElementById('companyCancel');
  var logoutButton = document.getElementById('adminLogout');
  var message = document.getElementById('adminMessage');
  var editingCode = null;
  var editingId = null;
  var currentLogoUrl = '';

  if (!registry || !form || !list) return;

  form.addEventListener('keydown', function (event) {
    var target = event.target;
    var tagName = target && target.tagName;
    var inputType = target && String(target.type || '').toLowerCase();
    if (event.key !== 'Enter' || event.isComposing) return;
    if (tagName === 'TEXTAREA' || tagName === 'BUTTON' || tagName === 'SELECT') return;
    if (inputType === 'file' || inputType === 'checkbox' || inputType === 'radio' || inputType === 'submit') return;
    event.preventDefault();
  });

  function showMessage(text, type) {
    message.textContent = text;
    message.className = 'admin-message is-' + (type || 'success');
    message.hidden = false;
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(function () {
      message.hidden = true;
    }, 3200);
  }

  function resetForm() {
    editingCode = null;
    editingId = null;
    form.reset();
    codeInput.disabled = false;
    submitLabel.textContent = '企業を追加';
    cancelButton.hidden = true;
    setLogo('');
    setFixedLink('');
  }

  function setFixedLink(value) {
    if (!fixedLinkInput) return;
    fixedLinkInput.value = value || '';
    if (fixedLinkCopy) fixedLinkCopy.disabled = !value;
    if (fixedLinkRotate) fixedLinkRotate.disabled = !editingId || !value;
  }

  function setLogo(url) {
    currentLogoUrl = url || '';
    if (!logoPreview) return;
    window.EfukuriCompanyLogo.apply(logoPreview, currentLogoUrl || 'images/rally-logo.png');
    logoPreview.hidden = false;
    if (logoRemove) logoRemove.hidden = !currentLogoUrl;
    if (logoInput) logoInput.value = '';
  }

  function createButton(label, className, onClick) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function startEdit(company) {
    editingCode = company.code;
    editingId = company.id;
    codeInput.value = company.code;
    nameInput.value = company.name;
    pensionNameInput.value = company.pensionName || '';
    pensionUrlInput.value = company.pensionUrl || '';
    stockPlanNameInput.value = company.stockPlanName || '';
    stockPlanUrlInput.value = company.stockPlanUrl || '';
    fpConsultationUrlInput.value = company.fpConsultationUrl || '';
    setLogo(company.logoUrl || '');
    setFixedLink(company.fixedLoginPath ? window.location.origin + company.fixedLoginPath : '');
    codeInput.disabled = false;
    submitLabel.textContent = '変更を保存';
    cancelButton.hidden = false;
    codeInput.focus();
  }

  function removeCompany(company) {
    var companies = registry.getAll();
    if (companies.length <= 1) {
      showMessage('企業は最低1件必要です。', 'error');
      return;
    }
    if (!window.confirm(company.name + '（' + company.code + '）を削除しますか？\n削除後はこの企業コードでログインできなくなり、企業別リンク設定も失われます。\nこの操作は取り消せません。')) return;
    registry.saveAll(companies.filter(function (item) { return item.id !== company.id; }));
    registry.flush().then(function () {
      if (editingId === company.id) resetForm();
      render(); showMessage('企業を削除しました。');
    }).catch(function () { render(); showMessage('サーバーへ保存できませんでした。', 'error'); });
  }

  function render() {
    var companies = registry.getAll();
    list.replaceChildren();
    count.textContent = companies.length + '社';

    companies.forEach(function (company, index) {
      var row = document.createElement('article');
      row.className = 'admin-company';

      var number = document.createElement('span');
      number.className = 'admin-company__number';
      number.textContent = 'NO.' + String(index + 1).padStart(2, '0');

      var mark = document.createElement('div');
      mark.className = 'admin-company__mark';
      {
        var markImage = document.createElement('img');
        window.EfukuriCompanyLogo.apply(markImage, company.logoUrl || 'images/rally-logo.png'); markImage.alt = ''; markImage.loading = 'lazy';
        mark.appendChild(markImage);
      }

      var info = document.createElement('div');
      info.className = 'admin-company__info';
      var name = document.createElement('strong');
      name.textContent = company.name;
      var code = document.createElement('code');
      code.textContent = company.code;
      var pension = document.createElement('span');
      pension.className = 'admin-company__pension' + (company.pensionName && company.pensionUrl ? ' is-set' : '');
      pension.textContent = company.pensionName && company.pensionUrl
        ? '確定拠出年金：' + company.pensionName
        : '確定拠出年金：未設定';
      var stockPlan = document.createElement('span');
      stockPlan.className = 'admin-company__stock-plan' + (company.stockPlanName && company.stockPlanUrl ? ' is-set' : '');
      stockPlan.textContent = company.stockPlanName && company.stockPlanUrl
        ? '持株会サイト：' + company.stockPlanName
        : '持株会サイト：未設定';
      var fpConsultation = document.createElement('span');
      fpConsultation.className = 'admin-company__stock-plan' + (company.fpConsultationUrl ? ' is-set' : '');
      fpConsultation.title = company.fpConsultationUrl || 'https://kagoya-consul.co.jp/fp_lp/';
      fpConsultation.textContent = 'FP相談：' + (company.fpConsultationUrl || '標準URL');
      info.append(name, code, pension, stockPlan, fpConsultation);

      var actions = document.createElement('div');
      actions.className = 'admin-company__actions';
      actions.append(
        createButton('編集', 'admin-company__edit', function () { startEdit(company); }),
        createButton('削除', 'admin-company__delete', function () { removeCompany(company); })
      );

      row.append(number, mark, info, actions);
      list.appendChild(row);
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var code = registry.normalizeCode(codeInput.value);
    var name = nameInput.value.trim();
    var pensionName = pensionNameInput.value.trim();
    var pensionUrl = pensionUrlInput.value.trim();
    var stockPlanName = stockPlanNameInput.value.trim();
    var stockPlanUrl = stockPlanUrlInput.value.trim();
    var companies = registry.getAll();

    var existingCompany = editingId ? companies.find(function (company) { return company.id === editingId; }) : null;
    var codeIsMaskedAndUnchanged = Boolean(existingCompany && /^••••/.test(code) && code === editingCode);
    if (!codeIsMaskedAndUnchanged && !/^[a-z0-9_-]{4,32}$/.test(code)) {
      showMessage('企業コードは4〜32文字の半角英数字で入力してください。', 'error');
      codeInput.focus();
      return;
    }
    if (!name) {
      showMessage('表示する企業名を入力してください。', 'error');
      nameInput.focus();
      return;
    }
    if ((pensionName && !pensionUrl) || (!pensionName && pensionUrl)) {
      showMessage('確定拠出年金リンクは、名称とURLを両方入力してください。', 'error');
      (pensionName ? pensionUrlInput : pensionNameInput).focus();
      return;
    }
    if (pensionUrl) {
      try {
        var parsedPensionUrl = new URL(pensionUrl);
        if (parsedPensionUrl.protocol !== 'https:' && parsedPensionUrl.protocol !== 'http:') throw new Error('invalid protocol');
        pensionUrl = parsedPensionUrl.href;
      } catch (e) {
        showMessage('確定拠出年金ページURLは、http:// または https:// から入力してください。', 'error');
        pensionUrlInput.focus();
        return;
      }
    }
    if ((stockPlanName && !stockPlanUrl) || (!stockPlanName && stockPlanUrl)) {
      showMessage('持株会サイトは、名称とURLを両方入力してください。', 'error');
      (stockPlanName ? stockPlanUrlInput : stockPlanNameInput).focus();
      return;
    }
    if (stockPlanUrl) {
      try {
        var parsedStockPlanUrl = new URL(stockPlanUrl);
        if (parsedStockPlanUrl.protocol !== 'https:' && parsedStockPlanUrl.protocol !== 'http:') throw new Error('invalid protocol');
        stockPlanUrl = parsedStockPlanUrl.href;
      } catch (e) {
        showMessage('持株会サイトは、http:// または https:// から入力してください。', 'error');
        stockPlanUrlInput.focus();
        return;
      }
    }

    var fpConsultationUrl = fpConsultationUrlInput.value.trim();
    if (fpConsultationUrl) {
      try {
        var parsedFpUrl = new URL(fpConsultationUrl);
        if (parsedFpUrl.protocol !== 'https:' || parsedFpUrl.username || parsedFpUrl.password || fpConsultationUrl.length > 2048) throw new Error('invalid-url');
        fpConsultationUrl = parsedFpUrl.href;
      } catch (e) {
        showMessage('FP相談URLは認証情報を含まないhttps://のURLを入力してください。', 'error');
        fpConsultationUrlInput.focus();
        return;
      }
    }
    // Masked codes only expose the last four characters and are not unique.
    // Unchanged codes keep their identity by company ID; the server checks real code digests.
    var duplicate = !codeIsMaskedAndUnchanged && companies.some(function (company) {
      return company.code === code && company.id !== editingId;
    });
    if (duplicate) {
      showMessage('同じ企業コードがすでに登録されています。', 'error');
      codeInput.focus();
      return;
    }

    var confirmation = editingCode
      ? '「' + name + '」の企業設定を更新しますか？'
      : '「' + name + '」を新しい企業として追加しますか？';
    if (editingCode && code !== editingCode) {
      confirmation += '\n企業コードを「' + editingCode + '」から「' + code + '」へ変更するため、旧企業コードは無効になります。配布済みの固定ログインリンクは変わりません。';
    } else {
      confirmation += '\n保存すると企業コードと企業別リンク設定へ反映されます。';
    }
    if (!window.confirm(confirmation)) return;

    var successMessage = '';
    var savedId = editingId;
    if (editingId) {
      companies = companies.map(function (company) {
        return company.id === editingId ? {
          id: company.id,
          code: codeIsMaskedAndUnchanged ? company.code : code,
          name: name,
          pensionName: pensionName,
          pensionUrl: pensionUrl,
          stockPlanName: stockPlanName,
          stockPlanUrl: stockPlanUrl,
          fpConsultationUrl: fpConsultationUrl,
          logoUrl: currentLogoUrl
        } : company;
      });
      registry.saveAll(companies);
      successMessage = '企業設定を更新しました。';
    } else {
      companies.push({
        code: code,
        name: name,
        pensionName: pensionName,
        pensionUrl: pensionUrl,
        stockPlanName: stockPlanName,
        stockPlanUrl: stockPlanUrl,
        fpConsultationUrl: fpConsultationUrl,
        logoUrl: currentLogoUrl
      });
      registry.saveAll(companies);
      successMessage = '企業を追加しました。';
    }

    registry.flush().then(function () {
      var savedCompany = registry.getAll().find(function (company) {
        return savedId ? company.id === savedId : company.name === name && company.code.slice(-4) === code.slice(-4);
      });
      var generatedFixedLink = savedCompany && savedCompany.fixedLoginPath ? window.location.origin + savedCompany.fixedLoginPath : '';
      resetForm();
      if (generatedFixedLink) setFixedLink(generatedFixedLink);
      render();
      showMessage(successMessage + (generatedFixedLink ? ' 固定ログインリンクをコピーできます。' : ''));
    }).catch(function () {
      render();
      showMessage('サーバーへ保存できませんでした。入力内容を確認して、もう一度お試しください。', 'error');
    });
  });

  cancelButton.addEventListener('click', resetForm);
  if (fixedLinkCopy) fixedLinkCopy.addEventListener('click', function () {
    if (!fixedLinkInput || !fixedLinkInput.value) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(fixedLinkInput.value).then(function () {
        showMessage('固定ログインリンクをコピーしました。');
      }).catch(function () {
        fixedLinkInput.select();
        showMessage('リンクを選択しました。コピー操作を行ってください。', 'error');
      });
    } else {
      fixedLinkInput.select();
      showMessage('リンクを選択しました。コピー操作を行ってください。');
    }
  });
  if (fixedLinkRotate) fixedLinkRotate.addEventListener('click', function () {
    if (!editingId || !window.confirm('固定ログインリンクを再発行しますか？\n現在の固定リンクは直ちに無効になります。')) return;
    var rotatedCompanyId = editingId;
    fixedLinkRotate.disabled = true;
    fetch('/api/companies/link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: rotatedCompanyId })
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) throw new Error(body.error || 'link-rotate-failed');
        return body;
      });
    }).then(function (body) {
      registry.updateFixedLoginPath(rotatedCompanyId, body.fixedLoginPath);
      render();
      if (editingId === rotatedCompanyId) setFixedLink(window.location.origin + body.fixedLoginPath);
      showMessage('固定ログインリンクを再発行しました。新しいリンクをコピーしてください。');
    }).catch(function () { showMessage('固定ログインリンクを再発行できませんでした。', 'error'); })
      .finally(function () { fixedLinkRotate.disabled = !editingId || !fixedLinkInput.value; });
  });
  if (logoInput) logoInput.addEventListener('change', function () {
    var file = logoInput.files && logoInput.files[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size <= 0 || file.size > 12 * 1024 * 1024) {
      showMessage('企業ロゴはJPEG・PNG・WebP・GIF形式、12MB以下の画像を選択してください。', 'error');
      logoInput.value = ''; return;
    }
    var submitButton = form.querySelector('.admin-submit');
    submitButton.disabled = true;
    showMessage('企業ロゴをアップロードしています。');
    var data = new FormData(); data.append('file', file); data.append('scope', 'company-logo');
    fetch('/api/media', { method:'PUT', body:data }).then(function (response) {
      if (!response.ok) throw new Error('upload-failed');
      return response.json();
    }).then(function (body) {
      setLogo(body.url);
      showMessage('企業ロゴをアップロードしました。企業設定を保存すると利用者サイトへ反映されます。');
    }).catch(function () {
      showMessage('企業ロゴをアップロードできませんでした。', 'error');
      logoInput.value = '';
    }).finally(function () { submitButton.disabled = false; });
  });
  if (logoRemove) logoRemove.addEventListener('click', function () { setLogo(''); });
  if (logoutButton) {
    logoutButton.addEventListener('click', function () {
      window.EfukuriAdminLogout();
    });
  }

  render();
});
