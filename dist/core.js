import {patterns} from './patterns.js';
export const levels=['12','12+','13','13+','14','14+','15'];
const supportedFamilies=new Set(patterns.filter(p=>p.supported).map(p=>p.value));
export const isPracticeSegment=segment=>supportedFamilies.has(segment.family)&&Number.parseFloat(segment.chart.level)>=12;
const mod=n=>(n%8+8)%8;
export function readCharts(text,name='导入谱面',level='12'){
 if(text.length>500000)throw Error('文件超过 500 KB，请分批导入');
 const fields={}; for(const m of text.replace(/^\uFEFF/,'').matchAll(/^&([^=\n]+)=([\s\S]*?)(?=^&|$(?![\s\S]))/gm))fields[m[1].trim()]=m[2].trim();
 const ids=Object.keys(fields).filter(k=>/^inote_\d+$/.test(k)&&fields[k]);
 if(!ids.length&&Object.keys(fields).some(k=>/^inote_\d+$/.test(k)))throw Error('没有非空的 inote 谱面字段');
 return ids.length?ids.map(k=>({title:fields.title||name,level:fields['lv_'+k.slice(6)]||'未知',body:fields[k],offset:Number(fields.first||0),difficulty:k})): [{title:name,level,body:text,offset:0,difficulty:'自定义'}];
}
// Slide shapes accepted by the restricted parser. Geometry in the preview is approximate for curved shapes.
const slideShape=/(pp|qq|V[1-8]|[-<>^vpqszw])([1-8])([bx]*)(\[[^\]]+\])?([bx]*)/y;
function readDuration(text,bpm){
 let m;
 const beats=(spec,tempo)=>{const d=spec.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);return d?240/tempo*+d[2]/+d[1]:null;};
 if((m=text.match(/^#(\d+(?:\.\d+)?)$/)))return {wait:60/bpm,length:+m[1]};
 if((m=text.match(/^(\d+(?:\.\d+)?)##(.+)$/))){const length=/^\d+(?:\.\d+)?$/.test(m[2])?+m[2]:beats(m[2],bpm);if(length!==null)return {wait:+m[1],length};}
 else if((m=text.match(/^(\d+(?:\.\d+)?)#(.+)$/))){const tempo=+m[1];const length=/^\d+(?:\.\d+)?$/.test(m[2])?+m[2]:beats(m[2],tempo);if(tempo>0&&length!==null)return {wait:60/tempo,length};}
 else{const length=beats(text,bpm);if(length!==null)return {wait:60/bpm,length};}
 throw Error('不支持的时值 ['+text+']');
}
function readToken(token,bpm,where){
 const head=token.match(/^([1-8]|[ABDE][1-8]|C[12]?)([bxf$@?!]*)/);
 const fail=()=>{throw Error(where+'无法解析：'+token+'。请查看支持范围。');};
 if(!head)fail();
 const pos=head[1],touch=!/^[1-8]$/.test(pos),mods=head[2];
 const base={pos,end:pos,shape:'',path:[],duration:0,wait:0,break:mods.includes('b'),ex:mods.includes('x'),headless:/[?!]/.test(mods)};
 let rest=token.slice(head[0].length);
 if(!rest)return [{...base,kind:touch?'touch':'tap'}];
 const hold=rest.match(/^([bxf]*)h([bxf]*)(?:\[([^\]]+)\])?([bxf]*)$/);
 if(hold){
  if(!hold[3])throw Error(where+'Hold 缺少时值：'+token);
  const {length}=readDuration(hold[3],bpm);
  if(!(length>0))throw Error('无效时值');
  return [{...base,kind:'hold',duration:length,break:base.break||/b/.test(hold[1]+hold[2]+hold[4])}];
 }
 if(touch)fail();
 const notes=[];
 for(const [k,group] of rest.split('*').entries()){
  if(!group)fail();
  const path=[],specs=[];let at=0,isBreak=false;slideShape.lastIndex=0;
  for(let m;at<group.length&&(slideShape.lastIndex=at,m=slideShape.exec(group));at=slideShape.lastIndex){
   const shape=m[1][0]==='V'?'V':m[1];
   path.push({shape,end:m[2],turn:m[1][0]==='V'?m[1][1]:null});
   specs.push(m[4]?m[4].slice(1,-1):null);
   if((m[3]+m[5]).includes('b'))isBreak=true;
  }
  if(at!==group.length||!path.length)fail();
  // Either one total duration on the last segment, or one per segment.
  let wait,length;
  if(specs.at(-1)!==null&&specs.slice(0,-1).every(x=>x===null)){({wait,length}=readDuration(specs.at(-1),bpm));}
  else if(specs.every(x=>x!==null)){const parts=specs.map(x=>readDuration(x,bpm));wait=parts[0].wait;length=parts.reduce((a,b)=>a+b.length,0);}
  else throw Error(where+'链式 Slide 的时值写法暂不支持：'+token);
  if(!(length>0)||!(wait>=0))throw Error('无效时值');
  notes.push({...base,kind:'slide',shape:path.map(x=>x.shape).join(''),end:path.at(-1).end,path,wait,duration:length,
   break:base.break||isBreak,headless:base.headless||k>0,sharedHead:k>0});
 }
 return notes;
}
export function parse(chart){
 let bpm=120,division=4,secStep=null,t=0,beat=0; const notes=[],warnings=[];
 const body=chart.body.replace(/\|\|[^\n]*/g,'').replace(/\s+/g,'');
 const chunks=body.split(',');
 if(chunks.length>30000)throw Error('片段过多');
 for(let i=0;i<chunks.length;i++){
  let s=chunks[i]; if(s==='E')break;
  // {#秒} 让每个逗号固定为若干秒；<HS*x> 只影响流速，不影响时间，可安全忽略。
  s=s.replace(/\(([\d.]+)\)|\{(\d+)\}|\{#([\d.]+)\}|<HS\*[\d.]+>/g,(_,b,d,sec)=>{if(b)bpm=+b;if(d){division=+d;secStep=null;}if(sec)secStep=+sec;if(!(bpm>0&&bpm<=1000&&division>0&&division<=384&&(secStep===null||secStep>0&&secStep<=60)))throw Error('BPM 或细分超出范围');return '';});
  if(s){
   // Fail closed: syntax outside the supported subset must not silently become a plausible analysis.
   if(s.includes('`'))throw Error('第 '+(i+1)+' 格包含暂不支持的高级语法（伪 EACH）');
   if(/[{}()<]/.test(s.replace(/\[[^\]]*\]/g,'').replace(/[1-8]<[1-8]/g,'')))throw Error('第 '+(i+1)+' 格包含暂不支持的高级语法');
   const tokens=/^[1-8]+$/.test(s)?[...s]:s.split('/');
   if(notes.length+tokens.length>15000)throw Error('Note 过多');
   for(const token of tokens){
    if(!token)continue;
    for(const note of readToken(token,bpm,'第 '+(i+1)+' 格'))notes.push({...note,t:t+(chart.offset||0),beat,bpm,slot:i,raw:token});
   }
  }
  const step=secStep??240/bpm/division;t+=step;beat+=secStep===null?4/division:secStep*bpm/60;
 }
 if(!notes.length)throw Error('没有可分析的 Note');
 return {...chart,notes,warnings,duration:t};
}
const lane=n=>/^[1-8]$/.test(n.pos)?+n.pos-1:null;
// Simai '>' is clockwise from 7/8/1/2 and counter-clockwise from 3/4/5/6; '<' is the reverse.
// Each chain segment is resolved from its own start, so identity does not follow the raw symbol.
const ring=(shape,p)=>shape!=='<'&&shape!=='>'||p===null?shape:((p+2)%8>=4)===(shape==='>')?'ccw':'cw';
const mirror=s=>({cw:'ccw',ccw:'cw',p:'q',q:'p',pp:'qq',qq:'pp',s:'z',z:'s'}[s]||s);
// Slide identity: every segment's absolute shape plus its rotated vertices (V turn and end).
function slideIdentity(n,flip,rot){
 const at=v=>/^[1-8]$/.test(v)?mod((+v-1)*flip+rot):v;
 const path=n.path?.length?n.path:[{shape:n.shape,end:n.end,turn:null}];
 let cur=lane(n);
 return path.map(seg=>{
  let shape=ring(seg.shape,cur);if(flip===-1)shape=mirror(shape);
  const part=shape+(seg.turn?'@'+at(seg.turn):'')+'>'+at(seg.end);
  cur=/^[1-8]$/.test(seg.end)?+seg.end-1:null;
  return part;
 }).join(',');
}
export function signature(notes){
 const first=notes[0].beat;const span=Math.max(.001,notes.at(-1).beat-first);
 const variants=[];
 for(const flip of [1,-1])for(let rot=0;rot<8;rot++)variants.push(notes.map(n=>{
  const p=lane(n),e=/^[1-8]$/.test(n.end)?+n.end-1:null;
  return [Math.round((n.beat-first)/span*24),n.kind,p===null?n.pos:mod(p*flip+rot),n.kind==='slide'?slideIdentity(n,flip,rot):'',e===null?n.end:mod(e*flip+rot)].join(':');
 }).join('|'));
 return variants.sort()[0];
}
export function analyze(chart){
 const ns=chart.notes,segments=[];
 const singleTapLane=i=>{
  const note=ns[i];
  if(note.kind!=='tap'||ns[i-1]?.slot===note.slot||ns[i+1]?.slot===note.slot)return null;
  return lane(note);
 };
 // ponytail: bounded scan for <=15k notes; replace with interval index if measured latency warrants it.
 const add=(a,b,family)=>{
  const selected=ns.slice(a,b),start=selected[0].t,end=Math.max(...selected.map(n=>n.t+n.wait+n.duration));
  const duration=Math.max(.25,end-start),density=selected.length/duration;
  const surrounding=ns.filter(n=>n.t>=start-1&&n.t<=end+1);
  const interference=surrounding.filter(n=>!selected.includes(n)&&n.t>=start&&n.t<=end).length;
  const context=surrounding.filter(n=>n.t<start||n.t>end).length/2;
  const load=density*2+Math.log2(1+duration)*2+interference*.8+context*.35;
  const segment={id:chart.title+'|'+chart.difficulty+'|'+a+'|'+family,chart,family,start,end,duration,density,interference,context,load,notes:selected,signature:signature(selected),index:a};
  segment.features=segmentFeatures(segment);
  segments.push(segment);
 };
 for(let i=0;i<ns.length;){
  const p=singleTapLane(i);let j=i+1;
  if(p!==null)while(j<ns.length&&singleTapLane(j)===p&&ns[j].t>ns[j-1].t&&ns[j].t-ns[j-1].t<=.6)j++;
  if(j-i>=4){add(i,j,'纵连');i=j;}else i++;
 }
 for(let i=0;i+3<ns.length;){let j=i+2;const a=singleTapLane(i),b=singleTapLane(i+1);
  if(a!==null&&b!==null&&a!==b&&ns[i+1].t>ns[i].t&&ns[i+1].t-ns[i].t<=.6)
   while(j<ns.length&&singleTapLane(j)===((j-i)%2===0?a:b)&&ns[j].t>ns[j-1].t&&ns[j].t-ns[j-1].t<=.6)j++;
  if(j-i>=4){add(i,j,'交互');i=j;}else i++;
 }
 ns.forEach((n,i)=>{if(n.kind==='slide')add(i,i+1,'基础 Slide');});
 return segments;
}
export function similarity(a,b){
 if(a.family!==b.family)return 0;
 if(a.signature===b.signature)return 1;
 const x=a.signature.split('|'),y=b.signature.split('|');
 let same=0;for(let i=0;i<Math.min(x.length,y.length);i++)if(x[i]===y[i])same++;
 return .4+.6*same/Math.max(x.length,y.length);
}
const spanNames=['同键','相邻','隔一键','隔两键','对侧'];
const laneName=n=>n.pos;
// Explainable local features. They describe the matched notes only and are not a calibrated difficulty.
export function segmentFeatures(segment){
 const ns=segment.notes,gaps=[];
 for(let i=1;i<ns.length;i++)gaps.push(ns[i].t-ns[i-1].t);
 const minGap=gaps.length?Math.min(...gaps):0,maxGap=gaps.length?Math.max(...gaps):0;
 const span=ns.at(-1).t-ns[0].t,meanGap=gaps.length?span/gaps.length:0;
 const rate=meanGap>0?1/meanGap:0;
 const even=gaps.length>0&&(maxGap-minGap)<=Math.max(.004,meanGap*.05);
 const beatGap=ns.length>1?(ns.at(-1).beat-ns[0].beat)/(ns.length-1):0;
 const noteValue=beatGap>0?Math.round(4/beatGap*10)/10:null;
 const bpms=[...new Set(ns.map(n=>n.bpm))];
 const lanes=[...new Set(ns.map(laneName))];
 let spread=null,evidence='';
 if(segment.family==='纵连'){
  spread=0;
  evidence='键 '+lanes[0]+' 连续 '+ns.length+' 个单 Tap；每个时间格只有这一个 Note，相邻间隔 ≤ 0.6 秒';
 }else if(segment.family==='交互'){
  const d=Math.abs(+lanes[0]-+lanes[1]);spread=Math.min(d,8-d);
  evidence='键 '+lanes[0]+' / '+lanes[1]+' 交替 '+ns.length+' 个单 Tap（'+spanNames[spread]+'）；每个时间格只有这一个 Note，相邻间隔 ≤ 0.6 秒';
 }else if(segment.family==='基础 Slide'){
  evidence='单条 Slide '+ns[0].raw;
 }
 return {count:ns.length,minGap,maxGap,meanGap,rate,even,noteValue,bpms,lanes,spread,spreadName:spread===null?'':spanNames[spread],evidence};
}
const sorters={
 load:(a,b)=>a.segment.load-b.segment.load,
 title:(a,b)=>a.segment.chart.title.localeCompare(b.segment.chart.title,'zh-CN')||String(a.segment.chart.difficulty).localeCompare(String(b.segment.chart.difficulty))||a.segment.start-b.segment.start,
 rate:(a,b)=>b.segment.features.rate-a.segment.features.rate,
 gap:(a,b)=>a.segment.features.minGap-b.segment.features.minGap,
 count:(a,b)=>b.segment.features.count-a.segment.features.count,
};
export const sortNames={title:'曲名 → 难度谱 → 时间',rate:'平均速率 高→低',gap:'最短间隔 短→长',count:'音符数 多→少',load:'模型负荷 低→高'};
export function passesFilters(segment,filters={}){
 const f=segment.features;
 if(filters.minRate&&f.rate<filters.minRate)return false;
 if(filters.maxRate&&f.rate>filters.maxRate)return false;
 if(filters.minCount&&f.count<filters.minCount)return false;
 if(filters.rhythm==='even'&&!f.even)return false;
 if(filters.rhythm==='uneven'&&f.even)return false;
 if(filters.spreads?.length&&segment.family==='交互'&&!filters.spreads.includes(f.spread))return false;
 return true;
}
export function searchSegments(segments,{family,level,strategy='all',reference=null,filters={},sort='load'}){
 if(family!=='全部'&&!supportedFamilies.has(family))return {items:[],message:'该配置识别器待研究，尚无识别结果。'};
 if(reference&&family!=='全部'&&reference.family!==family)return {items:[],message:'参考片段属于另一配置。请清除参考片段后再选。'};
 const items=[];let filtered=0;
 for(const segment of segments){
  if(!isPracticeSegment(segment))continue;
  if((family!=='全部'&&segment.family!==family)||(level!=='全部'&&segment.chart.level!==level))continue;
  if(reference===segment)continue;
  if(!passesFilters(segment,{...filters,family})){filtered++;continue;}
  const sim=reference?similarity(reference,segment):null;
  const ratio=reference?segment.load/reference.load:null;
  if(reference&&(sim<.5||(strategy==='easy'&&ratio>=.9)||(strategy==='same'&&(ratio<.9||ratio>1.1))||(strategy==='hard'&&ratio<=1.1)))continue;
  items.push({segment,sim,ratio});
 }
 items.sort(sorters[sort]??sorters.load);
 return {items,filtered,message:strategy!=='all'&&!reference?'策略尚未应用：先选择参考片段。目前仅按配置和等级浏览。':''};
}
export const activeEnd=n=>n.t+n.wait+n.duration;
// Playback window for a hit: the target range stays exact, the play range adds context,
// notes still active across either boundary and the approach time of their heads.
export function previewWindow(segment,{lead=1.2,tail=.8,approach=.8}={}){
 const {start,end,chart}=segment,target=new Set(segment.notes);
 let from=start-lead,to=end+tail;
 for(const n of chart.notes){
  if(n.t<start&&activeEnd(n)>=start)from=Math.min(from,n.t);
  if(n.t<=end&&activeEnd(n)>end)to=Math.max(to,activeEnd(n));
 }
 // Do not pad before the chart's first note: there is nothing to show there.
 const playStart=Math.max(from-approach,Math.min(chart.notes[0].t,start)-approach),playEnd=to;
 const notes=[];
 for(const n of chart.notes){
  if(activeEnd(n)<playStart||n.t-approach>playEnd)continue;
  const crossing=!target.has(n)&&((n.t<start&&activeEnd(n)>=start)||(n.t<=end&&activeEnd(n)>end));
  const role=target.has(n)?'target':crossing?'crossing':n.t>=start&&n.t<=end?'inside':'context';
  notes.push({note:n,role});
 }
 return {targetStart:start,targetEnd:end,playStart,playEnd,approach,notes,
  crossing:notes.filter(x=>x.role==='crossing').length};
}
const reasonOf=message=>/伪 EACH/.test(message)?'伪 EACH（`）暂不支持':/高级语法/.test(message)?'其他高级语法暂不支持':/链式 Slide/.test(message)?'链式 Slide 时值写法暂不支持':/无法解析/.test(message)?'无法解析的 Note 写法':/时值/.test(message)?'不支持或无效的时值':/BPM|细分/.test(message)?'BPM / 细分超出范围':/没有可分析|没有非空|缺少 inote/.test(message)?'没有可分析的谱面内容':/超过|过多/.test(message)?'超过大小或数量上限':/等级/.test(message)?'等级或字段无效':'其他错误';
// Coverage summary: what was scanned, parsed and recognised. Failed or unsupported is unknown, not absent.
export function coverage(charts,segments,failures=[]){
 const byLevel={};
 const row=level=>byLevel[level]??={level,parsed:0,failed:0,hits:{}};
 for(const chart of charts)row(chart.level).parsed++;
 for(const failure of failures)row(failure.level??'未知').failed++;
 const hits={};
 for(const segment of segments){
  if(!isPracticeSegment(segment))continue;
  hits[segment.family]=(hits[segment.family]??0)+1;
  const r=row(segment.chart.level);r.hits[segment.family]=(r.hits[segment.family]??0)+1;
 }
 const reasons={};
 for(const failure of failures){const key=reasonOf(failure.reason);(reasons[key]??=[]).push(failure);}
 return {scanned:charts.length+failures.length,parsed:charts.length,failed:failures.length,
  songs:new Set(charts.map(c=>c.title)).size,hits,reasons,
  levels:Object.values(byLevel).sort((a,b)=>parseFloat(a.level)-parseFloat(b.level)||a.level.localeCompare(b.level)),
  supported:patterns.filter(p=>p.supported).map(p=>p.value),
  unsupported:patterns.filter(p=>!p.supported).map(p=>p.value)};
}
export const demos=levels.slice(0,4).map((level,i)=>({title:'原创练习 '+level,level,difficulty:'原创',offset:0,body:`(${110+i*25}){16},,,,1,1,1,1,1,1,1,1,,,,,2,6,2,6,2,6,2,6,,,,,{4}1-5[4:1],,3>6[4:1],,,,E`}));
