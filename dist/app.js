import {readCharts,parse,analyze,demos,levels,searchSegments,isPracticeSegment,previewWindow,coverage,sortNames} from './core.js?v=mailab-2';
import {sampleTexts} from './samples.js';
import {createPreview} from './preview.js?v=mailab-2';
import {patterns,patternSources} from './patterns.js';
import {chartData,loadCharts,saveCharts,clearCharts} from './library.js';

const $ = id => document.getElementById(id);
const node = (tag,text) => {
 const element = document.createElement(tag);
 element.textContent = text;
 return element;
};
const time = seconds => seconds.toFixed(2) + ' 秒';
const families = [
 {title:'全部专项', value:'全部', caption:'ALL PATTERNS', icon:'ring', tone:'all', description:'浏览 12 及以上的已支持专项片段。纵连、交互已有基础规则，其他条目先整理清单。'},
 ...patterns.map(pattern => ({...pattern, title:pattern.value,
  caption:(pattern.supported ? '' : '待研究 · ') + pattern.caption,
  tone:pattern.supported ? (pattern.value === '纵连' ? 'jack' : 'trill') : 'planned'})),
];
const levelChoices = ['全部', ...levels].map(value => ({
 title:value === '全部' ? '12 及以上' : value, value, caption:value === '全部' ? 'ALL LEVELS' : 'LEVEL', tone:'level',
}));
const chartTypes = ['EASY','BASIC','ADVANCED','EXPERT','MASTER','Re:MASTER','UTAGE'];
const charts = [], segments = [], failures = [];
const chartKeys = new Set();
const pendingCharts = new Map();
let stage = 0, familyIndex = 0, levelIndex = 1, trackIndex = 0, reference = null;
let cardCount = 0, currentTrack = null;
let libraryBusy = true;
let resultLimit = 30, previewing = null;
const PAGE = 30;
const typeName = chart => chartTypes[Number(/^inote_([1-7])$/.exec(chart.difficulty)?.[1]) - 1] ?? chart.difficulty;
const preview = createPreview({canvas:$('preview-canvas'), scrub:$('preview-scrub'), playButton:$('preview-play'),
 speed:$('preview-speed'), clock:$('preview-clock'), phase:$('preview-phase')});
for (const [value,title] of Object.entries(sortNames)) {
 const option = node('option',title);
 option.value = value;
 $('f-sort').append(option);
}
$('f-sort').value = 'title';
function filters() {
 const number = id => Number($(id).value) || 0;
 return {minRate:number('f-rate'), maxRate:number('f-max-rate'), minCount:number('f-count'), rhythm:$('f-rhythm').value,
  spreads:[...$('f-spread').querySelectorAll('input:checked')].map(input => Number(input.value))};
}

function selectFamily(value) {
 familyIndex = families.findIndex(family => family.value === value);
 stage = 0;
 resultLimit = PAGE;
 trackIndex = 0;
 render();
}

const allOption = node('option','全部专项');
allOption.value = '全部';
$('family-choice').append(allOption);
for (const group of new Set(patterns.map(pattern => pattern.group))) {
 const options = node('optgroup','');
 options.label = group;
 const section = node('section','');
 section.append(node('h3',group));
 const list = node('ul','');
 for (const pattern of patterns.filter(pattern => pattern.group === group)) {
  const state = pattern.supported ? '基础规则' : '待研究';
  const option = node('option',pattern.value + ' · ' + state);
  option.value = pattern.value;
  options.append(option);
  const item = node('li','');
  const select = node('button',pattern.value);
  select.type = 'button';
  select.setAttribute('aria-label','选择配置 ' + pattern.value);
  select.onclick = () => {selectFamily(pattern.value); $('family-choice').focus();};
  item.append(select,node('span',state),node('p',pattern.description));
  if (pattern.aliases) item.append(node('small','相关叫法：' + pattern.aliases.join('、')));
  for (const key of pattern.sources) {
   const source = patternSources[key];
   const link = node('a',source.title + ' ↗');
   link.href = source.url;
   link.target = '_blank';
   link.rel = 'noopener noreferrer';
   item.append(link);
  }
  list.append(item);
 }
 $('family-choice').append(options);
 section.append(list);
 $('pattern-list').append(section);
}
$('pattern-count').textContent = patterns.length + ' 项';
$('family-choice').onchange = event => selectFamily(event.target.value);
for (const choice of levelChoices) {
 const button = node('button',choice.title);
 button.type = 'button';
 button.dataset.level = choice.value;
 button.setAttribute('aria-label',choice.value === '全部' ? '选择全部 12 及以上等级' : '选择等级 ' + choice.value);
 button.onclick = () => {
  levelIndex = levelChoices.indexOf(choice);
  stage = 1;
  resultLimit = PAGE;
  trackIndex = 0;
  render();
 };
 $('level-options').append(button);
 if (choice.value !== '全部') $('level').append(node('option',choice.value));
}

