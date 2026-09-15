'use strict';
const $ = id => document.getElementById(id);
const form = $('plan-form');
let step = 1, eventType = 'なし', saving = 0, data, sampleUsed = false, assumedPension = false;
const number = id => Number($(id).value);
const fmt = n => new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 }).format(n);
const money = n => `${fmt(n / 10000)}<em>万円</em>`;
function balance() {
  $('balance').innerHTML = $('income').value !== '' && $('spending').value !== '' ? `${number('income') - number('spending') > 0 ? '+' : ''}${fmt(number('income') - number('spending'))}<em>万円</em>` : '—<em>万円</em>';
}
function clearError() { $('error').textContent = ''; document.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid')); }
function validate() {
  clearError();
  const ids = step === 1 ? ['age', 'assets', 'income', 'spending'] : ['retire', 'pension', 'futureSpending', 'retirementPay', ...(eventType !== 'なし' ? ['eventAge', 'eventAmount'] : [])];
  for (const id of ids) {
    const el = $(id);
    let message = '';
    if (el.value === '' || !Number.isFinite(Number(el.value))) message = '金額・年齢を入力してください（0も入力できます）。';
    else if (!el.validity.valid) message = `${id === 'age' ? '年齢は18〜64歳の整数で入力してください。' : `入力範囲は${el.min}〜${el.max}です。${el.step === '1' ? '整数' : '小数第1位まで'}で入力してください。`}`;
    else if (id === 'retire' && number(id) <= number('age')) message = '仕事を終える年齢は、現在より後にしてください。';
    else if (id === 'eventAge' && number(id) < number('age')) message = '出費の年齢は、現在の年齢以降にしてください。';
    if (message) { $('error').textContent = message; el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', 'error'); el.focus(); return false; }
  }
  return true;
}
function showStep(next) {
  step = next; clearError();
  for (let n = 1; n <= 3; n++) {
    $(`screen-${n}`).hidden = n !== step;
    const li = document.querySelector(`.steps [data-step="${n}"]`);
    li.classList.toggle('active', n === step);
    if (n === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  }
  document.querySelectorAll('.progress i').forEach((el, i) => el.classList.toggle('on', i < step));
  $('step-label').textContent = `STEP 0${step} / 03`;
  $('back').hidden = step !== 2;
  $('pdf-export').hidden = step !== 3;
  $('step-hint').hidden = step !== 1;
  $('next').innerHTML = step === 3 ? '条件を変える <span aria-hidden="true">↺</span>' : step === 2 ? '結果を見る <span aria-hidden="true">→</span>' : '次へ <span aria-hidden="true">→</span>';
  $('footnote').textContent = step === 3 ? `${sampleUsed ? 'サンプル入力 · ' : ''}${assumedPension ? '将来収入は仮定 · ' : ''}運用・物価変動なしの概算です` : '登録不要 · 入力内容は保存されません';
  $(`screen-${step}`).querySelector('h2').focus({ preventScroll: true });
}
form.addEventListener('submit', e => {
  e.preventDefault();
  if (step === 3) { showStep(1); return; }
  if (!validate()) return;
  if (step === 1) { if ($('futureSpending').value === '') $('futureSpending').value = $('spending').value; showStep(2); }
  else {
    data = Object.fromEntries(['age', 'assets', 'income', 'spending', 'retire', 'pension', 'futureSpending', 'retirementPay', 'eventAge', 'eventAmount'].map(id => [id, number(id)]));
    data.event = eventType; saving = 0;
    const savingMax = 10;
    $('saving-slider').max = $('saving-amount').max = savingMax;
    $('saving-slider').disabled = $('saving-amount').disabled = false;
    $('saving-limit').textContent = '0〜10万円・0.1万円単位（支出は0円が下限）';
    $('saving-slider').value = $('saving-amount').value = 0;
    showStep(3); renderResult();
  }
});
$('back').addEventListener('click', () => showStep(1));
form.addEventListener('input', e => { if (e.target.closest('#savings')) return; clearError(); if (e.target.id === 'pension') assumedPension = false; balance(); });
$('sample').addEventListener('click', () => {
  Object.entries({ age:35, assets:500, income:35, spending:28, retire:65, pension:20, futureSpending:25, retirementPay:0 }).forEach(([id,v]) => $(id).value = v);
  sampleUsed = true; assumedPension = true; $('sample-note').textContent = 'サンプル入力中 · 自由に変更できます'; $('sample').textContent = 'サンプルを再入力 ↗'; clearError(); balance();
});
$('assume-pension').addEventListener('click', () => { $('pension').value = 20; assumedPension = true; $('assume-pension').textContent = '仮の20万円を使用中（変更できます）'; clearError(); });
$('event-types').addEventListener('click', e => {
  const button = e.target.closest('button'); if (!button) return;
  eventType = button.dataset.event;
  document.querySelectorAll('#event-types button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  $('event-fields').hidden = eventType === 'なし';
  $('eventAge').required = $('eventAmount').required = eventType !== 'なし'; clearError();
});
function setSaving(value, preserveInput = false) {
  saving = Math.round(Math.min(Number($('saving-amount').max), Math.max(0, value)) * 10) / 10;
  $('saving-slider').value = saving;
  if (!preserveInput) $('saving-amount').value = saving;
  $('pdf-export').disabled = false; clearError(); renderResult();
}
$('saving-slider').addEventListener('input', e => setSaving(Number(e.target.value)));
$('saving-amount').addEventListener('input', e => {
  if (e.target.value === '' || !e.target.validity.valid) {
    e.target.setAttribute('aria-invalid', 'true'); $('pdf-export').disabled = true;
    $('error').textContent = `0〜${fmt(Number(e.target.max))}万円を、0.1万円単位で入力してください。`; return;
  }
  setSaving(Number(e.target.value), true);
});
$('saving-amount').addEventListener('change', e => { if (e.target.value === '' || !e.target.validity.valid) setSaving(e.target.value === '' ? saving : Number(e.target.value)); });
$('saving-reset').addEventListener('click', () => setSaving(0));
function renderResult() {
  $('saving-slider').setAttribute('aria-valuetext', `毎月${fmt(saving)}万円減らす`);
  $('saving-slider').style.setProperty('--fill', `${Number($('saving-slider').max) ? saving / Number($('saving-slider').max) * 100 : 0}%`);
  const base = LifePlan.simulate(data), revised = LifePlan.simulate(data, saving);
  $('retire-label').textContent = `${data.retire}歳の${revised.retirement < 0 ? '累積不足額' : '金融資産'}`;
  $('retire-value').innerHTML = money(Math.abs(revised.retirement));
  $('end-label').textContent = revised.end < 0 ? '90歳の累積不足額' : '90歳時点';
  $('end-value').innerHTML = money(Math.abs(revised.end));
  const assessment = LifePlan.assess(revised);
  $('verdict').className = `verdict ${assessment.status}`;
  $('verdict-icon').textContent = assessment.status === 'good' ? '✓' : '!';
  $('verdict-title').textContent = assessment.title;
  $('verdict-context').textContent = saving ? `月${saving}万円見直した場合の判定` : 'いまの条件での判定';
  $('outlook').textContent = assessment.reason;
  $('advice-context').textContent = `${$('verdict-context').textContent}：${assessment.title}`;
  $('advice-list').replaceChildren(...LifePlan.advice(revised).map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  $('comparison-legend').hidden = saving === 0;
  $('improvement').innerHTML = saving ? `90歳時点で <strong>＋${fmt((revised.end - base.end) / 10000)}万円</strong> の変化。${revised.shortage ? '不足の時期も、グラフで確認できます。' : '毎月の見直しが、将来の余裕に。'}` : '小さな見直しで、未来がどう変わるか試してみましょう。';
  drawChart(base, revised);
}
function drawChart(base, revised) {
  // Keep the comparison scale fixed to the realistic 0〜10万円 control range.
  const largest = LifePlan.simulate(data, 10);
  const values = [...base.points, ...largest.points].map(p => p.balance / 10000);
  let low = Math.min(0, ...values), high = Math.max(1, ...values);
  const raw = (high - low) / 4, power = 10 ** Math.floor(Math.log10(raw));
  const tick = [1, 2, 5, 10].find(n => n * power >= raw) * power;
  low = Math.floor(low / tick) * tick; high = Math.ceil(high / tick) * tick;
  const w = Math.max(280, $('chart').clientWidth), h = Math.max(90, $('chart').clientHeight);
  const left = high > 99999 || low < -99999 ? 58 : 45, right = 15, top = 18, bottom = 25;
  const x = age => left + (age - data.age) / (90 - data.age) * (w - left - right);
  const y = balance => top + (high - balance / 10000) / (high - low) * (h - top - bottom);
  const path = points => points.map((p,i) => `${i ? 'L' : 'M'}${x(p.age).toFixed(2)},${y(p.balance).toFixed(2)}`).join(' ');
  let svg = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${data.age}歳から90歳の残高。${data.retire}歳で${fmt(revised.retirement / 10000)}万円、90歳で${fmt(revised.end / 10000)}万円。${revised.shortage ? `${revised.shortage}歳で資金不足。` : '資金不足なし。'}"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#a8bfa0" stop-opacity=".25"/><stop offset="1" stop-color="#a8bfa0" stop-opacity=".02"/></linearGradient></defs>`;
  const count = Math.round((high - low) / tick);
  for (let i = 0; i <= count; i++) { const value = low + tick * i, yy = y(value * 10000); svg += `<line x1="${left}" y1="${yy}" x2="${w-right}" y2="${yy}" stroke="${value === 0 ? '#a6b29f' : '#e6eae1'}" stroke-dasharray="${value === 0 ? '0' : '3 4'}"/><text x="${left-8}" y="${yy+3}" text-anchor="end">${fmt(value)}</text>`; }
  const ticks = [data.age, data.retire, 90];
  ticks.forEach((age,i) => { if (i === 1 && (x(age)-x(data.age)<34 || x(90)-x(age)<34)) return; svg += `<text x="${x(age)}" y="${h-5}" text-anchor="${i===0?'start':i===2?'end':'middle'}">${age}歳</text>`; });
  svg += `<path d="${path(base.points)} L${x(90)},${y(0)} L${x(data.age)},${y(0)} Z" fill="url(#fill)"/><path d="${path(base.points)}" fill="none" stroke="#24574a" stroke-width="2.3" stroke-linejoin="round"${saving ? ' stroke-dasharray="4 4"' : ''}/>`;
  if (saving) svg += `<path d="${path(revised.points)}" fill="none" stroke="#c58b53" stroke-width="2.7" stroke-linejoin="round"/>`;
  [revised.points.find(p => p.age === data.retire), revised.points.at(-1)].forEach(p => svg += `<circle cx="${x(p.age)}" cy="${y(p.balance)}" r="3.5" fill="${saving ? '#c58b53' : '#24574a'}" stroke="#fffefa" stroke-width="1.5"/>`);
  if (data.event !== 'なし') { const p = revised.points.find(p=>p.age===data.eventAge+1); svg += `<line x1="${x(p.age)}" y1="${top}" x2="${x(p.age)}" y2="${h-bottom}" stroke="#cfb99a" stroke-dasharray="2 3"/><text x="${Math.min(w-60,Math.max(left,x(p.age)+5))}" y="11">${data.event} ${data.eventAge}歳</text>`; }
  svg += '</svg>'; $('chart').innerHTML = svg;
}
const observer = new ResizeObserver(() => { if (step === 3 && data) renderResult(); }); observer.observe($('chart'));
$('assumptions').addEventListener('click', () => $('info').showModal());
document.querySelectorAll('#info .close').forEach(b => b.addEventListener('click', () => $('info').close()));
$('info').addEventListener('click', e => { if (e.target === $('info')) { const r = $('info').getBoundingClientRect(); if (e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) $('info').close(); } });
document.querySelector('.steps .active').setAttribute('aria-current', 'step');
$('advice-button').addEventListener('click', () => $('advice-dialog').showModal());
document.querySelectorAll('#advice-dialog .close').forEach(b => b.addEventListener('click', () => $('advice-dialog').close()));
$('pdf-export').addEventListener('click', async () => {
  const button = $('pdf-export'); button.disabled = true; button.textContent = 'PDF作成中…'; clearError();
  try {
    await exportLifePlanPDF({ data: { ...data }, saving, sampleUsed, assumedPension });
  } catch (error) {
    console.error(error); $('error').textContent = 'PDFを作成できませんでした。もう一度お試しください。';
  } finally { button.disabled = false; button.textContent = 'PDF出力 ↓'; }
});
const keyboardControls = document.createElement('div');
const retirementSource = document.createElement('dialog');
retirementSource.id = 'retirement-source-dialog';
retirementSource.innerHTML = '<div class="dialog-heading"><h2>退職金の参考平均</h2><button class="close" aria-label="閉じる">×</button></div><p><strong>1,623万円</strong>（退職一時金制度のみ）</p><p>厚生労働省「令和5年就労条件総合調査」第23表。令和4年中に退職した、勤続20年以上・45歳以上の定年退職者のうち、大学・大学院卒（管理・事務・技術職）が対象です。</p><p>すべての人の平均や、手取り額の平均ではありません。企業規模・勤続年数・退職理由などで異なります。入力欄には、勤務先などで確認した手取りの一時金予定額を入力してください。</p><p><a href="https://www.mhlw.go.jp/toukei/itiran/roudou/jikan/syurou/23/dl/gaiyou04.pdf#page=3" target="_blank" rel="noopener noreferrer">厚生労働省の統計を見る（PDF） ↗</a></p><button class="primary close">閉じる</button>';
document.body.append(retirementSource);
$('retirement-source').addEventListener('click', e => { e.preventDefault(); retirementSource.showModal(); });
retirementSource.querySelectorAll('.close').forEach(b => b.addEventListener('click', () => retirementSource.close()));
keyboardControls.className = 'keyboard-controls';
keyboardControls.innerHTML = '<button type="button" data-direction="-1">前の項目</button><button type="button" data-direction="1">次の項目</button><button type="button" data-direction="0">完了</button>';
form.append(keyboardControls);
let focusedInput = null;
function updateKeyboard() {
  const viewport = window.visualViewport;
  const active = innerWidth <= 760 && viewport && viewport.height < innerHeight * .75 && focusedInput === document.activeElement;
  document.body.classList.toggle('keyboard', Boolean(active));
  document.documentElement.style.setProperty('--visible-height', `${viewport?.height || innerHeight}px`);
}
form.addEventListener('focusin', e => {
  if (e.target.tagName !== 'INPUT' || !e.target.closest('.field')) return;
  focusedInput = e.target;
  document.querySelectorAll('.field.focused').forEach(el => el.classList.remove('focused'));
  focusedInput.closest('.field').classList.add('focused'); updateKeyboard();
});
form.addEventListener('focusout', () => requestAnimationFrame(updateKeyboard));
window.visualViewport?.addEventListener('resize', updateKeyboard);
keyboardControls.addEventListener('pointerdown', e => e.preventDefault());
keyboardControls.addEventListener('click', e => {
  const button = e.target.closest('button'); if (!button || !focusedInput) return;
  const direction = Number(button.dataset.direction);
  if (!direction) { focusedInput.blur(); document.body.classList.remove('keyboard'); return; }
  const inputs = [...$(`screen-${step}`).querySelectorAll('input')].filter(el => !el.closest('[hidden]'));
  const index = inputs.indexOf(focusedInput); inputs[Math.max(0, Math.min(inputs.length - 1, index + direction))].focus();
});
