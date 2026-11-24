import {PAIRS_PER_SESSION, selectPairs, summary} from './core.mjs';

const route = new URLSearchParams(location.search).get('route') === 'prolific' ? 'prolific' : 'social';
const screen = document.getElementById('screen');
const notice = document.getElementById('notice');
const langButton = document.getElementById('lang');
const copy = {
  en: {
    notice: 'REVIEW PREVIEW ONLY · Proposed 50-pair candidate bank, 15 pairs per session. No study answers are stored or sent. Images, payment and platform paths are not approved. Do not recruit.',
    eligibility: 'Eligibility check', socialEligibility: 'Please confirm both statements to view the consent preview.', age: 'I am 18 or older.', us: 'I currently live in the United States.', prolificEligibility: 'Prolific branch simulation: enter an age and current country. Actual prescreener wording and return paths require platform setup.', country: 'Current country (type US for this simulation)', continue: 'Continue', ineligible: 'This route is not eligible for the proposed adult U.S. study. No research session was created.', mismatch: 'Your answers do not match the eligibility information used for this invitation. In the final platform setup, follow the link back to Prolific to request a return. This local preview has no return URL.',
    consent: 'Study information and consent preview', consentText: 'Proposed study: adults living in the United States would view 15 of 50 fixed painting pairs, choose a preferred painting or skip each pair, answer five background questions with a “prefer not to answer” option, and only then view AI feedback. There is no camera, microphone or eye tracking. Participation is voluntary; some images may be uncomfortable. Coded responses may be disclosed or linked despite safeguards. The proposed Prolific reward is $3 for a completed session; the social route is unpaid. Leaving stops new answers, while deleting previously submitted answers would require a separate request. The actual payment exceptions, data retention, server deletion and Prolific return paths remain under review. Proposed adult PI: Juan Wang, juanwanglc@gmail.com. Student investigator: Chenglin Liu (project name: Vincent Liu), vincentliu0111@gmail.com. Participant-rights questions: CSSRA, admin@colossra.org. This preview does not enroll anyone or store answers.', agree: 'I understand this is a no-storage preview, confirm I am an adult living in the United States, and choose to continue the demonstration.', start: 'Continue preview', decline: 'Do not join', noConsent: 'You did not agree to continue this preview. No research session was created. For a real Prolific study, a separate no-consent return-request path would be used; this preview has no platform integration.',
    instruction: 'Instruction check', instructionQ: 'If you do not want to choose either painting, what should you do?', skip: 'Skip this pair', random: 'Choose at random', close: 'Close the browser', retry: 'Please review the instructions and try again.', next: 'Next', choose: 'Choose', pair: 'Pair', of: 'of', exit: 'Exit preview', exited: 'You left the preview. No answer was sent or saved.',
    question: 'Background question', prefer: 'Prefer not to answer', finish: 'Finish preview', result: 'Preview result', noResult: 'No valid AI comparison is available in this internal preview. No agreement percentage is calculated.', skippedAll: 'All 15 painting pairs were skipped. That is allowed; no agreement percentage can be calculated.', done: 'The preview is complete. No Prolific completion code or payment is issued here.', delete: 'Clear this preview', cleared: 'The in-memory preview answers were cleared. No server data existed.', newRun: 'Restart preview'
  },
  zh: {
    notice: '仅供审查测试 · 拟从 50 对候选画中每人展示 15 对。不保存或发送研究答案。图片、付款与平台路径尚未获准，不能用于招募。',
    eligibility: '资格核对', socialEligibility: '请确认两项，再查看同意说明测试页。', age: '我已满 18 岁。', us: '我目前居住在美国。', prolificEligibility: 'Prolific 路径模拟：请输入年龄及目前居住国家。正式筛选题原文和退回路径仍需在平台配置。', country: '当前居住国家（模拟时填 US）', continue: '继续', ineligible: '不符合拟议的美国成年人研究资格。没有创建研究会话。', mismatch: '你的回答与本次邀请采用的资格信息不一致。正式平台中会提供返回 Prolific 请求退回的链接；这个本地测试版没有退回网址。',
    consent: '研究说明与同意测试页', consentText: '拟议研究仅面向现居美国的成年人。参加者将看到固定 50 对候选画中的 15 对，每对可选一幅或跳过；之后回答五道可选“不愿回答”的背景题，最后才查看 AI 对照。不会使用摄像头、麦克风或眼动追踪。参加自愿，部分画作可能令人不适；编码答案仍有泄露或被关联的风险。Prolific 完成报酬拟为 3 美元，社交媒体渠道无报酬。退出会停止新答案；删除已提交答案须另行请求。异常付款、保存期限、服务器删除与 Prolific 退回路径仍在审核。拟任成年 PI：Juan Wang，juanwanglc@gmail.com。学生研究者：Chenglin Liu（项目名 Vincent Liu），vincentliu0111@gmail.com。参加者权利问题：CSSRA，admin@colossra.org。此页仅演示流程，不招募或保存答案。', agree: '我明白这是不保存数据的测试页，确认已满 18 岁且现居美国，选择继续查看演示。', start: '继续测试', decline: '不参加', noConsent: '你没有同意继续测试，也没有创建研究会话。正式 Prolific 研究应使用单独的不同意退回路径；此测试版没有平台集成。',
    instruction: '操作理解检查', instructionQ: '如果不想在两幅画之间做选择，该怎么办？', skip: '跳过这一对', random: '随机选择', close: '关闭浏览器', retry: '请重新阅读说明后再试。', next: '下一步', choose: '选择', pair: '第', of: '对，共 15 对', exit: '退出测试', exited: '你已退出测试；没有答案被发送或保存。',
    question: '背景问题', prefer: '不愿回答', finish: '完成测试', result: '测试结果', noResult: '内部测试版没有可用的正式 AI 对照，因此不计算一致百分比。', skippedAll: '15 对画全部跳过是允许的；没有可计算的一致百分比。', done: '测试流程完成。这里没有 Prolific 完成码，也不会发放报酬。', delete: '清除本次测试', cleared: '内存中的测试答案已清除；不存在服务器数据。', newRun: '重新开始'
  }
};
const questions = [
  {en:'What is your age range?',zh:'你的年龄范围是？',enOptions:['18–24','25–34','35–44','45–54','55–64','65 or older'],zhOptions:['18–24 岁','25–34 岁','35–44 岁','45–54 岁','55–64 岁','65 岁及以上']},
  {en:'Which broad U.S. region do you live in?',zh:'你居住在美国哪个大区？',enOptions:['Northeast','Midwest','South','West','Not sure'],zhOptions:['东北部','中西部','南部','西部','不确定']},
  {en:'What is the highest level of education you have completed?',zh:'你已完成的最高学历是？',enOptions:['High school or below','Some college or an associate degree',"Bachelor's degree",'Graduate degree'],zhOptions:['高中及以下','部分大学学习或专科学位','本科学位','研究生学位']},
  {en:'How often do you visit art museums or galleries?',zh:'你多久去一次美术馆或画廊？',enOptions:['Rarely or never','About once a year','Several times a year','Monthly or more'],zhOptions:['很少或从不','大约一年一次','一年几次','每月一次或更多']},
  {en:'Have you had formal training in art?',zh:'你是否受过正规的美术训练？',enOptions:['None','Some classes','An art degree or professional work in art'],zhOptions:['没有','上过一些美术课','有美术专业学位或从事艺术相关工作']}
];
let lang = 'en', stage = 'eligibility', pairs = [], deck = [], choices = [], answers = [], pos = 0, qpos = 0, error = '';
const t = key => copy[lang][key];
const button = (label, fn, cls='action') => { const b=document.createElement('button'); b.type='button'; b.className=cls; b.textContent=label; b.addEventListener('click',fn); return b; };
const element = (tag, content, className) => { const el=document.createElement(tag); if(content!=null) el.textContent=content; if(className) el.className=className; return el; };
const actions = (...buttons) => { const d=element('div',null,'actions'); d.append(...buttons); screen.append(d); };
const check = (id,label) => { const l=element('label'); const i=document.createElement('input'); i.type='checkbox'; i.id=id; l.append(i,document.createTextNode(' '+label)); screen.append(l); return i; };
function reset(){ stage='eligibility'; deck=[]; choices=[]; answers=[]; pos=0; qpos=0; error=''; render(); }
function exitPreview(){ deck=[]; choices=[]; answers=[]; pos=0; qpos=0; error=''; stage='exited'; render(); }
function render(){
  document.documentElement.lang=lang==='zh'?'zh-CN':'en'; notice.textContent=t('notice'); screen.replaceChildren();
  if(stage==='eligibility'){
    screen.append(element('h1',t('eligibility')),element('p',route==='prolific'?t('prolificEligibility'):t('socialEligibility')));
    if(route==='social'){
      const a=check('age',t('age')),u=check('us',t('us'));
      actions(button(t('continue'),()=>{if(a.checked&&u.checked){stage='consent';render()}else{stage='ineligible';render()}}));
    }else{
      const l=element('label',lang==='zh'?'年龄':'Age'); const age=document.createElement('input'); age.type='number'; age.min='0'; age.max='120'; l.append(age); screen.append(l);
      const c=element('label',t('country')); const country=document.createElement('input'); c.append(country); screen.append(c);
      actions(button(t('continue'),()=>{stage=Number(age.value)>=18&&country.value.trim().toUpperCase()==='US'?'consent':'mismatch';render()}));
    }
  } else if(stage==='consent'){
    screen.append(element('h1',t('consent')),element('p',t('consentText')));
    const yes=check('agree',t('agree'));
    actions(button(t('start'),()=>{if(yes.checked){deck=selectPairs(pairs);stage='instruction';error='';render()}}),button(t('decline'),()=>{stage='noConsent';render()},'action secondary'));
  } else if(stage==='instruction'){
    screen.append(element('h1',t('instruction')),element('p',t('instructionQ')));
    const f=element('fieldset',null,'question');
    for(const value of ['skip','random','close']){ const l=element('label');const i=document.createElement('input');i.type='radio';i.name='instruction';i.value=value;l.append(i,document.createTextNode(' '+t(value)));f.append(l); }
    screen.append(f); if(error) screen.append(element('p',t('retry'),'meta'));
    actions(button(t('continue'),()=>{const v=screen.querySelector('input[name="instruction"]:checked')?.value;if(v==='skip'){stage='pair';error='';render()}else{error='retry';render()}}),button(t('exit'),exitPreview,'action danger'));
  } else if(stage==='pair'){
    const x=deck[pos]; screen.append(element('h1',lang==='zh'?`${t('pair')} ${pos+1} ${t('of')}`:`${t('pair')} ${pos+1} ${t('of')} ${PAIRS_PER_SESSION}`));
    const grid=element('div',null,'pair-grid');
    for(const side of ['left','right']){const id=side==='left'?(x.flipped?x.b:x.a):(x.flipped?x.a:x.b);const art=element('div',null,'art');const img=document.createElement('img');img.src=`../met-art/${id}.jpg`;img.alt=side==='left'?'Left artwork':'Right artwork';const title=element('div',side==='left'?(x.flipped?x.b_title:x.a_title):(x.flipped?x.a_title:x.b_title));const zoom=document.createElement('a');zoom.href=img.src;zoom.target='_blank';zoom.rel='noopener';zoom.setAttribute('aria-label',(lang==='zh'?'放大画作：':'Enlarge artwork: ')+title.textContent);zoom.append(img);art.append(zoom,title);grid.append(art);} screen.append(grid);
    const choose = choice => { choices.push({pair_id:x.pair_id,choice});pos++;stage=pos===PAIRS_PER_SESSION?'question':'pair';render(); };
    actions(button(lang==='zh'?'选左边':'Choose left',()=>choose(x.flipped?'b':'a')),button(lang==='zh'?'选右边':'Choose right',()=>choose(x.flipped?'a':'b')),button(t('skip'),()=>choose('skip'),'action secondary'),button(t('exit'),exitPreview,'action danger'));
  } else if(stage==='question'){
    const q=questions[qpos]; screen.append(element('h1',`${t('question')} ${qpos+1} / 5`),element('p',q[lang]));
    const f=element('fieldset',null,'question');const opts=[...(lang==='zh'?q.zhOptions:q.enOptions),t('prefer')];
    opts.forEach((label,i)=>{const l=element('label');const input=document.createElement('input');input.type='radio';input.name='q';input.value=String(i);l.append(input,document.createTextNode(' '+label));f.append(l)});screen.append(f);
    actions(button(qpos===4?t('finish'):t('next'),()=>{const v=screen.querySelector('input[name="q"]:checked');if(!v)return;answers.push(Number(v.value));qpos++;stage=qpos===5?'result':'question';render()}),button(t('exit'),exitPreview,'action danger'));
  } else if(stage==='result'){
    const s=summary(choices);screen.append(element('h1',t('result')),element('p',choices.every(x=>x.choice==='skip')?t('skippedAll'):t('noResult')),element('p',t('done')),element('p',`${choices.length} / ${PAIRS_PER_SESSION} ${lang==='zh'?'画对已在本页内存中处理':'pairs handled in page memory'}`,'meta'));
    if(s.percent!==null) throw new Error('Preview must not show an unapproved AI result');
    actions(button(t('delete'),()=>{choices=[];answers=[];deck=[];stage='cleared';render()},'action danger'),button(t('newRun'),reset,'action secondary'));
  } else { const msg=stage==='cleared'?t('cleared'):t(stage); screen.append(element('h1',msg)); actions(button(t('newRun'),reset)); }
}
langButton.addEventListener('click',()=>{lang=lang==='en'?'zh':'en';render()});
fetch('./pairs.json').then(r=>{if(!r.ok)throw Error('pairs unavailable');return r.json()}).then(data=>{pairs=data;render()}).catch(e=>{screen.textContent=`Preview data error: ${e.message}`});
