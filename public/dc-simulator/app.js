'use strict';
const $=id=>document.getElementById(id);
const man=value=>(value/10000).toLocaleString('ja-JP',{minimumFractionDigits:1,maximumFractionDigits:1});
const grades={high:{company:14000,max:17000},middle:{company:12500,max:18500},standard:{company:11000,max:20000}};
const principalProducts=new Set(['三井住友信託DC変動定期5年','三井住友銀行の確定拠出年金定期預金（5年）','三菱UFJ銀行 確定拠出年金専用5年定期預金','ニッセイ利率保証年金（5年保証／日々設定）','ニッセイ利率保証年金（10年保証／日々設定）']);
const productRates={
 'DC日本債券インデックスL':-0.9,'三井住友・DC外国債券インデックスファンドS':3.4,'DC新興国債券インデックスオープン':5.2,
 '三菱UFJDC国内株式インデックスファンド':8,'ニッセイ日本株ファンド':8,'三井住友・DC外国株式インデックスファンドS':8,
 'DC米国株式インデックス・オープン（S&P500）':8,'ハリス・グローバル・バリュー株':8,'フィデリティ・グローバル・ファンド':8,'DC新興国株式インデックスオープン':8,
 'DCマイセレクションS25':2.8,'DCマイセレクションS50':6,'DCマイセレクションS75':8,'DC世界経済インデックスファンド':8,
 'DCターゲットイヤーファンド（6資産運用継続型）2030':7.8,'DCターゲットイヤーファンド（6資産運用継続型）2040':8,'DCターゲットイヤーファンド（6資産運用継続型）2050':8,'DCターゲットイヤーファンド（6資産運用継続型）2060':8,
 'DCターゲット・イヤーファンド2025':1,'DCターゲット・イヤーファンド2035':3.7,'DCターゲット・イヤーファンド2045':5.6
};
function calculate(){
 const balance=Number($('balance').value)*10000,company=Number($('company').value),personal=Number($('additional').value),rate=Number($('rate').value),years=Number($('years').value),months=years*12;
 document.querySelectorAll('.year-options button').forEach(button=>button.classList.toggle('active',Number(button.dataset.years)===years));
 const valid=[balance,company,personal,rate,years].every(Number.isFinite)&&balance>=0&&company>=0&&personal>=0&&rate>=-20&&rate<=20;
 $('amountDisplay').textContent=personal.toLocaleString('ja-JP');$('resultYears').textContent=years;$('monthlyTotal').textContent=(company+personal).toLocaleString('ja-JP');
 if(!valid){for(const id of ['futureValue','matchingEffect','companyPrincipal','personalPrincipal','gain'])$(id).textContent='—';return;}
 const without=DCEngine.fv(balance,company,rate,months),future=DCEngine.fv(balance,company+personal,rate,months),effect=future-without;
 const companyPrincipal=company*months,personalPrincipal=personal*months,gain=future-balance-companyPrincipal-personalPrincipal;
 $('futureValue').textContent=man(future);$('matchingEffect').textContent=(effect>=0?'+':'−')+man(Math.abs(effect))+'万円';$('companyPrincipal').textContent=man(companyPrincipal)+'万円';$('personalPrincipal').textContent=man(personalPrincipal)+'万円';$('gain').textContent=(gain>=0?'+':'−')+man(Math.abs(gain))+'万円';
}
function setGrade(){const data=grades[$('grade').value];$('company').value=data.company;$('additional').max=data.max;if(Number($('additional').value)>data.max)$('additional').value=data.max;$('middleScale').textContent=(data.max/2).toLocaleString('ja-JP')+'円';$('maxScale').textContent='上限'+data.max.toLocaleString('ja-JP')+'円';calculate();}
function setProduct(){const selected=$('product').value,warning=$('productWarning');$('selectedProduct').textContent=selected||'商品未選択';warning.hidden=true;
 if(!selected){$('productHint').textContent='商品を選ぶと、過去実績を参考にした試算用年率を自動入力します。';$('rateSource').textContent='未選択時の仮定値。この年率を現在残高・会社掛金・マッチング拠出のすべてに適用します。';calculate();return;}
 const principal=principalProducts.has(selected),rate=principal?0:productRates[selected];$('rate').value=rate;
 if(principal){warning.textContent='元本確保型は元本が減らない一方、この試算では増えもしない年率0%として計算します。';warning.hidden=false;$('productHint').textContent='元本確保型を選択中';}
 else $('productHint').textContent='過去の長期実績を参考にした試算用年率 '+rate.toFixed(1)+'% を反映しました。';
 $('rateSource').textContent='商品資料の長期実績を優先し、長期試算向けに上限8%へ丸めた参考値です。現在残高・会社掛金・マッチング拠出のすべてに適用します。';calculate();
}
for(const id of ['balance','company','additional','rate','years']){ $(id).addEventListener('input',calculate);$(id).addEventListener('change',calculate); }
const yearButtons=document.querySelectorAll('.year-options button');yearButtons.forEach(button=>button.addEventListener('click',()=>{$('years').value=button.dataset.years;calculate();}));
$('grade').addEventListener('change',setGrade);$('product').addEventListener('change',setProduct);setGrade();setProduct();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'read_matching_simulation',description:'画面に表示中の確定拠出年金試算条件と結果を読み取る。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({grade:$('grade').value,balanceYen:Number($('balance').value)*10000,companyMonthlyYen:Number($('company').value),matchingMonthlyYen:Number($('additional').value),product:$('product').value||null,assumedAnnualRatePercent:Number($('rate').value),years:Number($('years').value),futureValue:$('futureValue').textContent,matchingEffect:$('matchingEffect').textContent})})).catch(()=>{});}catch{}}
