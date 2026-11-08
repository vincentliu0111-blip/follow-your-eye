const targets = {
  en: ['agreementAi', 'agreementRepeat', 'agreementPeople'],
  zh: ['agreementAiZh', 'agreementRepeatZh', 'agreementPeopleZh'],
};
const percent = value => Math.round(value * 100);
const number = value => value === null ? '—' : value.toFixed(2);
const reading = (value, locale) => {
  if (value === null) return locale === 'zh' ? '无法计算' : 'unavailable';
  const index = value < 0 ? 0 : value <= .20 ? 1 : value <= .40 ? 2 : value <= .60 ? 3 : value <= .80 ? 4 : 5;
  return (locale === 'zh'
    ? ['低于碰巧一致', '轻微', '一般', '中等', '较高', '很高']
    : ['below chance', 'slight', 'fair', 'moderate', 'substantial', 'very high'])[index];
};

async function showAgreement() {
  const response = await fetch('agreement_stats.json?v=20261014-v1');
  if (!response.ok) throw new Error('Agreement snapshot unavailable');
  const data = await response.json();
  const calibration = Object.values(data.ai.calibration);
  const repeat = calibration.map(item => percent(item.repeatRate));
  const swapped = calibration.map(item => percent(item.swappedRate));
  const values = {
    en: [
      `Six AI judges: Fleiss’ κ ${number(data.ai.fleiss.kappa)} across ${data.ai.fleiss.nPairs.toLocaleString('en-US')} evaluated pairs — ${reading(data.ai.fleiss.kappa, 'en')} agreement.`,
      `Asked again on the same pair, each judge kept the same artwork ${Math.min(...repeat)}–${Math.max(...repeat)}% of the time. After left and right were swapped, that fell to ${Math.min(...swapped)}–${Math.max(...swapped)}%.`,
    ],
    zh: [
      `六位 AI 裁判：在 ${data.ai.fleiss.nPairs.toLocaleString('zh-CN')} 组已评测画对上，Fleiss’ κ 为 ${number(data.ai.fleiss.kappa)}，按常用读法属于${reading(data.ai.fleiss.kappa, 'zh')}一致。`,
      `同一位裁判再选一次，${Math.min(...repeat)}–${Math.max(...repeat)}% 仍选同一幅；左右位置对调后，保留原选择的比例降为 ${Math.min(...swapped)}–${Math.max(...swapped)}%。`,
    ],
  };
  for (const locale of Object.keys(targets)) {
    targets[locale].slice(0,2).forEach((id, index) => {
      document.getElementById(id).textContent = values[locale][index];
    });
  }

}

async function showLiveCount() {
  const configResponse = await fetch('collection_config.json');
  if (!configResponse.ok) throw new Error('Collection endpoint unavailable');
  const config = await configResponse.json();
  const response = await fetch(`${config.endpoint}/experience/choice-count`, {cache:'no-store'});
  if (!response.ok) throw new Error('Choice count unavailable');
  const data = await response.json();
  if (data.ok !== true || !Number.isSafeInteger(data.choices) || data.choices < 0)
    throw new Error('Invalid choice count');
  document.getElementById('agreementLive').textContent =
    `Eligible formal-study choices: ${data.choices.toLocaleString('en-US')} non-skip choices (live database count; not distinct visitors).`;
  document.getElementById('agreementLiveZh').textContent =
    `符合正式研究纳入规则：${data.choices.toLocaleString('zh-CN')} 次非跳过选择（实时数据库计数，不是独立访客人数）。`;
}

function refreshLiveCount() {
  if (document.visibilityState === 'hidden') return;
  showLiveCount().catch(() => {
    document.getElementById('agreementLive').textContent = 'Current saved-choice count is temporarily unavailable.';
    document.getElementById('agreementLiveZh').textContent = '当前已保存选择数暂时无法读取。';
  });
}

showAgreement().catch(() => {
  document.getElementById('agreementAi').textContent = 'The agreement snapshot is temporarily unavailable.';
  document.getElementById('agreementAiZh').textContent = '一致性统计快照暂时无法加载。';
});
refreshLiveCount();
setInterval(refreshLiveCount, 30000);
document.addEventListener('visibilitychange', refreshLiveCount);
