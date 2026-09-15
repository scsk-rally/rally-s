(function (root) {
  'use strict';
  function simulate(p, saving = 0) {
    let balance = Math.round(p.assets * 10000);
    const points = [{ age: p.age, balance }];
    for (let age = p.age; age < 90; age++) {
      const working = age < p.retire;
      // The pension field is the total of pension and other recurring take-home
      // income from age 65. It excludes the employment income entered in step 1.
      const income = (working ? p.income : 0) + (age >= 65 ? p.pension : 0);
      const spending = Math.max(0, (working ? p.spending : p.futureSpending) - saving);
      balance += Math.round(income * 10000) * 12 - Math.round(spending * 10000) * 12;
      if (p.event !== 'なし' && age === p.eventAge) balance -= Math.round(p.eventAmount * 10000);
      if (age + 1 === p.retire) balance += Math.round((p.retirementPay ?? 0) * 10000);
      points.push({ age: age + 1, balance });
    }
    return { points, retirement: points.find(x => x.age === p.retire).balance, end: balance, shortage: points.find(x => x.balance < 0)?.age ?? null };
  }
  function assess(result) {
    if (result.shortage !== null) return { status: 'bad', title: '資金不足の見込み・見直しが必要', reason: `${result.shortage}歳時点で不足の見込み。至急、ファイナンシャルプランナーに相談してください。` };
    const zero = result.points.slice(1).find(p => p.balance === 0);
    if (zero) return { status: 'caution', title: '残高がゼロに・余裕に注意', reason: `${zero.age}歳時点で残高がゼロ。予備費を確保できるか見直しましょう。` };
    return { status: 'good', title: '90歳まで資金が持つ見通し', reason: '試算期間中に不足なし。90歳まで残高がプラスで推移する見込みです。' };
  }
  function advice(result) {
    const status = assess(result).status;
    if (status === 'bad') return [
      '至急、ファイナンシャルプランナーに相談してください。収入・支出・資産の資料と、この結果を持参しましょう。',
      `${result.shortage}歳時点の資金不足に向け、住居費・固定費など毎月の支出と、大きな出費の金額・時期を見直しましょう。`,
      '将来の年金・その他の収入を確認し、働く期間も含めて再試算しましょう。高い運用益を前提に不足を埋めないことが大切です。'
    ];
    if (status === 'caution') return [
      '残高がゼロになる時期があります。急な医療費や修繕費に備えた予備費を確保できるか、見直しましょう。',
      'スライダーや金額入力で毎月の支出見直しを試し、無理なく続けられる家計の改善を考えましょう。',
      'ファイナンシャルプランナーに相談し、物価上昇や家族ごとの退職時期も含めた詳しい計画を確認しましょう。'
    ];
    return [
      'この条件では90歳まで資金を維持できます。予定外の出費に備え、すぐに使える予備費も確保しましょう。',
      '年1回、または転職・住まい・家族構成が変わったときに、実際の収入と支出で更新しましょう。',
      '今回は物価上昇を含まない概算です。退職金の見込額も勤務先に確認し、ファイナンシャルプランナーと詳しい将来の計画を確認しましょう。'
    ];
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { simulate, assess, advice };
  else root.LifePlan = { simulate, assess, advice };
})(globalThis);
