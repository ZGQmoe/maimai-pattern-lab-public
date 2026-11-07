import {test} from 'node:test';import assert from 'node:assert/strict';
import {parse,readCharts,analyze,signature,demos,levels,searchSegments} from './dist/core.js';
import {patterns,patternSources} from './dist/patterns.js';
const p=body=>parse({title:'test',level:'12',body});
test('tempo, subdivision, offset, multiple difficulties',()=>{const cs=readCharts('&title=X\n&first=0.5\n&lv_5=12+\n&inote_5=(120){4}1,(240)2,3,E\n&lv_6=13\n&inote_6=(120)1,E');assert.equal(cs.length,2);const ns=parse(cs[0]).notes;assert.deepEqual(ns.map(n=>n.t),[.5,1,1.25]);assert.equal(cs[0].level,'12+');});
test('hold, slide, touch and simultaneous',()=>{const ns=p('(120){4}1h[4:2]/B2,2-6[4:1],E').notes;assert.equal(ns.length,3);assert.equal(ns[0].duration,1);assert.equal(ns[2].wait,.5);assert.equal(ns[2].duration,.5);assert.equal(ns[1].kind,'touch');});
test('rotation and mirror share identity but speed changes load',()=>{const a=p('(120){16}1,2,1,2,E'),b=p('(240){16}5,4,5,4,E');assert.equal(signature(a.notes),signature(b.notes));assert.ok(analyze(b)[0].load>analyze(a)[0].load);});
test('sample families and unsupported syntax fail closed',()=>{assert.deepEqual([...new Set(analyze(parse(demos[0])).map(s=>s.family))].sort(),['交互','基础 Slide','纵连'].sort());assert.throws(()=>p('(120)1-5[4:1]-3,E'));assert.throws(()=>p('(0)1,E'));assert.throws(()=>p('1`2,E'));});
for (const [family, first, middle, last] of [
 ['纵连', '1', '1,1', '1'],
 ['交互', '1', '5,1', '5'],
]) {
 test(family+' only uses single-tap slots, regardless of chord token order', () => {
  const find = body => analyze(p('(120){16}'+body+',E')).filter(s=>s.family===family);
  const phrase = [first, middle, last].join(',');
  assert.deepEqual(find('3/4,'+phrase+',3/4').map(s=>s.notes.map(n=>n.raw).join(',')), [phrase]);
  for (const body of [
   '3/'+phrase,
   first+'/3,'+middle+','+last,
   phrase+'/3',
   first+','+middle+',3/'+last,
   first+','+middle+'/3,'+last,
  ]) {
   assert.equal(find(body).length, 0, body);
  }
 });
}
test('identical ordinary Tap background does not match a different target pattern',()=>{
 const background='(120){16}'+Array.from({length:16},(_,i)=>i%8+1).join(',')+',,,,,';
 const jack=analyze(p(background+'1,1,1,1,E'));
 const trill=analyze(p(background+'1,5,1,5,E'));
 assert.deepEqual(jack.map(s=>s.family), ['纵连']);
 assert.deepEqual(trill.map(s=>s.family), ['交互']);
 assert.deepEqual(searchSegments([...jack,...trill],{family:'纵连',level:'12',strategy:'all'}).items.map(x=>x.segment),jack);
 assert.equal(searchSegments([...jack,...trill],{family:'全部',level:'12',strategy:'all',reference:jack[0]}).items.length,0);
});
test('practice strategy uses reference load, and unsupported choices stay empty',()=>{
 const list=demos.flatMap(c=>analyze(parse(c))).filter(s=>s.family==='纵连');
 const options={family:'纵连',level:'全部',strategy:'easy'};
 assert.match(searchSegments(list,options).message,/尚未应用/);
 assert.deepEqual(searchSegments(list,{...options,reference:list[1]}).items.map(x=>x.segment),[list[0]]);
 assert.equal(searchSegments(list,{...options,level:'14'}).items.length,0);
 assert.match(searchSegments(list,{...options,family:'海底谭'}).message,/待研究/);
});

