(window.EfukuriContent && window.EfukuriContent.ready || Promise.resolve()).then(function () {
  'use strict';
  var store = window.EfukuriContent;
  var list = document.getElementById('seminarList');
  if (!store || !list) return;

  function addText(parent, tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text || '';
    parent.appendChild(element);
    return element;
  }
  function formatEventDate(value) {
    var date = new Date(value + 'T00:00:00');
    if (Number.isNaN(date.getTime())) return { full:value || '未定', short:'開催日未定', weekday:'' };
    return {
      full: date.getFullYear() + '.' + (date.getMonth() + 1) + '.' + date.getDate(),
      short: (date.getMonth() + 1) + '/' + date.getDate() + ' 開催',
      weekday: new Intl.DateTimeFormat('ja-JP', { weekday:'short' }).format(date)
    };
  }
  function detail(parent, label, text) {
    if (!text) return;
    var row = document.createElement('p'); addText(row, 'span', '', label); row.appendChild(document.createTextNode(text)); parent.appendChild(row);
  }

  var items = store.getPublished('seminar');
  items.forEach(function (item) {
    var date = formatEventDate(item.eventDate);
    var card = document.createElement('article'); card.className = 'seminar-card';
    var visual = document.createElement('figure'); visual.className = 'seminar-card__visual seminar-card__visual--title';
    if (item.image) { var image = document.createElement('img'); image.src = item.image; image.alt = item.title; visual.appendChild(image); }
    else { visual.classList.add('seminar-card__visual--empty'); addText(visual, 'span', '', 'ONLINE SEMINAR'); }
    addText(visual, 'figcaption', '', date.short);

    var body = document.createElement('div'); body.className = 'seminar-card__body';
    var status = addText(body, 'div', 'seminar-card__status', item.format || 'オンラインセミナー');
    var dot = document.createElement('i'); dot.setAttribute('aria-hidden', 'true'); status.prepend(dot);
    addText(body, 'h2', '', item.title);
    var summary = addText(body, 'p', 'seminar-card__summary', item.summary); summary.style.whiteSpace = 'pre-line';

    var schedule = document.createElement('div'); schedule.className = 'seminar-card__schedule'; schedule.setAttribute('aria-label', '開催日時');
    var dateBox = document.createElement('div'); addText(dateBox, 'span', '', '開催日'); addText(dateBox, 'strong', '', date.full); addText(dateBox, 'b', '', date.weekday);
    var timeBox = document.createElement('div'); addText(timeBox, 'span', '', '開催時間'); addText(timeBox, 'strong', '', item.eventTime || '未定');
    schedule.append(dateBox, timeBox); body.appendChild(schedule);

    var details = document.createElement('div'); details.className = 'seminar-card__details';
    detail(details, '形式', item.format); detail(details, '対象', item.audience); detail(details, '講師', item.instructor); body.appendChild(details);
    var agendaItems = String(item.agenda || '').split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    if (agendaItems.length) {
      var agenda = document.createElement('div'); agenda.className = 'seminar-card__agenda'; addText(agenda, 'strong', '', 'AGENDA');
      var agendaList = document.createElement('ul'); agendaItems.forEach(function (line) { addText(agendaList, 'li', '', line); }); agenda.appendChild(agendaList); body.appendChild(agenda);
    }
    if (item.linkUrl) {
      var join = document.createElement('a'); join.className = 'seminar-card__join'; join.href = item.linkUrl;
      join.dataset.analyticsLabel = 'セミナー：' + item.title;
      if (/^https?:\/\//i.test(item.linkUrl)) { join.target = '_blank'; join.rel = 'noopener'; }
      var joinCopy = document.createElement('span'); addText(joinCopy, 'small', '', 'ONLINE ACCESS'); joinCopy.appendChild(document.createTextNode('詳細・参加ページを開く'));
      addText(join, 'b', '', '→'); join.prepend(joinCopy); body.appendChild(join);
    }
    card.append(visual, body); list.appendChild(card);
  });
  if (!items.length) addText(list, 'p', 'seminar-library__empty', '現在公開中のセミナーはありません。');
});