function ingest(items, errors = []) {
 if (!Array.isArray(items) || items.length > 100) throw Error('单次导入最多 100 张难度谱面');
 const records = [];
 let added = 0;
 for (const chart of items) {
  try {
   if (!chart || typeof chart.title !== 'string' || typeof chart.body !== 'string' || chart.body.length > 500000 ||
       (chart.difficulty !== undefined && typeof chart.difficulty !== 'string') ||
       !Number.isFinite(chart.offset ?? 0) || typeof chart.level !== 'string' || !/^(?:(?:[1-9]|1[0-5])(?:\+|\.\d+)?|未知)$/.test(chart.level)) {
    throw Error('谱面内容、偏移或等级无效');
   }
   const key = JSON.stringify(chartData(chart));
   if (chartKeys.has(key)) {
    records.push(chartData(chart));
    continue;
   }
   const parsed = parse(chart);
   segments.push(...analyze(parsed));
   charts.push(parsed);
   chartKeys.add(key);
   records.push(chartData(parsed));
   added++;
  } catch (error) {
   const label = (chart?.title ?? '未知曲目') + (chart?.difficulty ? ' / ' + typeName(chart) : '');
   errors.push(label + '：' + error.message);
   const failure = {title:String(chart?.title ?? '未知曲目'), difficulty:chart?.difficulty, level:typeof chart?.level === 'string' ? chart.level : '未知', reason:error.message};
   if (!failures.some(item => item.title === failure.title && item.difficulty === failure.difficulty && item.reason === failure.reason)) failures.push(failure);
  }
 }
 return {added, errors, records};
}

function jacket(element, card) {
 element.hidden = !card;
 if (!card) return;
 element.dataset.tone = card.tone;
 const art = node('span','');
 art.className = 'jacket-art';
 if (card.icon) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  const use = document.createElementNS(svg.namespaceURI,'use');
  svg.setAttribute('aria-hidden','true');
  use.setAttribute('href','#mark-' + card.icon);
  svg.append(use);
  art.append(svg);
 } else {
  art.append(node('b',card.level ?? card.title));
  if (!card.level) art.setAttribute('aria-hidden','true');
 }
 element.replaceChildren(art,node('small',card.caption),node('strong',card.title));
}