test('all 12-and-above levels search independently, and basic notes stay out of practice',()=>{
 assert.deepEqual(levels,['12','12+','13','13+','14','14+','15']);
 const list=['11+',...levels].flatMap(level=>analyze(parse({title:level,level,body:'(120){16}1,1,1,1,,,,2-6[4:1],E'})));
 const search=level=>searchSegments(list,{family:'全部',level,strategy:'all'}).items.map(item=>item.segment);
 assert.deepEqual(search('全部').map(segment=>segment.chart.level),levels);
 for(const level of levels) assert.deepEqual(search(level).map(segment=>[segment.family,segment.chart.level]),[['纵连',level]]);
 assert.equal(searchSegments(list,{family:'基础 Slide',level:'全部',strategy:'all'}).items.length,0);
 for(const pattern of patterns.filter(pattern=>!pattern.supported)) {
  const result=searchSegments(list,{family:pattern.value,level:'14+',strategy:'all'});
  assert.equal(result.items.length,0,pattern.value);
  assert.match(result.message,/待研究/);
 }
});

test('community directory retains sources without treating basic notes as specialties',()=>{
 assert.equal(new Set(patterns.map(pattern=>pattern.value)).size,patterns.length);
 for(const title of ['海底谭','纵连','交互','快速交互','定拍','发牌']) assert.ok(patterns.some(pattern=>pattern.value===title));
 assert.ok(!patterns.some(pattern=>['单点','基础 Slide'].includes(pattern.value)));
 for(const pattern of patterns) {
  assert.ok(pattern.sources.length,pattern.value);
  for(const source of pattern.sources) assert.ok(patternSources[source]?.url.startsWith('https://'));
 }
});

test('compact EACH preserves timing, slot boundaries and single-tap detection', () => {
 for (const [compact, explicit] of [['12','1/2'],['123','1/2/3'],['12345678','1/2/3/4/5/6/7/8']]) {
  const read = text => p('(120){16}'+text+',4,E').notes;
  assert.deepEqual(read(compact),read(explicit));
 }
 for (const chord of ['13','31','1/3','3/1']) {
  assert.deepEqual(analyze(p('(120){16}'+chord+',1,1,1,E')),[]);
  assert.deepEqual(analyze(p('(120){16}'+chord+',5,1,5,E')),[]);
  assert.equal(analyze(p('(120){16}'+chord+',1,1,1,1,E')).filter(s=>s.family==='纵连').length,1);
 }
 for (const body of ['12b','12h[4:1]','19']) assert.throws(()=>p('(120)'+body+',E'));
 assert.throws(()=>p('(120)'+'1'.repeat(15001)+',E'),/Note 过多/);
});

test('blank maidata difficulties do not consume the import or fail valid siblings', () => {
 const charts = readCharts('&title=有空难度的原创谱\n&inote_1=\n&lv_2=3\n&inote_2=  \n&lv_5=13\n&inote_5=(120){16}12,1,1,1,1,E');
 assert.equal(charts.length,1);
 assert.equal(charts[0].difficulty,'inote_5');
 assert.equal(analyze(parse(charts[0]))[0].family,'纵连');
 assert.throws(()=>readCharts('&inote_1=\n&inote_5=  '),/没有非空/);
});

test('ADX reads chart text from song folders and skips media', async () => {
 const {BlobWriter,TextReader,ZipWriter} = await import('./dist/vendor/zip-native.min.js');
 const {readAdx} = await import('./dist/adx.js');
 const zip = new ZipWriter(new BlobWriter(), {useWebWorkers:false});
 await zip.add('levels/a/MaiData.txt',new TextReader('&title=测试 A\n&first=0.25\n&inote_1=\n&lv_5=13\n&inote_5=(120){16}13,1,5,1,5,E'));
 await zip.add('levels/a/track.ogg',new TextReader('not a chart'));
 await zip.add('levels/b/maidata.txt',new TextReader('&lv_4=9\n&inote_4=(120){16}1,1,1,1,E'));
 await zip.add('levels/c/maidata.txt',new TextReader('a broken chart'));
 const result = await readAdx(await zip.close());
 assert.deepEqual(result.charts.map(chart=>[chart.title,chart.level,chart.difficulty]), [['测试 A','13','inote_5'],['b','9','inote_4']]);
 assert.deepEqual(result.errors,['c：缺少 inote 谱面字段']);
 assert.equal(analyze(parse(result.charts[0]))[0].start,.375);
 assert.equal(analyze(parse(result.charts[1]))[0].family,'纵连');
 await assert.rejects(readAdx(new Blob(['invalid ZIP'])));
});

