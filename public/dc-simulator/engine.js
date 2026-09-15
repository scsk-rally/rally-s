(function(root){
'use strict';
const grades=[{name:'理事／GM・基幹6〜7等級／基幹4〜5等級',company:14000,max:17000},{name:'基幹3等級',company:12500,max:18500},{name:'基幹1〜2等級／総合職',company:11000,max:20000}];
function fv(balance,monthly,rate,months){const r=Math.pow(1+rate/100,1/12)-1; return Math.abs(r)<1e-12?balance+monthly*months:balance*Math.pow(1+r,months)+monthly*Math.expm1(months*Math.log1p(r))/r;}
function validate(s){
const errors=[]; const num=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
if(!Number.isInteger(s.grade)||!grades[s.grade])errors.push('等級を選んでください。');
if(!num(s.age,18,74)||!Number.isInteger(s.age)||!num(s.end,19,75)||!Number.isInteger(s.end)||s.end<=s.age)errors.push('現在の年齢より後の試算終了年齢を入力してください（最大75歳）。');
if(!num(s.balance,0,1000000000))errors.push('現在のDC残高は0〜10億円で入力してください。');
if(!num(s.currentRate,-20,20))errors.push('現在の想定年率は−20〜20%で入力してください。');
for(const key of ['current','planned'])if(!num(s[key],0,grades[s.grade]?.max)||s[key]%500!==0)errors.push('本人掛金は等級別の上限以内・500円単位で指定してください。');
if(s.planned<s.current)errors.push('追加額を試すため、変更後の掛金は現在の掛金以上にしてください。');
if(s.rows.length&&Math.abs(s.rows.reduce((a,r)=>a+r.weight,0)-100)>1e-7)errors.push('商品の配分を合計100%にしてください。');
if(s.rows.some(r=>!num(r.weight,0,100)||!Number.isInteger(r.weight)||!num(r.rate,-20,20)))errors.push('配分は0〜100%の整数、試算年率は−20〜20%で入力してください。');
return [...new Set(errors)];
}
function calculate(s){const errors=validate(s);if(errors.length)throw Error(errors.join(' ')); const g=grades[s.grade],months=(s.end-s.age)*12;
const baseAt=m=>fv(s.balance,g.company+s.current,s.currentRate,m);
const matchingAt=m=>fv(s.balance,g.company+s.planned,s.currentRate,m);
const selectedAt=(m,stress=false)=>baseAt(m)+(s.rows.length?s.rows.reduce((sum,p)=>sum+fv(0,(s.planned-s.current)*p.weight/100,stress&&!p.protected?-2:p.rate,m),0):fv(0,s.planned-s.current,s.currentRate,m));
const base=baseAt(months),matching=matchingAt(months),product=base,combined=selectedAt(months);
return {base,matching,product,combined,stress:selectedAt(months,true),months,principal:s.balance+(g.company+s.planned)*months,extraPrincipal:(s.planned-s.current)*months,matchingDifference:matching-base,investmentDifference:combined-matching,difference:combined-base,series:Array.from({length:s.end-s.age+1},(_,i)=>({age:s.age+i,base:baseAt(i*12),combined:selectedAt(i*12)}))};
}
root.DCEngine={grades,fv,validate,calculate};if(typeof module!=='undefined')module.exports=root.DCEngine;
})(typeof window!=='undefined'?window:globalThis);