function render() {
 $('library').textContent = charts.length + ' 张谱面 · ' + segments.filter(isPracticeSegment).length + ' 个专项片段（12 及以上）。原创样例等级仅用于演示。';
 $('export').disabled = libraryBusy || !charts.length;
 $('reset-library').disabled = libraryBusy || !charts.length;
 const family = families[familyIndex];
 const level = levelChoices[levelIndex].value;
 const levelTitle = levelChoices[levelIndex].title;
 $('family-choice').value = family.value;
 for (const button of $('level-options').children) button.setAttribute('aria-pressed',String(button.dataset.level === level));
 $('family-description').textContent = family.description;
 $('family-state').textContent = family.value === '全部' ? '专项目录' : family.supported ? '基础规则可检索' : '待研究 · 暂无自动识别';
 const currentResult = searchSegments(segments,{family:family.value,level,strategy:$('strategy').value,reference,filters:filters(),sort:$('f-sort').value});
 renderResults(family,level,levelTitle,currentResult);
 renderCoverage();
 let cards = families, index = familyIndex;
 let summary = '', current = null;
 if (stage === 1) {
  cards = levelChoices;
  index = levelIndex;
 } else if (stage === 2) {
  const result = currentResult;
  cards = result.items.map(item => {
   const segment = item.segment;
   const type = Number(/^inote_([1-7])$/.exec(segment.chart.difficulty)?.[1]);
   return {...item, title:segment.chart.title, level:segment.chart.level,
    caption:chartTypes[type - 1] ?? segment.family, tone:'track-' + (type || 0)};
  });
  trackIndex = Math.min(trackIndex, Math.max(0,cards.length - 1));
  index = trackIndex;
  current = cards[index];
  summary = cards.length ? cards.length + ' 段 · ' + sortNames[$('f-sort').value] : '没有匹配片段。';
  if (!cards.length && !charts.length) summary = '练习库为空。请加载原创样例或导入谱面。';
  else if (!cards.length && level !== '全部' && !charts.some(chart => chart.level === level)) summary = '练习库里还没有 ' + level + ' 级谱面。';
  if (result.message) summary = result.message + ' ' + summary;
 }

 $('step-number').textContent = '0' + (stage + 1);
 $('step-title').textContent = ['选择配置','选择等级','选择片段'][stage];
 $('screen-hint').textContent = ['左右切换配置 · 按 NEXT 确认',family.title + ' · 选择目标等级',family.title + ' · ' + levelTitle + ' · 选择练习片段'][stage];
 $('status').textContent = summary;
 $('back').disabled = stage === 0;
 $('next').disabled = stage === 2 && !current;
 $('next').lastElementChild.textContent = ['选等级','检索','设为参考'][stage];
 $('next').firstElementChild.textContent = stage === 2 ? 'SELECT' : 'NEXT';
 $('previous').disabled = $('following').disabled = cards.length < 2;
 $('position').textContent = cards.length ? (index + 1) + ' / ' + cards.length : '0 / 0';
 const neighbor = direction => cards.length > 1 ? cards[(index + direction + cards.length) % cards.length] : null;
 jacket($('previous-card'),neighbor(-1));
 jacket($('current-card'),cards[index] ?? {title:family.value !== '全部' && !family.supported ? '待研究' : '暂无片段',caption:family.caption,icon:family.icon,tone:family.tone});
 jacket($('next-card'),cards.length === 2 ? null : neighbor(1));

 $('reference-panel').hidden = !current && !reference;
 $('clear').hidden = !reference;
 $('reference').textContent = reference ? '参考片段 · ' + reference.chart.title + ' / ' + reference.family + ' / ' + time(reference.start) : '当前片段';
 $('detail').replaceChildren();
 if (current) {
  const segment = current.segment;
  $('detail').append(node('p',segment.chart.title + ' · ' + segment.family + ' · ' + time(segment.start) + '–' + time(segment.end) + ' · 模型负荷 ' + segment.load.toFixed(1)));
  const preview = node('button','PREVIEW 定位预览');
  preview.type = 'button';
  preview.className = 'button compact';
  preview.onclick = () => openPreview(segment);
  $('detail').append(preview);
  if (current.sim !== null) $('detail').append(node('p','结构相似度 ' + Math.round(current.sim * 100) + '% · 参考负荷的 ' + current.ratio.toFixed(2) + ' 倍'));
 }
 const details = reference ?? current?.segment;
 if (details) {
  $('detail').append(node('p','密度 ' + details.density.toFixed(2) + ' Note/秒 · 持续 ' + time(details.duration) + ' · 干扰 ' + details.interference + ' Note · 上下文 ' + details.context.toFixed(1) + ' Note/秒'),
   node('pre',details.notes.map(note => time(note.t) + '  ' + note.raw).join('\n')));
 }
 cardCount = cards.length;
 currentTrack = current;
}