// ---- Search results, preview window, local features and coverage (R01–R05, R10; A03, A05, A06, A11, A12) ----
const {sampleTexts} = await import('./dist/samples.js');
const {previewWindow, coverage, segmentFeatures} = await import('./dist/core.js');
const loadSamples = () => {
 const charts = [], failures = [];
 for (const text of sampleTexts) for (const chart of readCharts(text)) {
  try { charts.push(parse(chart)); } catch (error) { failures.push({...chart, reason:error.message}); }
 }
 return {charts, failures, segments:charts.flatMap(analyze)};
};

test('slide syntax: chains, shared heads, V, pp/qq, BPM-override and second-based durations', () => {
 const [chain] = p('(120)1-4-7[2:1],E').notes;
 assert.deepEqual([chain.kind, chain.shape, chain.end, chain.duration], ['slide','--','7',1]);
 assert.equal(p('(120)1-4[4:1]>7[4:1],E').notes[0].duration, 1);
 const shared = p('(120)1-5[8:1]*-3[8:1],E').notes;
 assert.deepEqual(shared.map(n => [n.end, n.sharedHead]), [['5',false],['3',true]]);
 assert.deepEqual(p('(120)1V35[4:1],E').notes[0].path, [{shape:'V', turn:'3', end:'5'}]);
 assert.equal(p('(120)1pp5[4:1],E').notes[0].shape, 'pp');
 const [override] = p('(120)1-5[60#1:1],E').notes;
 assert.deepEqual([override.wait, override.duration], [1, 4]);
 const [seconds] = p('(120)1-5[0.5##1.5],E').notes;
 assert.deepEqual([seconds.wait, seconds.duration], [.5, 1.5]);
 assert.equal(p('(120)Ch[4:1],E').notes[0].kind, 'hold');
 for (const bad of ['1-5[4:1]-3', '1-5[4:1]-3[4:1]-6', 'C-5[4:1]', '1-9[4:1]', '1`2', '1h', '<HS*2>1']) assert.throws(() => p('(120)' + bad + ',E'), bad);
});

test('no reference needed: Trill at one level returns only Trill hits, across songs', () => {
 const {segments} = loadSamples();
 const result = searchSegments(segments, {family:'交互', level:'13+'});
 assert.ok(result.items.length >= 3);
 assert.equal(result.message, '');
 for (const {segment} of result.items) {
  assert.equal(segment.family, '交互');
  assert.equal(segment.chart.level, '13+');
 }
 for (const level of levels) for (const family of ['纵连','交互']) {
  for (const {segment} of searchSegments(segments, {family, level}).items) assert.deepEqual([segment.family, segment.chart.level], [family, level]);
 }
});

test('one song with several hits: each preview targets its own time in its own difficulty', () => {
 const {segments} = loadSamples();
 const hits = searchSegments(segments, {family:'交互', level:'13+', sort:'title'}).items.map(item => item.segment).filter(s => s.chart.title === '原创样例 · 回廊');
 assert.deepEqual(hits.map(s => s.chart.difficulty), ['inote_5','inote_5','inote_5']);
 assert.deepEqual(hits.map(s => s.features.lanes.join('/')), ['1/5','3/4','8/6']);
 assert.deepEqual(hits.map(s => s.features.spreadName), ['对侧','相邻','隔一键']);
 for (const segment of hits) {
  const view = previewWindow(segment);
  assert.equal(view.targetStart, segment.start);
  assert.equal(view.targetEnd, segment.end);
  assert.ok(view.playStart < view.targetStart && view.playEnd > view.targetEnd);
  const targets = view.notes.filter(x => x.role === 'target').map(x => x.note);
  assert.deepEqual(targets, segment.notes);
  for (const {note} of view.notes) assert.ok(segment.chart.notes.includes(note), 'note from another chart');
 }
 const easier = segments.find(s => s.chart.title === '原创样例 · 回廊' && s.chart.difficulty === 'inote_4' && s.family === '交互');
 assert.ok(!previewWindow(easier).notes.some(({note}) => hits[0].chart.notes.includes(note)));
});

