'use strict';
async function exportLifePlanPDF({ data, saving, sampleUsed, assumedPension }) {
  await document.fonts.ready;
  const base = LifePlan.simulate(data), result = LifePlan.simulate(data, saving);
  const assessment = LifePlan.assess(result), advice = LifePlan.advice(result);
  const canvas = document.createElement('canvas');
  const W = 595.28, H = 841.89, scale = 3;
  canvas.width = Math.ceil(W * scale); canvas.height = Math.ceil(H * scale);
  const ctx = canvas.getContext('2d'); ctx.scale(scale, scale);
  const colors = { ink: '#263d35', muted: '#687769', green: '#194e43', line: '#dce4d9', orange: '#bd8049' };
  const fmt = n => new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 }).format(n);
  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x,y,w,h); }
  function text(value,x,y,size=10,color=colors.ink,weight=400) { ctx.font = `${weight} ${size}px "Yu Gothic UI", "Meiryo", sans-serif`; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(value),x,y); }
  function line(x1,y1,x2,y2,color=colors.line,width=.6) { ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke(); }
  function wrap(value,x,y,width,size=10,color=colors.ink,weight=400,leading=14) {
    ctx.font=`${weight} ${size}px "Yu Gothic UI", "Meiryo", sans-serif`;
    let row='';
    for (const ch of value) {
      if(ch==='\n'||(ctx.measureText(row+ch).width>width&&!/[。、，．！？）」』】]/.test(ch))) {text(row,x,y,size,color,weight);row='';y+=leading;if(ch==='\n')continue;}
      row+=ch;
    }
    if(row)text(row,x,y,size,color,weight);
    return y+leading;
  }
  function fit(value,x,y,width,size,color=colors.ink,weight=500) {
    ctx.font=`${weight} ${size}px "Yu Gothic UI", "Meiryo", sans-serif`;
    const ratio=Math.min(1,width/Math.max(1,ctx.measureText(value).width));text(value,x,y,size*ratio,color,weight);
  }
  const now = new Date();
  const date = now.toLocaleDateString('ja-JP');
  rect(0,0,W,H,'#fffefa');
  text('みらいのお金  /  LIFE PLAN',36,34,11,colors.green,700);
  text('ライフプラン シミュレーション結果',36,65,21,colors.green,600);
  text(`作成日：${date}  |  ${saving ? `毎月${saving}万円の支出を見直した条件` : 'いまの条件'}${sampleUsed?'  |  サンプル入力':''}`,36,82,8.5,colors.muted);

  const theme = assessment.status==='bad' ? { bg:'#fff0eb',fg:'#9c3929' } : assessment.status==='caution' ? {bg:'#fff6e5',fg:'#89591d'} : {bg:'#eaf4e9',fg:'#22543b'};
  rect(36,94,523,75,theme.bg);
  text('判定（入力条件に基づく概算）',49,110,8.5,theme.fg);
  text(assessment.title,49,133,18,theme.fg,700);
  wrap(assessment.reason,49,151,493,9,theme.fg,400,12);

  text(`${data.retire}歳の${result.retirement<0?'累積不足額':'金融資産'}`,36,187,9,colors.muted);
  fit(`${fmt(Math.abs(result.retirement)/10000)} 万円`,36,211,225,24,colors.green);
  text(result.end<0?'90歳の累積不足額':'90歳時点の金融資産',310,187,9,colors.muted);
  fit(`${fmt(Math.abs(result.end)/10000)} 万円`,310,211,240,24,colors.green);
  if(saving) text(`見直しによる90歳時点の変化：＋${fmt((result.end-base.end)/10000)}万円`,36,230,9,colors.green,600);
  line(36,240,559,240);

  text('金融資産の推移',36,257,11,colors.green,700);
  text('単位：万円',132,257,8,colors.muted);
  text('━ いまの条件',367,257,8,colors.green);
  if(saving)text('━ 見直し後',460,257,8,colors.orange);
  const points=[...base.points,...result.points];
  const rawLow=Math.min(0,...points.map(p=>p.balance/10000));
  const rawHigh=Math.max(1,...points.map(p=>p.balance/10000));
  const rawStep=(rawHigh-rawLow)/4,unit=10**Math.floor(Math.log10(rawStep));
  const tick=[1,2,5,10].find(x=>x*unit>=rawStep)*unit;
  const low=Math.floor(rawLow/tick)*tick,high=Math.ceil(rawHigh/tick)*tick;
  const x=age=>91+(age-data.age)/(90-data.age)*455;
  const y=balance=>274+(high-balance/10000)/(high-low)*110;
  for(let v=low;v<=high;v+=tick) {line(91,y(v*10000),546,y(v*10000),v===0?'#93a38e':colors.line);text(fmt(v),36,y(v*10000)+3,8,colors.muted);}
  const draw = (list,color,dashed=false) => {ctx.beginPath();list.forEach((p,i)=>i?ctx.lineTo(x(p.age),y(p.balance)):ctx.moveTo(x(p.age),y(p.balance)));ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.setLineDash(dashed?[3,3]:[]);ctx.stroke();ctx.setLineDash([]);};
  draw(base.points,colors.green,saving>0);if(saving)draw(result.points,colors.orange);
  text(`${data.age}歳`,91,398,8,colors.muted);
  if(x(data.retire)>125&&x(data.retire)<515)text(`${data.retire}歳`,x(data.retire)-9,398,8,colors.muted);
  text('90歳',528,398,8,colors.muted);

  text('入力条件',36,423,11,colors.green,700);
  const rows=[
    [`現在の年齢：${data.age}歳`,`仕事収入の終了：${data.retire}歳`],
    [`現在の貯蓄・投資：${fmt(data.assets)}万円`,`将来の収入合計：${fmt(data.pension)}万円 / 月${assumedPension?'（仮定）':''}`],
    [`現在の手取り月収：${fmt(data.income)}万円`,`退職金予定：${fmt(data.retirementPay)}万円（${data.retire}歳・手取り）`],
    [`現役の月支出：${fmt(data.spending)} → ${fmt(Math.max(0,data.spending-saving))}万円`,`終了後の月支出：${fmt(data.futureSpending)} → ${fmt(Math.max(0,data.futureSpending-saving))}万円`],
    [`追加支出：${data.event==='なし'?'なし':`${data.event}・${data.eventAge}歳に${fmt(data.eventAmount)}万円`}`,`支出の見直し：${saving?`毎月${saving}万円減（現在〜90歳）`:'なし'}`]
  ];
  rows.forEach((row,i)=>{const yy=434+i*18;if(i%2===0)rect(36,yy,523,18,'#f0f3ec');fit(row[0],43,yy+12,249,8.5);fit(row[1],309,yy+12,243,8.5);});

  text('この結果へのアドバイス',36,549,11,colors.green,700);
  let adviceY=570;
  advice.forEach((item,i)=>{
    text(String(i+1).padStart(2,'0'),36,adviceY,10,theme.fg,700);
    adviceY=wrap(item,59,adviceY,493,10,i===0?theme.fg:colors.ink,i===0?600:400,14)+9;
  });
  if(adviceY>722)throw new Error('Advice exceeds the single-page layout');
  line(36,727,559,727);
  text('計算の前提',36,744,8.5,colors.muted,700);
  wrap('運用・物価上昇・昇給は0%。退職金は指定した仕事収入終了年齢に手取り額を1回加算。年金とその他の月収は65歳から一定額で計上し、仕事収入との重複は除きます。家族別の受給時期や年金の支給調整は扱いません。',36,758,523,7.5,colors.muted,400,11);
  wrap('マイナス残高は累積の必要資金です。本結果・アドバイスは概算であり、将来を保証するものではありません。入力情報はこの端末内で計算しています。',36,794,495,7.5,colors.muted,400,11);
  text('1 / 1',538,819,8,colors.muted);

  const pdf = await PDFLib.PDFDocument.create();
  pdf.setTitle('Life Plan Simulation');pdf.setProducer('Mirai Life Plan');pdf.setCreationDate(now);
  const page=pdf.addPage([W,H]);
  const png=await pdf.embedPng(canvas.toDataURL('image/png'));
  page.drawImage(png,{x:0,y:0,width:W,height:H});
  const bytes=await pdf.save();
  const blob=new Blob([bytes],{type:'application/pdf'}), url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`ライフプラン結果_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${saving?`_月${saving}万円見直し`:''}.pdf`;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