function emptyMessage(family,level,levelTitle,result) {
 if (!charts.length && !failures.length) return '练习库为空。请加载原创样例或导入谱面。';
 if (family.value !== '全部' && !family.supported) return family.value + ' 的识别器待研究：不生成命中，也不能据此判断谱面里没有该配置。';
 const atLevel = chart => level === '全部' ? Number.parseFloat(chart.level) >= 12 : chart.level === level;
 const failed = failures.filter(atLevel).length;
 const unknown = failed ? ' 另有 ' + failed + ' 张' + levelTitle + '谱面解析失败，是否含该配置未知。' : '';
 if (!charts.some(atLevel)) return (failed ? '' : '练习库里还没有 ' + levelTitle + ' 的谱面。') + unknown;
 if (result.filtered) return '有 ' + result.filtered + ' 段被局部条件排除，可放宽条件。' + unknown;
 return '已解析的 ' + levelTitle + ' 谱面中没有找到' + (family.value === '全部' ? '已支持的专项' : family.value) + '片段（仅限当前规则）。' + unknown;
}
function describe(segment) {
 const f = segment.features;
 const bar = Math.floor(segment.notes[0].beat / 4) + 1;
 return [f.count + ' 个 Note', '平均 ' + f.rate.toFixed(1) + ' 个/秒', '最短间隔 ' + Math.round(f.minGap * 1000) + ' ms',
  f.noteValue ? '约 ' + f.noteValue + ' 分音' : '', f.even ? '等间隔' : '不等间隔', 'BPM ' + f.bpms.join('→'),
  '片段内其他 Note ' + segment.interference, '约第 ' + bar + ' 小节'].filter(Boolean).join(' · ');
}
function renderResults(family,level,levelTitle,result) {
 const list = $('result-list');
 list.replaceChildren();
 const total = result.items.length;
 const songs = new Set(result.items.map(item => item.segment.chart.title)).size;
 let summary = total ? total + ' 段命中 · 来自 ' + songs + ' 首曲目 · ' + family.title + ' · ' + levelTitle : emptyMessage(family,level,levelTitle,result);
 if (total && result.filtered) summary += ' · 局部条件排除 ' + result.filtered + ' 段';
 if (result.message) summary = result.message + ' ' + summary;
 $('results-summary').textContent = summary;
 for (const item of result.items.slice(0,resultLimit)) {
  const segment = item.segment, f = segment.features;
  const row = node('li','');
  row.className = 'result';
  row.dataset.id = segment.id;
  if (previewing === segment) row.setAttribute('aria-current','true');
  const head = node('p','');
  head.className = 'result-head';
  head.append(node('strong',segment.chart.title), node('span',typeName(segment.chart)), node('span','Lv ' + segment.chart.level));
  const what = node('p',segment.family + (f.spreadName && segment.family === '交互' ? ' · ' + f.spreadName : '') + ' · ' + segment.start.toFixed(2) + '–' + segment.end.toFixed(2) + ' 秒');
  what.className = 'result-what';
  const why = node('p','依据：' + f.evidence);
  const stats = node('p',describe(segment));
  stats.className = 'result-stats';
  const actions = node('div','');
  actions.className = 'result-actions';
  const open = node('button','Preview');
  open.type = 'button';
  open.className = 'button primary compact';
  open.setAttribute('aria-label','预览 ' + segment.chart.title + ' ' + typeName(segment.chart) + ' ' + segment.family + ' ' + segment.start.toFixed(2) + ' 秒');
  open.onclick = () => openPreview(segment);
  const pick = node('button',reference === segment ? '当前参考' : '设为参考');
  pick.type = 'button';
  pick.className = 'button compact';
  pick.disabled = reference === segment;
  pick.onclick = () => { reference = segment; trackIndex = 0; render(); };
  actions.append(open,pick);
  if (item.sim !== null) actions.append(node('small','相似度 ' + Math.round(item.sim * 100) + '% · 参考负荷 ' + item.ratio.toFixed(2) + ' 倍'));
  row.append(head,what,why,stats,actions);
  list.append(row);
 }
 $('more-results').hidden = total <= resultLimit;
 $('more-results').textContent = '显示更多（还有 ' + Math.max(0,total - resultLimit) + ' 段）';
 $('f-spread').disabled = !['交互','全部'].includes(family.value);
}
function openPreview(segment) {
 previewing = segment;
 const view = previewWindow(segment);
 $('preview-panel').hidden = false;
 $('preview-meta').textContent = segment.chart.title + ' · ' + typeName(segment.chart) + ' · Lv ' + segment.chart.level + ' · ' + segment.family;
 $('preview-range').textContent = segment.start.toFixed(2) + '–' + segment.end.toFixed(2) + ' 秒；播放 ' + Math.max(0,view.playStart).toFixed(2) + '–' + view.playEnd.toFixed(2) + ' 秒';
 const approx = view.notes.some(({note}) => note.kind === 'slide' && note.shape !== '-');
 $('preview-note').textContent = (view.crossing ? '含 ' + view.crossing + ' 个跨越目标边界的 Hold/Slide，已扩展播放范围。' : '') +
  (approx ? '弧形 / 折线类 Slide 轨迹为近似绘制。' : '') + '无音频。';
 const roles = {target:'目标', crossing:'跨边界', inside:'片段内其他', context:'前后文'};
 $('preview-notes').textContent = view.notes.map(({note,role}) => note.t.toFixed(3) + ' 秒  ' + note.raw.padEnd(10) + ' ' + roles[role]).join('\n');
 for (const row of $('result-list').children) row.toggleAttribute('aria-current', row.dataset.id === segment.id);
 preview.show(view);
 $('preview-panel').scrollIntoView({block:'nearest', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
 $('preview-panel').focus({preventScroll:true});
}
function renderCoverage() {
 const report = coverage(charts,segments,failures);
 $('coverage-brief').textContent = report.scanned ? '扫描 ' + report.scanned + ' 张 · 解析 ' + report.parsed + ' · 失败 ' + report.failed : '';
 const box = $('coverage');
 box.replaceChildren();
 if (!report.scanned) { box.append(node('p','尚未扫描谱面。')); return; }
 box.append(node('p','本机库 ' + report.parsed + ' 张难度谱（' + report.songs + ' 首曲目）已解析；本次会话另有 ' + report.failed + ' 张解析失败（失败谱面不保存，刷新后不再列出）。'));
 const table = node('table','');
 const headRow = node('tr','');
 for (const title of ['整谱等级','已解析','解析失败',...report.supported]) headRow.append(node('th',title));
 const thead = node('thead',''); thead.append(headRow);
 const tbody = node('tbody','');
 for (const row of report.levels) {
  const tr = node('tr','');
  for (const value of [row.level,row.parsed,row.failed,...report.supported.map(family => row.hits[family] ?? 0)]) tr.append(node('td',String(value)));
  tbody.append(tr);
 }
 table.append(thead,tbody);
 const wrap = node('div',''); wrap.className = 'table-wrap'; wrap.append(table);
 box.append(wrap, node('p','命中只计 12 及以上。识别支持：' + report.supported.join('、') + '（基础规则）。其余 ' + report.unsupported.length + ' 项尚无识别器，结果为空不代表没有该配置。'));
 for (const [reason,items] of Object.entries(report.reasons)) {
  box.append(node('p','失败原因 · ' + reason + '：' + items.map(item => item.title + (item.difficulty ? ' / ' + typeName(item) : '') + '（' + item.level + '）').join('、')));
 }
}
$('more-results').onclick = () => { resultLimit += PAGE; render(); };
for (const id of ['f-rate','f-max-rate','f-count','f-rhythm','f-sort']) $(id).onchange = () => { resultLimit = PAGE; trackIndex = 0; render(); };
$('f-spread').onchange = () => { resultLimit = PAGE; trackIndex = 0; render(); };
$('f-reset').onclick = () => {
 for (const id of ['f-rate','f-max-rate','f-count','f-rhythm']) $(id).value = '';
 for (const input of $('f-spread').querySelectorAll('input')) input.checked = false;
 resultLimit = PAGE; render();
};
$('preview-replay').onclick = () => preview.replay();
$('preview-back').onclick = () => preview.step(-.05);
$('preview-forward').onclick = () => preview.step(.05);
$('preview-panel').onkeydown = event => {
 if (event.target.closest('select, input')) return;
 if (event.key === ' ' || event.key === 'k') { event.preventDefault(); preview.toggle(); }
 else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); preview.step(event.key === 'ArrowLeft' ? -.05 : .05); }
};