test('preview keeps holds, slides and star heads that cross the target boundary, with BPM change and offset', () => {
 const chart = parse(readCharts(sampleTexts[0])[1]);
 const segments = analyze(chart);
 const jack = segments.find(s => s.family === '纵连');
 const hold = chart.notes.find(n => n.kind === 'hold');
 assert.ok(hold.t < jack.start && hold.t + hold.duration > jack.start);
 const view = previewWindow(jack, {approach:.8});
 assert.deepEqual(view.notes.filter(x => x.role === 'crossing').map(x => x.note), [hold]);
 assert.ok(view.playStart <= hold.t - .8 + 1e-9);
 assert.deepEqual(jack.notes.map(n => n.raw), ['7','7','7','7','7','7']);
 // &first=0.5, 4 eighths and 8 sixteenths at 150 BPM, a 1-bar hold, then BPM 180.
 const trill = segments.filter(s => s.family === '交互').at(-1);
 assert.equal(+trill.start.toFixed(3), 4.533);
 assert.deepEqual(trill.features.bpms, [180]);
 const slide = chart.notes.find(n => n.raw === '1-5[4:1]');
 assert.ok(slide.t < trill.start && slide.t + slide.wait + slide.duration > trill.start);
 assert.ok(previewWindow(trill).notes.some(x => x.note === slide && x.role === 'crossing'));
});

test('local features filter strength within one level without changing identity', () => {
 const fast = analyze(p('(200){16}1,5,1,5,1,5,1,5,E'))[0];
 const slow = analyze(p('(100){16}1,5,1,5,1,5,1,5,E'))[0];
 assert.equal(fast.signature, slow.signature);
 assert.ok(Math.abs(fast.features.rate - 2 * slow.features.rate) < 1e-9);
 const list = [fast, slow];
 assert.deepEqual(searchSegments(list, {family:'交互', level:'12', filters:{minRate:10}}).items.map(x => x.segment), [fast]);
 assert.deepEqual(searchSegments(list, {family:'交互', level:'12', filters:{maxRate:10}}).items.map(x => x.segment), [slow]);
 const filtered = searchSegments(list, {family:'交互', level:'12', filters:{minRate:100}});
 assert.deepEqual([filtered.items.length, filtered.filtered], [0, 2]);
 const swing = analyze(p('(120){16}1,5,{8}1,5,{16}1,5,E'))[0];
 assert.equal(swing.features.even, false);
 assert.equal(fast.features.even, true);
 assert.deepEqual(searchSegments([fast, swing], {family:'交互', level:'12', filters:{rhythm:'uneven'}}).items.map(x => x.segment), [swing]);
 const near = analyze(p('(120){16}1,2,1,2,E'))[0];
 assert.deepEqual([near.features.spread, fast.features.spread], [1, 4]);
 assert.deepEqual(searchSegments([fast, near], {family:'交互', level:'12', filters:{spreads:[1]}}).items.map(x => x.segment), [near]);
 assert.deepEqual(searchSegments([fast, near], {family:'交互', level:'12', filters:{minCount:6}}).items.map(x => x.segment), [fast]);
 assert.match(segmentFeatures(near).evidence, /键 1 \/ 2 交替 4 个单 Tap（相邻）/);
});

test('untagged original chart is found by structure, and coverage separates failures from absence', () => {
 const {charts, failures, segments} = loadSamples();
 const anonymous = searchSegments(segments, {family:'纵连', level:'12'}).items.map(x => x.segment.chart.title);
 assert.ok(anonymous.includes('原创样例 · 无名小品'));
 const report = coverage(charts, segments, failures);
 assert.equal(report.scanned, charts.length + failures.length);
 assert.equal(report.failed, 1);
 assert.deepEqual(Object.keys(report.reasons), ['伪 EACH（`）暂不支持']);
 assert.equal(report.levels.find(row => row.level === '13').failed, 1);
 assert.deepEqual(report.supported, ['纵连','交互']);
 assert.ok(report.unsupported.includes('海底谭'));
 assert.ok(!('基础 Slide' in report.hits));
 assert.deepEqual(report.levels.map(row => row.level), levels);
});
