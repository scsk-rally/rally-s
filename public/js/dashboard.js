(function () {
var efukuriReady = window.EfukuriContent && window.EfukuriContent.ready || Promise.resolve();
efukuriReady.then(function () {
// 企業情報の差し込み
(function () {
  var label = document.getElementById('todayLabel');
  if (!label) return;

  function renderToday() {
    label.textContent = new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    }).format(new Date());
  }

  function scheduleNextDay() {
    var now = new Date();
    var nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0, 0, 1
    );
    window.setTimeout(function () {
      renderToday();
      scheduleNextDay();
    }, nextMidnight.getTime() - now.getTime());
  }

  renderToday();
  scheduleNextDay();

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) renderToday();
  });
})();

// 管理画面で設定したトップページのメインビジュアルを反映
(function () {
  var store = window.EfukuriContent;
  if (!store) return;
  var stored = store.getAll('hero')[0] || {};
  var fallback = store.defaults.hero[0];
  var hero = Object.assign({}, fallback, stored);

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value || '';
  }
  function setLink(id, url) {
    var link = document.getElementById(id);
    if (!link) return;
    link.href = url || '#';
    if (/^https?:\/\//i.test(url || '')) {
      link.target = '_blank';
      link.rel = 'noopener';
    } else {
      link.removeAttribute('target');
      link.removeAttribute('rel');
    }
  }

  setText('dashboardHeroTitle1', hero.titleLine1);
  setText('dashboardHeroTitle2', hero.titleLine2);
  setText('dashboardHeroLead', hero.lead);
  setText('dashboardHeroPrimaryLabel', hero.primaryLabel);
  setText('dashboardHeroSecondaryLabel', hero.secondaryLabel);
  setText('dashboardHeroTrust1', hero.trust1);
  setText('dashboardHeroTrust2', hero.trust2);
  setText('dashboardHeroTrust3', hero.trust3);
  setLink('dashboardHeroPrimary', hero.primaryUrl);
  setLink('dashboardHeroSecondary', hero.secondaryUrl);
  var image = document.getElementById('dashboardHeroImage');
  if (image && hero.image) image.src = hero.image;
})();

// 管理画面で設定した左メニューを反映
(function () {
  var store = window.EfukuriContent;
  if (!store) return;
  var fallback = store.defaults.menu[0];
  var stored = store.getAll('menu')[0] || {};
  var storedGroups = Array.isArray(stored.groups) ? stored.groups : [];

  function orderValue(value, fallbackOrder) {
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallbackOrder;
  }

  function createCustomLink(item, groupIndex) {
    var link = document.createElement('a');
    link.className = 'lg-nav__link';
    link.dataset.menuItem = item.id;
    link.dataset.menuCustom = 'true';
    link.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>';
    link.appendChild(document.createTextNode(''));
    var nextGroup = document.querySelector('[data-menu-group="' + (groupIndex + 1) + '"]');
    var nav = document.querySelector('.lg-nav');
    nav.insertBefore(link, nextGroup || null);
    return link;
  }

  fallback.groups.forEach(function (fallbackGroup, groupIndex) {
    var storedGroup = storedGroups[groupIndex] || {};
    var savedItems = Array.isArray(storedGroup.items) ? storedGroup.items : [];
    var items = fallbackGroup.items.map(function (fallbackItem, itemIndex) {
      var savedItem = savedItems.find(function (item) { return item && item.id === fallbackItem.id; }) || {};
      var merged = Object.assign({}, fallbackItem, savedItem);
      merged.order = orderValue(merged.order, itemIndex + 1);
      return merged;
    });
    savedItems.forEach(function (item) {
      if (item && item.id && !items.some(function (entry) { return entry.id === item.id; })) {
        var added = Object.assign({}, item);
        added.order = orderValue(added.order, items.length + 1);
        items.push(added);
      }
    });
    items = items.map(function (item, index) { return { item:item, index:index }; })
      .sort(function (a, b) { return a.item.order - b.item.order || a.index - b.index; })
      .map(function (entry) { return entry.item; });
    var title = storedGroup.title || fallbackGroup.title;
    var groupLabel = document.querySelector('[data-menu-group="' + groupIndex + '"]');
    if (groupLabel) groupLabel.textContent = title;
    var visibleItems = 0;

    items.forEach(function (item) {
      var link = document.querySelector('[data-menu-item="' + item.id + '"]') || createCustomLink(item, groupIndex);
      var nextGroup = document.querySelector('[data-menu-group="' + (groupIndex + 1) + '"]');
      var nav = document.querySelector('.lg-nav');
      nav.insertBefore(link, nextGroup || null);
      link.hidden = item.visible === false;
      if (!link.hidden) visibleItems += 1;
      var targetUrl = item.url || 'dashboard.html';
      var useIframePage = item.custom === true && store.isAllowedTargetUrl(targetUrl);
      link.href = useIframePage ? 'embed-menu.html?id=' + encodeURIComponent(item.id) : targetUrl;

      var labelNode = Array.prototype.find.call(link.childNodes, function (node) {
        return node.nodeType === 3 && String(node.nodeValue || '').trim();
      });
      if (!labelNode) {
        labelNode = document.createTextNode('');
        link.appendChild(labelNode);
      }
      labelNode.nodeValue = '\n        ' + (item.label || '新しいメニュー');

      var external = !useIframePage && /^https?:\/\//i.test(targetUrl);
      if (external) { link.target = '_blank'; link.rel = 'noopener'; }
      else { link.removeAttribute('target'); link.removeAttribute('rel'); }
      var ext = link.querySelector('.lg-ext');
      if (external && !ext) {
        ext = document.createElement('span'); ext.className = 'lg-ext'; ext.textContent = '↗'; link.appendChild(ext);
      }
      if (ext) ext.hidden = !external;
    });
    if (groupLabel) groupLabel.hidden = visibleItems === 0;
  });
})();

