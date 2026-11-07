import {readCharts,parse,analyze,demos,levels,searchSegments,isPracticeSegment} from './core.js?v=mailab-1';
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
const charts = [], segments = [];
const chartKeys = new Set();
const pendingCharts = new Map();
let stage = 0, familyIndex = 0, levelIndex = 1, trackIndex = 0, reference = null;
let cardCount = 0, currentTrack = null;
let libraryBusy = true;

function selectFamily(value) {
 familyIndex = families.findIndex(family => family.value === value);
 stage = 0;
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
   errors.push((chart?.title ?? '未知曲目') + '：' + error.message);
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
 let cards = families, index = familyIndex;
 let summary = '', current = null;
 if (stage === 1) {
  cards = levelChoices;
  index = levelIndex;
 } else if (stage === 2) {
  const result = searchSegments(segments,{family:family.value,level,strategy:$('strategy').value,reference});
  cards = result.items.map(item => {
   const segment = item.segment;
   const type = Number(/^inote_([1-7])$/.exec(segment.chart.difficulty)?.[1]);
   return {...item, title:segment.chart.title, level:segment.chart.level,
    caption:chartTypes[type - 1] ?? segment.family, tone:'track-' + (type || 0)};
  });
  trackIndex = Math.min(trackIndex, Math.max(0,cards.length - 1));
  index = trackIndex;
  current = cards[index];
  summary = cards.length ? cards.length + ' 段 · 按局部模型负荷排序' : '没有匹配片段。';
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
 const result = await storeCharts(demos);
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
  reference = null;
  currentTrack = null;
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
