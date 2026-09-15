(window.EfukuriContent && window.EfukuriContent.ready || Promise.resolve()).then(function () {
  'use strict';

  var store = window.EfukuriContent;
  var grid = document.getElementById('expertCards');
  if (!store || !grid) return;

  var toneClasses = ['lg-expert-card--lawyer', 'lg-expert-card--tax', 'lg-expert-card--realestate'];
  var items = store.getPublished('expert').sort(function (a, b) {
    return (Number(a.order) || 999) - (Number(b.order) || 999) || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  items.forEach(function (item, index) {
    var card = document.createElement('article');
    card.className = 'lg-expert-card ' + toneClasses[index % toneClasses.length];

    var visual = document.createElement('div'); visual.className = 'lg-expert-card__visual';
    var image = document.createElement('img'); image.src = item.image; image.alt = item.title + 'のイメージ'; image.loading = 'lazy';
    var englishLabel = document.createElement('span'); englishLabel.textContent = item.englishLabel || 'EXPERT';
    visual.append(image, englishLabel);

    var body = document.createElement('div'); body.className = 'lg-expert-card__body';
    var number = document.createElement('div'); number.className = 'lg-expert-card__number'; number.textContent = String(index + 1).padStart(2, '0');
    var eyebrow = document.createElement('p'); eyebrow.className = 'lg-expert-card__eyebrow'; eyebrow.textContent = item.consultationLabel || '専門家へのご相談';
    var title = document.createElement('h2'); title.textContent = item.title;
    var description = document.createElement('p'); description.className = 'lg-expert-card__desc'; description.textContent = item.description || '';
    var button = document.createElement('a'); button.className = 'lg-expert-card__button'; button.href = 'embed-expert.html?id=' + encodeURIComponent(item.id);
    button.dataset.analyticsLabel = '専門家相談：' + item.title;
    var buttonLabel = document.createElement('span'); buttonLabel.textContent = item.buttonLabel || '相談へ進む';
    var arrow = document.createElement('b'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '→'; button.append(buttonLabel, arrow);
    var notice = document.createElement('p'); notice.className = 'lg-expert-card__notice';
    if (item.recipientName) {
      notice.append(document.createTextNode('申し込み情報は'));
      var recipient = document.createElement('strong'); recipient.textContent = item.recipientName + 'に送信されます'; notice.appendChild(recipient);
    }
    body.append(number, eyebrow, title, description, button, notice);
    card.append(visual, body); grid.appendChild(card);
  });

  if (!items.length) {
    var empty = document.createElement('p'); empty.className = 'lg-expert-empty'; empty.textContent = '現在公開中の専門家相談はありません。'; grid.appendChild(empty);
  }
});