// 各管理画面で設定したトップページの見出し・補足文・バッジを反映
(function () {
  var store = window.EfukuriContent;
  if (!store) return;

  function section(id) {
    var fallback = store.defaults.section.find(function (item) { return item.id === id; }) || {};
    var stored = store.getAll('section').find(function (item) { return item.id === id; }) || {};
    return Object.assign({}, fallback, stored);
  }
  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value || '';
  }
  function setBadge(id, item) {
    var badge = document.getElementById(id);
    if (!badge) return;
    badge.textContent = item.badgeText || '';
    badge.hidden = item.badgeVisible === false || !item.badgeText;
  }

  var topics = section('topics');
  setText('dashboardTopicsEyebrow', topics.eyebrow);
  setText('dashboardTopicsTitle', topics.title);
  setText('dashboardTopicsLead', topics.lead);

  var consultations = section('consultations');
  setText('dashboardConsultationsTitle', consultations.title);
  setText('dashboardConsultationsLead', consultations.lead);
  setText('dashboardConsultationsNote', consultations.note);

  var videos = section('videos');
  setText('dashboardVideosTitle', videos.title);
  setBadge('dashboardVideosBadge', videos);
  setText('dashboardVideosLinkLabel', videos.linkLabel);
  var videoLink = document.getElementById('dashboardVideosLink');
  if (videoLink) videoLink.href = videos.linkUrl || 'seminar.html';

  var services = section('services');
  setText('dashboardServicesTitle', services.title);
  setBadge('dashboardServicesBadge', services);
  setText('dashboardServicesLead', services.lead);
  setText('dashboardServicesNote', services.note);
})();

