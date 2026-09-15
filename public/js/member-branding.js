(function () {
  'use strict';
  var trackablePages = [
    '/dashboard.html','/seminar.html','/expert.html','/saliva-checker.html','/embed-expert.html','/embed-fp.html',
    '/embed-fudosan.html','/embed-horitsu.html','/embed-iryo.html','/embed-lifeplan.html','/embed-manehapi.html',
    '/embed-menu.html','/embed-toshi.html','/embed-zeimu.html'
  ];
  var isTrackablePage = trackablePages.indexOf(window.location.pathname) !== -1;
  function sendAnalytics(body) {
    fetch('/api/analytics/pageview', {
      method:'POST', credentials:'same-origin', keepalive:true,
      headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body)
    }).then(function (response) {
      if (!response.ok) throw new Error('pageview-save-failed');
    }).catch(function () {});
  }
  if (isTrackablePage) {
    sendAnalytics({ path:window.location.pathname });
    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!(target instanceof Element)) return;
      var link = target.closest('a[href]');
      if (!link || link.classList.contains('sc-skip') || link.hasAttribute('data-analytics-ignore')) return;
      var fixedEvent = link.getAttribute('data-analytics-event');
      if (fixedEvent) {
        sendAnalytics({ path:fixedEvent });
        return;
      }
      var rawHref = link.getAttribute('href') || '';
      if (!rawHref || rawHref === '#') return;
      var targetUrl;
      try { targetUrl = new URL(rawHref, window.location.href).href; } catch (error) { return; }
      var targetProtocol = new URL(targetUrl).protocol;
      var isExternal = (targetProtocol === 'http:' || targetProtocol === 'https:') && new URL(targetUrl).origin !== window.location.origin;
      var isContactLink = targetProtocol === 'mailto:' || targetProtocol === 'tel:';
      var isContentAction = link.getAttribute('data-analytics-track') === 'content';
      if (!isExternal && !isContactLink && !isContentAction) return;
      var label = link.getAttribute('data-analytics-label') || link.getAttribute('data-video-title') || link.getAttribute('aria-label') || link.textContent || 'リンク';
      label = label.replace(/[↗→↓↑]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) || 'リンク';
      sendAnalytics({ kind:'link', sourcePath:window.location.pathname, targetUrl:targetUrl, label:label });
    }, true);
  }
  window.EfukuriMemberSession = fetch('/api/auth/member/session', { cache:'no-store', credentials:'same-origin' }).then(function (response) {
    if (!response.ok) throw new Error('session-expired');
    return response.json();
  });
  window.EfukuriMemberSession.then(function (body) {
    var company = body && body.company;
    if (!company || !company.logoUrl) return;
    Array.prototype.forEach.call(document.querySelectorAll('img[data-site-logo]'), function (image) {
      window.EfukuriCompanyLogo.apply(image, company.logoUrl);
      image.alt = company.fullName + ' ロゴ';
      image.classList.add('is-company-logo');
    });
  }).catch(function () {});
})();