function move(direction) {
 const length = cardCount;
 if (length < 2) return;
 if (stage === 0) familyIndex = (familyIndex + direction + length) % length;
 else if (stage === 1) levelIndex = (levelIndex + direction + length) % length;
 else trackIndex = (trackIndex + direction + length) % length;
 render();
}

$('previous').onclick = $('previous-card').onclick = () => move(-1);
$('following').onclick = $('next-card').onclick = () => move(1);
$('cabinet').onkeydown = event => {
 if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
 event.preventDefault();
 move(event.key === 'ArrowLeft' ? -1 : 1);
};
$('back').onclick = () => {
 stage--;
 render();
 if (!stage) $('next').focus();
};
$('next').onclick = () => {
 if (stage < 2) {
  stage++;
  trackIndex = 0;
 } else {
  reference = currentTrack?.segment ?? reference;
 }
 render();
 if ($('next').disabled) $('back').focus();
};
$('strategy').onchange = () => {trackIndex = 0; render();};
$('adx-entry').onclick = () => {$('import-panel').open = true;};
$('clear').onclick = () => {
 reference = null;
 trackIndex = 0;
 render();
 $('next').focus();
};

function report(added, errors = []) {
 $('import-status').textContent = '加入 ' + added + ' 张。' + errors.join('；');
 render();
}
async function storeCharts(items, errors = []) {
 const result = ingest(items,errors);
 for (const record of result.records) pendingCharts.set(JSON.stringify(record),record);
 if (pendingCharts.size) {
  try {
   await saveCharts([...pendingCharts.values()]);
   pendingCharts.clear();
   $('storage-status').textContent = '已保存到当前浏览器。可导出备份或跨设备转移。';
  } catch {
   $('storage-status').textContent = '本机保存失败，当前页面仍可使用这些谱面。请先导出备份。';
  }
 }
 return result;
}