(async function () {
  var DEFAULT_COMPANY = {
    shortName: 'SCSK',
    fullName: 'SCSK株式会社',
    mark: 'SC',
    code: 'EFK-2026-0417',
    pensionName: '',
    pensionUrl: '',
    stockPlanName: '',
    stockPlanUrl: '',
    logoUrl: ''
  };
  var company = DEFAULT_COMPANY;

  try {
    var sessionBody = await window.EfukuriMemberSession;
    if (!sessionBody || !sessionBody.authenticated) throw new Error('session-expired');
    if (sessionBody.company) {
      company = sessionBody.company;
    }
  } catch (e) {
    window.location.replace('login.html');
    return;
  }

  var greetingName = document.querySelector('.lg-topbar__greeting .lg-name');
  if (greetingName) greetingName.textContent = company.shortName;

  var companyName = document.querySelector('.lg-side__company-name');
  if (companyName) companyName.textContent = company.fullName;

  var companyCode = document.querySelector('.lg-side__company-code');
  if (companyCode) companyCode.textContent = company.code;

  var companyMark = document.querySelector('.lg-side__company-mark');
  if (companyMark) companyMark.textContent = company.mark;

  var companyLogo = document.getElementById('dashboardCompanyLogo');
  if (companyLogo && company.logoUrl) {
    window.EfukuriCompanyLogo.apply(companyLogo, company.logoUrl);
    companyLogo.alt = company.fullName + ' ロゴ';
    companyLogo.classList.add('is-company-logo');
  }

  var companyLinksArea = document.getElementById('companyLinksArea');
  var pensionLink = document.getElementById('companyPensionLink');
  var pensionLinkName = document.getElementById('companyPensionLinkName');
  var stockPlanLink = document.getElementById('companyStockPlanLink');
  var stockPlanLinkName = document.getElementById('companyStockPlanLinkName');
  var visibleCompanyLinks = 0;
  if (pensionLink && pensionLinkName && company.pensionName && company.pensionUrl) {
    try {
      var parsedPensionUrl = new URL(company.pensionUrl);
      if (parsedPensionUrl.protocol === 'https:' || parsedPensionUrl.protocol === 'http:') {
        pensionLink.href = parsedPensionUrl.href;
        pensionLinkName.textContent = company.pensionName;
        pensionLink.setAttribute('aria-label', company.pensionName + 'の確定拠出年金加入者ページを開く');
        pensionLink.hidden = false;
        visibleCompanyLinks += 1;
      }
    } catch (e) {}
  }
  if (stockPlanLink && stockPlanLinkName && company.stockPlanName && company.stockPlanUrl) {
    try {
      var parsedStockPlanUrl = new URL(company.stockPlanUrl);
      if (parsedStockPlanUrl.protocol === 'https:' || parsedStockPlanUrl.protocol === 'http:') {
        stockPlanLink.href = parsedStockPlanUrl.href;
        stockPlanLinkName.textContent = company.stockPlanName;
        stockPlanLink.setAttribute('aria-label', company.stockPlanName + 'の加入者ページを開く');
        stockPlanLink.hidden = false;
        visibleCompanyLinks += 1;
      }
    } catch (e) {}
  }
  if (companyLinksArea && visibleCompanyLinks) {
    companyLinksArea.classList.toggle('is-single', visibleCompanyLinks === 1);
    companyLinksArea.hidden = false;
  }
  var logoutLink = document.querySelector('.lg-side__logout');
  if (logoutLink) logoutLink.addEventListener('click', function (event) {
    event.preventDefault();
    fetch('/api/auth/member/logout', { method:'POST' }).finally(function () {
      window.location.href = 'login.html';
    });
  });
})();

// マネハピ通信：最新記事タイトルの自動取得
(function () {
  var titleEl = document.getElementById('manehapiLatestTitle');
  if (!titleEl) return;
  fetch('https://kagoya-consul.co.jp/manehapi/wp-json/wp/v2/posts?per_page=1&_fields=title')
    .then(function (res) {
      if (!res.ok) throw new Error('network error');
      return res.json();
    })
    .then(function (posts) {
      if (!posts || !posts[0] || !posts[0].title) throw new Error('no posts');
      var scratch = document.createElement('textarea');
      scratch.innerHTML = posts[0].title.rendered;
      titleEl.textContent = scratch.value;
    })
    .catch(function () {
      titleEl.textContent = 'マネハピ通信で最新記事をチェック';
    });
})();

// サイドバー開閉（モバイル）
var menuToggle = document.getElementById('menuToggle');
var sideNav = document.getElementById('sideNav');
if (menuToggle) {
  menuToggle.addEventListener('click', function () {
    sideNav.classList.toggle('is-open');
  });
}

