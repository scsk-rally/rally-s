(function () {
  'use strict';
  var companySelect = document.getElementById('analyticsCompany');
  var fromInput = document.getElementById('analyticsFrom');
  var toInput = document.getElementById('analyticsTo');
  var refreshButton = document.getElementById('analyticsRefresh');
  var pdfButton = document.getElementById('analyticsPdf');
  var status = document.getElementById('analyticsStatus');
  var formatter = new Intl.NumberFormat('ja-JP');
  var companiesLoaded = false;
  var adminSession = { isOwner:false, permissions:[], analyticsCompanyIds:[] };

  function jstDate(date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit' }).format(date);
  }
  var today = new Date();
  var start = new Date(today.getTime());
  start.setDate(start.getDate() - 29);
  fromInput.value = jstDate(start);
  toInput.value = jstDate(today);

  function query() {
    var params = new URLSearchParams({ from:fromInput.value, to:toInput.value });
    if (companySelect.value) params.set('companyId', companySelect.value);
    return params;
  }

  function setBusy(busy, message) {
    refreshButton.disabled = busy;
    pdfButton.disabled = busy;
    if (message) status.textContent = message;
  }

  function render(report) {
    document.getElementById('kpiLogins').textContent = formatter.format(report.summary.logins);
    document.getElementById('kpiPageViews').textContent = formatter.format(report.summary.pageViews);
    document.getElementById('kpiSessions').textContent = formatter.format(report.summary.uniqueSessions);
    document.getElementById('kpiLoginType').textContent = formatter.format(report.summary.codeLogins) + ' / ' + formatter.format(report.summary.linkLogins);
    if (!companiesLoaded) {
      if (!adminSession.isOwner) companySelect.replaceChildren();
      report.companies.forEach(function (company) {
        var option = document.createElement('option'); option.value = company.id; option.textContent = company.name; companySelect.appendChild(option);
      });
      if (report.selectedCompanyId) companySelect.value = report.selectedCompanyId;
      companySelect.disabled = !adminSession.isOwner && report.companies.length <= 1;
      companiesLoaded = true;
    }

    var chart = document.getElementById('analyticsChart');
    chart.innerHTML = '';
    var ns = 'http://www.w3.org/2000/svg';
    var width = Math.max(760, report.daily.length * 42 + 112); var height = 220;
    var left = 56; var right = 56; var top = 32; var bottom = 42; var base = height - bottom; var plotHeight = base - top;
    var maxViews = Math.max.apply(null, [1].concat(report.daily.map(function (day) { return day.pageViews; })));
    var maxLogins = Math.max.apply(null, [1].concat(report.daily.map(function (day) { return day.logins; })));
    var svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height); svg.setAttribute('width', width); svg.setAttribute('height', height); svg.setAttribute('role', 'img');
    var titleNode = document.createElementNS(ns, 'title'); titleNode.textContent = '日別のアクセス数（折れ線）とログイン数（棒グラフ）'; svg.appendChild(titleNode);
    var accessAxisTitle = document.createElementNS(ns, 'text'); accessAxisTitle.setAttribute('x', '4'); accessAxisTitle.setAttribute('y', '13'); accessAxisTitle.setAttribute('class', 'analytics-chart__axis-title analytics-chart__axis-title--access'); accessAxisTitle.textContent = '左：アクセス数'; svg.appendChild(accessAxisTitle);
    var loginAxisTitle = document.createElementNS(ns, 'text'); loginAxisTitle.setAttribute('x', width - 4); loginAxisTitle.setAttribute('y', '13'); loginAxisTitle.setAttribute('text-anchor', 'end'); loginAxisTitle.setAttribute('class', 'analytics-chart__axis-title analytics-chart__axis-title--login'); loginAxisTitle.textContent = '右：ログイン数'; svg.appendChild(loginAxisTitle);
    [0, 0.5, 1].forEach(function (ratio) {
      var y = base - plotHeight * ratio;
      var grid = document.createElementNS(ns, 'line'); grid.setAttribute('x1', left); grid.setAttribute('x2', width - right); grid.setAttribute('y1', y); grid.setAttribute('y2', y); grid.setAttribute('class', 'analytics-chart__grid'); svg.appendChild(grid);
      var accessScale = document.createElementNS(ns, 'text'); accessScale.setAttribute('x', left - 8); accessScale.setAttribute('y', y + 3); accessScale.setAttribute('text-anchor', 'end'); accessScale.setAttribute('class', 'analytics-chart__scale analytics-chart__scale--access'); accessScale.textContent = formatter.format(Math.round(maxViews * ratio)); svg.appendChild(accessScale);
      var loginScale = document.createElementNS(ns, 'text'); loginScale.setAttribute('x', width - right + 8); loginScale.setAttribute('y', y + 3); loginScale.setAttribute('class', 'analytics-chart__scale analytics-chart__scale--login'); loginScale.textContent = formatter.format(Math.round(maxLogins * ratio)); svg.appendChild(loginScale);
    });
    var step = (width - left - right) / Math.max(1, report.daily.length); var points = [];
    report.daily.forEach(function (day, index) {
      var x = left + step * index + step / 2;
      var barHeight = plotHeight * day.logins / maxLogins;
      var bar = document.createElementNS(ns, 'rect'); bar.setAttribute('x', x - Math.min(9, step * 0.28)); bar.setAttribute('y', base - barHeight); bar.setAttribute('width', Math.min(18, step * 0.56)); bar.setAttribute('height', Math.max(day.logins ? 2 : 0, barHeight)); bar.setAttribute('rx', '3'); bar.setAttribute('class', 'analytics-chart__login-bar');
      var barTitle = document.createElementNS(ns, 'title'); barTitle.textContent = day.date + '：ログイン ' + formatter.format(day.logins) + ' 回'; bar.appendChild(barTitle); svg.appendChild(bar);
      if (day.logins > 0) {
        var barValue = document.createElementNS(ns, 'text'); barValue.setAttribute('x', x); barValue.setAttribute('y', Math.max(top + 10, base - barHeight - 5)); barValue.setAttribute('text-anchor', 'middle'); barValue.setAttribute('class', 'analytics-chart__value analytics-chart__value--login'); barValue.textContent = formatter.format(day.logins); svg.appendChild(barValue);
      }
      var pointY = base - plotHeight * day.pageViews / maxViews; points.push(x + ',' + pointY);
      var date = document.createElementNS(ns, 'text'); date.setAttribute('x', x); date.setAttribute('y', base + 19); date.setAttribute('text-anchor', 'end'); date.setAttribute('transform', 'rotate(-42 ' + x + ' ' + (base + 19) + ')'); date.setAttribute('class', 'analytics-chart__date'); date.textContent = day.date.slice(5).replace('-', '/'); svg.appendChild(date);
    });
    var line = document.createElementNS(ns, 'polyline'); line.setAttribute('points', points.join(' ')); line.setAttribute('class', 'analytics-chart__access-line'); svg.appendChild(line);
    report.daily.forEach(function (day, index) {
      var x = left + step * index + step / 2; var y = base - plotHeight * day.pageViews / maxViews;
      var point = document.createElementNS(ns, 'circle'); point.setAttribute('cx', x); point.setAttribute('cy', y); point.setAttribute('r', '3.5'); point.setAttribute('class', 'analytics-chart__access-point');
      var pointTitle = document.createElementNS(ns, 'title'); pointTitle.textContent = day.date + '：アクセス ' + formatter.format(day.pageViews) + ' 回'; point.appendChild(pointTitle); svg.appendChild(point);
      var pointValue = document.createElementNS(ns, 'text'); pointValue.setAttribute('x', x); pointValue.setAttribute('y', y < top + 15 ? y + 15 : y - 7); pointValue.setAttribute('text-anchor', 'middle'); pointValue.setAttribute('class', 'analytics-chart__value analytics-chart__value--access'); pointValue.textContent = formatter.format(day.pageViews); svg.appendChild(pointValue);
    });
    chart.appendChild(svg);

    var pages = document.getElementById('analyticsPages'); pages.innerHTML = '';
    if (!report.pages.length) pages.innerHTML = '<li class="analytics-empty">期間内のアクセスデータはありません。</li>';
    report.pages.slice(0, 10).forEach(function (page) {
      var item = document.createElement('li');
      var copy = document.createElement('span'); var title = document.createElement('strong'); title.textContent = page.label;
      var path = document.createElement('small'); path.textContent = page.path.indexOf('@link:') === 0 ? '企業専用リンク' : page.path.indexOf('@click:') === 0 ? 'リンククリック' : page.path; copy.append(title, path);
      var value = document.createElement('b'); value.textContent = formatter.format(page.pageViews) + ' 回';
      item.append(copy, value); pages.appendChild(item);
    });

    var tbody = document.getElementById('analyticsCompanies'); tbody.innerHTML = '';
    report.companyRows.forEach(function (row) {
      var tr = document.createElement('tr');
      [row.companyName, formatter.format(row.logins), formatter.format(row.pageViews), formatter.format(row.uniqueSessions)].forEach(function (value) {
        var td = document.createElement('td'); td.textContent = value; tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    document.getElementById('companyComparisonPanel').hidden = Boolean(report.selectedCompanyId);
  }

  function load() {
    if (!fromInput.value || !toInput.value || fromInput.value > toInput.value) {
      status.textContent = '正しい集計期間を指定してください。'; return;
    }
    setBusy(true, 'アクセスデータを読み込んでいます…');
    fetch('/api/analytics?' + query().toString(), { cache:'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('load-failed'); return response.json();
    }).then(function (report) {
      render(report); status.textContent = report.range.from + '〜' + report.range.to + ' の集計を表示しています。';
    }).catch(function () { status.textContent = 'アクセスデータを読み込めませんでした。期間を確認して再度お試しください。'; })
      .finally(function () { setBusy(false); });
  }

  refreshButton.addEventListener('click', load);
  pdfButton.addEventListener('click', function () {
    setBusy(true, 'PDFを作成しています…');
    fetch('/api/analytics/report.pdf?' + query().toString(), { cache:'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('pdf-failed'); return Promise.all([response.blob(), response.headers.get('content-disposition')]);
    }).then(function (values) {
      var match = (values[1] || '').match(/filename="?([^";]+)"?/i); var url = URL.createObjectURL(values[0]);
      var link = document.createElement('a'); link.href = url; link.download = match ? match[1] : 'efukuri-access-report.pdf'; link.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000); status.textContent = 'PDFをダウンロードしました。';
    }).catch(function () { status.textContent = 'PDFを作成できませんでした。再度お試しください。'; })
      .finally(function () { setBusy(false); });
  });
  document.getElementById('adminLogout').addEventListener('click', function () { window.EfukuriAdminLogout(); });
  window.EfukuriAdminSession.ready.then(function (session) {
    adminSession = session;
    if (!session.hasPermission('analytics')) window.location.replace('admin.html?denied=1');
    else load();
  });
}());