async function libraryAction(action) {
 libraryBusy = true;
 for (const id of ['demo','add','files']) $(id).disabled = true;
 render();
 try {
  await action();
 } catch (error) {
  report(0,[error.message]);
 } finally {
  libraryBusy = false;
  for (const id of ['demo','add','files']) $(id).disabled = false;
  render();
 }
}

$('demo').onclick = () => libraryAction(async () => {
 const errors = [];
 const items = [...demos, ...sampleTexts.flatMap(text => readCharts(text))];
 const result = await storeCharts(items,errors);
 if (!result.added && !result.errors.length) {
  $('import-status').textContent = '原创样例已加入。';
 } else {
  report(result.added,result.errors);
 }
});
$('add').onclick = () => libraryAction(async () => {
 const result = await storeCharts(readCharts($('source').value,$('title').value,$('level').value));
 report(result.added,result.errors);
});
$('files').onchange = event => {
 const input = event.currentTarget;
 return libraryAction(async () => {
  let added = 0;
  const errors = [];
  try {
   for (const file of input.files) {
    try {
     let result;
     if (/\.(?:adx|zip)$/i.test(file.name)) {
      const {readAdx} = await import('./adx.js');
      const pack = await readAdx(file);
      for (const message of pack.errors) failures.push({title:file.name + ' · ' + message.split('：')[0], level:'未知', reason:message});
      result = await storeCharts(pack.charts,pack.errors);
     } else {
      if (file.size > 500000) throw Error('谱面文本超过 500 KB');
      const text = await file.text();
      result = await storeCharts(/\.json$/i.test(file.name) ? JSON.parse(text) : readCharts(text,file.name));
     }
     added += result.added;
     errors.push(...result.errors);
    } catch (error) {
     errors.push(file.name + '：' + error.message);
    }
   }
   report(added,errors);
  } finally {
   input.value = '';
  }
 });
};
$('reset-library').onclick = () => {
 if (!confirm('清空当前浏览器里的全部练习谱面？建议先导出备份。')) return;
 return libraryAction(async () => {
  await clearCharts();
  charts.length = 0;
  segments.length = 0;
  chartKeys.clear();
  pendingCharts.clear();
  failures.length = 0;
  reference = null;
  currentTrack = null;
  previewing = null;
  preview.stop();
  $('preview-panel').hidden = true;
  trackIndex = 0;
  $('storage-status').textContent = '本机练习库已清空。';
  $('import-status').textContent = '';
 });
};
$('export').onclick = () => {
 const data = charts.map(chartData);
 const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const link = node('a','');
 link.href = url;
 link.download = 'mailab-library.json';
 link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
};
libraryAction(async () => {
 try {
  const records = await loadCharts();
  const errors = [];
  for (let index = 0; index < records.length; index += 100) ingest(records.slice(index,index + 100),errors);
  $('storage-status').textContent = '练习库自动保存在当前浏览器。可导出备份或跨设备转移。';
  if (errors.length) $('import-status').textContent = errors.join('；');
 } catch {
  $('storage-status').textContent = '无法读取本机练习库。当前页面可继续导入，请导出备份。';
 }
});
