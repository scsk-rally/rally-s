(function (global) {
  'use strict';

  var STORAGE_KEY = 'efukuriCompaniesV1';
  var ACTIVE_CODE_KEY = 'efukuriCompanyCode';
  var LEGACY_COMPANY_KEY = 'efukuriCompany';

  var DEFAULT_COMPANIES = [];
  var cache = [];
  var writeQueue = Promise.resolve();

  function normalizeCode(value) {
    return String(value || '').trim().toLowerCase();
  }

  function createMark(name) {
    var value = String(name || '').trim();
    if (!value) return '会';
    if (/^[A-Za-z]/.test(value)) return value.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'CO';
    return Array.from(value)[0];
  }

  function cleanCompany(company) {
    var cleaned = {
      code: normalizeCode(company && company.code),
      name: String(company && company.name || '').trim(),
      pensionName: String(company && company.pensionName || '').trim(),
      pensionUrl: String(company && company.pensionUrl || '').trim(),
      stockPlanName: String(company && company.stockPlanName || '').trim(),
      stockPlanUrl: String(company && company.stockPlanUrl || '').trim(),
      fpConsultationUrl: String(company && company.fpConsultationUrl || '').trim(),
      logoUrl: String(company && company.logoUrl || '').trim(),
      fixedLoginPath: String(company && company.fixedLoginPath || '').trim()
    };
    if (company && company.id) cleaned.id = String(company.id);
    return cleaned;
  }

  function cloneDefaults() {
    return DEFAULT_COMPANIES.map(function (company) {
      return cleanCompany(company);
    });
  }

  function saveCompanies(companies) {
    var previous = cache.slice();
    var cleaned = companies.map(cleanCompany).filter(function (company) {
      return company.code && company.name;
    });
    cache = cleaned;
    writeQueue = writeQueue.catch(function () {}).then(function () {
      return fetch('/api/companies', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: cleaned })
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          if (!response.ok) throw new Error(body.error || 'company-save-failed');
          return body;
        });
      }).then(function (body) {
        cache = Array.isArray(body.companies) ? body.companies.map(cleanCompany) : cache;
        return cache;
      });
    }).catch(function (error) {
      cache = previous;
      window.setTimeout(function () { window.alert('企業設定をサーバーへ保存できませんでした。画面を再読み込みしてください。'); }, 0);
      throw error;
    });
    return cleaned;
  }

  function getCompanies() {
    return cache.slice();
  }

  function findByCode(code) {
    var normalized = normalizeCode(code);
    return getCompanies().find(function (company) {
      return company.code === normalized;
    }) || null;
  }

  function setActiveCompany(company) {
    return company;
  }

  var ready = /^\/admin-companies\.html$/i.test(window.location.pathname)
    ? fetch('/api/companies', { cache:'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('company-load-failed');
        return response.json();
      }).then(function (body) {
        cache = Array.isArray(body.companies) ? body.companies.map(cleanCompany) : [];
        return cache;
      })
    : Promise.resolve(cache);

  global.EfukuriCompanies = {
    storageKey: STORAGE_KEY,
    activeCodeKey: ACTIVE_CODE_KEY,
    defaults: cloneDefaults,
    ready: ready,
    flush: function () { return writeQueue; },
    normalizeCode: normalizeCode,
    createMark: createMark,
    getAll: getCompanies,
    updateFixedLoginPath: function (id, fixedLoginPath) {
      cache = cache.map(function (company) {
        return company.id === id ? cleanCompany(Object.assign({}, company, { fixedLoginPath: fixedLoginPath })) : company;
      });
    },
    saveAll: saveCompanies,
    findByCode: findByCode,
    setActive: setActiveCompany
  };
})(window);