// 管理画面で登録したお知らせ・動画を公開条件に合わせて表示
(function () {
  var store = window.EfukuriContent;
  if (!store) return;

  var noticeList = document.getElementById('dashboardNotices');
  if (noticeList) {
    store.getPublished('notice').forEach(function (item) {
      var notice = document.createElement('a');
      notice.className = 'lg-notice';
      notice.href = item.linkUrl || '#';
      if (/^https?:\/\//i.test(item.linkUrl || '')) { notice.target = '_blank'; notice.rel = 'noopener'; }

      var badge = document.createElement('span'); badge.className = 'lg-notice__badge'; badge.textContent = 'NEW';
      var icon = document.createElement('span'); icon.className = 'lg-notice__icon';
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 11.5v-3A2.5 2.5 0 0 1 6.5 6H9l6-3v14l-6-3H6.5A2.5 2.5 0 0 1 4 11.5Z"/><path d="M9 14v4.5a1.5 1.5 0 0 1-3 0V14"/><path d="M18 7.5a5 5 0 0 1 0 5"/></svg>';
      var copy = document.createElement('span'); copy.className = 'lg-notice__copy';
      var label = document.createElement('small'); label.textContent = 'お知らせ';
      var title = document.createElement('strong'); title.textContent = item.title;
      var body = document.createElement('span'); body.textContent = item.body || '';
      copy.append(label, title, body);
      var more = document.createElement('span'); more.className = 'lg-notice__more'; more.textContent = item.linkLabel || '詳細を見る';
      var arrow = document.createElement('b'); arrow.textContent = '→'; more.appendChild(arrow);
      notice.append(badge, icon, copy, more); noticeList.appendChild(notice);
    });
    noticeList.hidden = !noticeList.children.length;
  }

  var topicList = document.getElementById('dashboardTopics');
  if (topicList) {
    var topicClasses = ['lg-start-card--main', 'lg-start-card--talk', 'lg-start-card--read', 'lg-start-card--watch'];
    store.getAll('topic').sort(function (a, b) {
      return (Number(a.order) || 999) - (Number(b.order) || 999);
    }).forEach(function (item, index) {
      var card = document.createElement('a');
      card.className = 'lg-start-card ' + topicClasses[index % topicClasses.length];
      var normalizedTopicTitle = String(item.title || '').replace(/\s+/g, '');
      var topicTargetUrl = normalizedTopicTitle === '自分の確定拠出年金を考えよう'
        ? 'embed-dc-simulator.html'
        : (item.targetUrl || '#');
      card.href = topicTargetUrl;
      if (/^https?:\/\//i.test(topicTargetUrl)) { card.target = '_blank'; card.rel = 'noopener'; }

      var badge = document.createElement('span'); badge.className = 'lg-start-card__time'; badge.textContent = item.badge || '';
      var icon = document.createElement('span'); icon.className = 'lg-start-card__emoji'; icon.textContent = item.icon || '・';
      var title = document.createElement('strong');
      title.textContent = item.id === 'topic-default-4' && /^動画で\s*ゆるく学ぶ$/.test(item.title)
        ? 'セミナー・動画で\nゆるく学ぶ'
        : item.title;
      var subtitle = document.createElement('small'); subtitle.textContent = item.subtitle || '';
      var button = document.createElement('b');
      var arrow = /^https?:\/\//i.test(topicTargetUrl) ? ' ↗' : /^#/.test(topicTargetUrl) ? ' ↓' : ' →';
      button.textContent = (item.buttonLabel || '詳しく見る') + arrow;
      card.append(badge, icon, title, subtitle, button); topicList.appendChild(card);
    });
  }

  var consultationList = document.getElementById('dashboardConsultations');
  if (consultationList) {
    var consultationClasses = ['lg-quick-card--fp', 'lg-quick-card--invest', 'lg-quick-card--expert'];
    var consultationIcons = [
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12a8 8 0 1 1-3.2-6.4"/><path d="M12 8v4l3 2"/></svg>',
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="5"/><rect x="12" y="8" width="3" height="9"/><rect x="17" y="5" width="3" height="12"/></svg>',
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"/><path d="M5 8l-3 6a4 4 0 0 0 8 0z"/><path d="M19 8l-3 6a4 4 0 0 0 8 0z"/><path d="M5 8h14"/></svg>'
    ];
    store.getAll('consultation').sort(function (a, b) {
      return (Number(a.order) || 999) - (Number(b.order) || 999);
    }).forEach(function (item, index) {
      var card = document.createElement('a');
      card.className = 'lg-quick-card ' + consultationClasses[index % consultationClasses.length];
      card.href = item.targetUrl;
      card.dataset.analyticsLabel = '相談サービス：' + item.title;
      if (/^https?:\/\//i.test(item.targetUrl || '')) { card.target = '_blank'; card.rel = 'noopener'; }

      var tag = document.createElement('span'); tag.className = 'lg-quick-card__tag'; tag.textContent = item.tag || '相談サービス';
      var image = document.createElement('img'); image.className = 'lg-quick-card__art'; image.src = item.image || ''; image.alt = ''; image.loading = 'lazy'; image.setAttribute('aria-hidden', 'true');
      var icon = document.createElement('div'); icon.className = 'lg-quick-card__icon' + (index % 3 === 1 ? ' lg-quick-card__icon--wine' : ''); icon.innerHTML = consultationIcons[index % consultationIcons.length];
      var title = document.createElement('div'); title.className = 'lg-quick-card__title'; title.textContent = item.title;
      var description = document.createElement('div'); description.className = 'lg-quick-card__desc'; description.textContent = item.description || '';
      var cta = document.createElement('div'); cta.className = 'lg-quick-card__cta';
      var ctaLabel = document.createElement('span'); ctaLabel.textContent = item.buttonLabel || '相談する';
      var arrow = document.createElement('b'); arrow.textContent = /^https?:\/\//i.test(item.targetUrl || '') ? '↗' : '→'; cta.append(ctaLabel, arrow);
      card.append(tag, image, icon, title, description, cta); consultationList.appendChild(card);
    });
  }

  var videoList = document.getElementById('dashboardVideos');
  if (videoList) {
    store.getPublished('video').sort(function (a, b) {
      return (Number(a.order) || 999) - (Number(b.order) || 999) || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    }).forEach(function (item) {
      var videoId = item.youtubeId || store.extractYouTubeId(item.youtubeUrl);
      if (!videoId) return;
      var card = document.createElement('a');
      card.className = 'lg-video-card'; card.href = item.youtubeUrl; card.target = '_blank'; card.rel = 'noopener';
      card.dataset.analyticsLabel = '動画：' + item.title;
      card.dataset.analyticsTrack = 'content';
      card.setAttribute('data-video-title', item.title); card.setAttribute('data-video-src', 'https://www.youtube.com/embed/' + videoId);
      if (item.duration) card.setAttribute('data-video-duration', item.duration);

      var thumb = document.createElement('div'); thumb.className = 'lg-video-card__thumb';
      var image = document.createElement('img'); image.className = 'lg-video-card__thumb-img'; image.alt = ''; image.loading = 'lazy';
      image.src = item.image || 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg';
      var play = document.createElement('div'); play.className = 'lg-video-card__play'; play.innerHTML = '<span>▶</span>';
      var duration = document.createElement('div'); duration.className = 'lg-video-card__duration'; duration.hidden = true; duration.textContent = '--:--';
      thumb.append(image, play, duration);
      var cardBody = document.createElement('div'); cardBody.className = 'lg-video-card__body';
      var category = document.createElement('span'); category.className = 'lg-video-card__tag'; category.textContent = item.category || '動画';
      var cardTitle = document.createElement('div'); cardTitle.className = 'lg-video-card__title'; cardTitle.textContent = item.title;
      cardBody.append(category, cardTitle); card.append(thumb, cardBody); videoList.appendChild(card);
    });
  }

  var serviceList = document.getElementById('dashboardServices');
  var serviceSection = document.getElementById('dashboardServicesSection');
  if (serviceList) {
    var serviceIcons = [
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="m4 8 6-4 6 7 5-6"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 3 7.5 12 12l9-4.5L12 3Z"/><path d="M6 10v5.5c3.4 2.6 8.6 2.6 12 0V10"/><path d="M21 8v6"/></svg>'
    ];
    var toneClasses = ['lg-benefit-card--asset', 'lg-benefit-card--health', 'lg-benefit-card--learning'];
    store.getPublished('service').sort(function (a, b) {
      return (Number(a.order) || 999) - (Number(b.order) || 999) || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    }).forEach(function (item, index) {
      var card = document.createElement('a');
      card.className = 'lg-benefit-card ' + toneClasses[index % toneClasses.length];
      card.dataset.analyticsLabel = 'サービス：' + item.title;
      card.dataset.analyticsTrack = 'content';
      var isDirectLink = item.linkMode === 'direct';
      card.href = isDirectLink ? item.targetUrl : 'embed-service.html?id=' + encodeURIComponent(item.id);
      if (isDirectLink && /^https?:\/\//i.test(item.targetUrl || '')) { card.target = '_blank'; card.rel = 'noopener'; }

      var top = document.createElement('div'); top.className = 'lg-benefit-card__top';
      var icon = document.createElement('div'); icon.className = 'lg-benefit-card__icon'; icon.innerHTML = serviceIcons[index % serviceIcons.length];
      var badge = document.createElement('span'); badge.className = 'lg-benefit-card__badge'; badge.textContent = item.category || 'サービス';
      top.append(icon, badge);
      var hint = document.createElement('span'); hint.className = 'lg-benefit-card__hint'; hint.textContent = item.hint || '会員向けサービス';
      var title = document.createElement('div'); title.className = 'lg-benefit-card__title'; title.textContent = item.title;
      var description = document.createElement('div'); description.className = 'lg-benefit-card__desc'; description.textContent = item.description || '';
      var cta = document.createElement('div'); cta.className = 'lg-benefit-card__cta';
      var ctaLabel = document.createElement('span'); ctaLabel.textContent = item.buttonLabel || 'サービスを見る';
      var arrow = document.createElement('b'); arrow.textContent = isDirectLink && /^https?:\/\//i.test(item.targetUrl || '') ? '↗' : '→'; cta.append(ctaLabel, arrow);
      card.append(top, hint, title, description, cta); serviceList.appendChild(card);
    });
    if (serviceSection) serviceSection.hidden = !serviceList.children.length;
  }
})();

// 再生時間はCMSの登録値を表示。プレーヤーは動画を選んだときだけ読み込む。
document.querySelectorAll('.lg-video-card[data-video-src]').forEach(function (card) {
  var durationEl = card.querySelector('.lg-video-card__duration');
  if (!durationEl) return;
  var duration = card.getAttribute('data-video-duration') || '';
  durationEl.textContent = duration;
  durationEl.hidden = !duration;
  if (duration) durationEl.setAttribute('aria-label', '動画時間 ' + duration);
});

// 動画モーダル
var modal = document.getElementById('videoModal');
var modalFrame = document.getElementById('videoModalFrame');
var modalTitle = document.getElementById('videoModalTitle');
var modalClose = document.getElementById('videoModalClose');
var modalYoutube = document.getElementById('videoModalYoutube');

document.querySelectorAll('[data-video-src]').forEach(function (card) {
  card.addEventListener('click', function (e) {
    var directUrl = card.getAttribute('href') || '';

    // file:// ではYouTubeが必要とするHTTP Refererを送れないため、
    // 指定されたYouTubeページを新しいタブで直接開く。
    if (window.location.protocol === 'file:' && /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(directUrl)) {
      return;
    }

    e.preventDefault();
    var src = card.getAttribute('data-video-src');
    var title = card.getAttribute('data-video-title') || 'セミナー動画';
    modalFrame.src = src + (src.indexOf('?') === -1 ? '?' : '&') + 'autoplay=1&playsinline=1';
    modalTitle.textContent = title;
    if (modalYoutube && directUrl && directUrl !== '#') modalYoutube.href = directUrl;
    modal.classList.add('is-open');
  });
});

function closeModal() {
  if (!modal) return;
  modal.classList.remove('is-open');
  modalFrame.src = '';
}

if (modalClose) modalClose.addEventListener('click', closeModal);
if (modal) {
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });
}
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeModal();
});
});
}());
