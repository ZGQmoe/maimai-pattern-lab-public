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
export function parse(chart){
 let bpm=120,division=4,t=0,beat=0; const notes=[],warnings=[];
 const body=chart.body.replace(/\|\|[^\n]*/g,'').replace(/\s+/g,'');
 const chunks=body.split(',');
 if(chunks.length>30000)throw Error('片段过多');
 const duration=s=>{let m;if((m=s.match(/^(\d+(?:\.\d+)?):([\d.]+)$/)))return 240/bpm*+m[2]/+m[1];if((m=s.match(/^#([\d.]+)$/)))return +m[1];throw Error('不支持的时值 ['+s+']');};
 for(let i=0;i<chunks.length;i++){
  let s=chunks[i]; if(s==='E')break;
  s=s.replace(/\(([\d.]+)\)|\{(\d+)\}/g,(_,b,d)=>{if(b)bpm=+b;if(d)division=+d;if(!(bpm>0&&bpm<=1000&&division>0&&division<=384))throw Error('BPM 或细分超出范围');return '';});
  if(s){
   // Fail closed: advanced syntax must not silently become a plausible analysis.
   if(/[`*?!@$#]/.test(s.replace(/\[[^\]]*\]/g,'')))throw Error('第 '+(i+1)+' 格包含暂不支持的高级语法');
   const tokens=/^[1-8]+$/.test(s)?[...s]:s.split('/');
   if(notes.length+tokens.length>15000)throw Error('Note 过多');
   for(const token of tokens){
    if(!token)continue;
    const m=token.match(/^([1-8]|[ABDE][1-8]|C)([bx f]*)(?:(h)\[([^\]]+)\]|(-|<|>|\^|v|p|q|s|z|w)([1-8])\[([^\]]+)\])?$/);
    if(!m)throw Error('第 '+(i+1)+' 格无法解析：'+token+'。请查看支持范围。');
    const pos=m[1],kind=m[3]?'hold':m[5]?'slide':pos.length>1||pos==='C'?'touch':'tap';
    const length=m[3]?duration(m[4]):m[5]?duration(m[7]):0;
    if(!Number.isFinite(length)||length<=0&&kind==='slide')throw Error('无效时值');
    notes.push({t:t+(chart.offset||0),beat,pos,kind,shape:m[5]||'',end:m[6]||pos,duration:length,wait:kind==='slide'?60/bpm:0,bpm,slot:i,raw:token,break:m[2].includes('b')});
   }
  }
  const step=240/bpm/division;t+=step;beat+=4/division;
 }
 if(!notes.length)throw Error('没有可分析的 Note');
 return {...chart,notes,warnings,duration:t};
}
const lane=n=>/^[1-8]$/.test(n.pos)?+n.pos-1:null;
const mirror=s=>({'<':'>','>':'<',p:'q',q:'p',s:'z',z:'s'}[s]||s);
export function signature(notes){
 const first=notes[0].beat;const span=Math.max(.001,notes.at(-1).beat-first);
 const variants=[];
 for(const flip of [1,-1])for(let rot=0;rot<8;rot++)variants.push(notes.map(n=>{
  const p=lane(n),e=/^[1-8]$/.test(n.end)?+n.end-1:null;
  return [Math.round((n.beat-first)/span*24),n.kind,p===null?n.pos:mod(p*flip+rot),n.shape?(flip===-1?mirror(n.shape):n.shape):'',e===null?n.end:mod(e*flip+rot)].join(':');
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
  segments.push({id:chart.title+chart.difficulty+':'+a+':'+family,chart,family,start,end,duration,density,interference,context,load,notes:selected,signature:signature(selected),index:a});
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
export function searchSegments(segments,{family,level,strategy,reference=null}){
 if(family!=='全部'&&!supportedFamilies.has(family))return {items:[],message:'该配置识别器待研究，尚无识别结果。'};
 if(reference&&family!=='全部'&&reference.family!==family)return {items:[],message:'参考片段属于另一配置。请清除参考片段后再选。'};
 const items=[];
 for(const segment of segments){
  if(!isPracticeSegment(segment))continue;
  if((family!=='全部'&&segment.family!==family)||(level!=='全部'&&segment.chart.level!==level))continue;
  if(reference===segment)continue;
  const sim=reference?similarity(reference,segment):null;
  const ratio=reference?segment.load/reference.load:null;
  if(reference&&(sim<.5||(strategy==='easy'&&ratio>=.9)||(strategy==='same'&&(ratio<.9||ratio>1.1))||(strategy==='hard'&&ratio<=1.1)))continue;
  items.push({segment,sim,ratio});
 }
 items.sort((a,b)=>a.segment.load-b.segment.load);
 return {items,message:strategy!=='all'&&!reference?'策略尚未应用：先选择参考片段。目前仅按配置和等级浏览。':''};
}
export const demos=levels.slice(0,4).map((level,i)=>({title:'原创练习 '+level,level,difficulty:'原创',offset:0,body:`(${110+i*25}){16},,,,1,1,1,1,1,1,1,1,,,,,2,6,2,6,2,6,2,6,,,,,{4}1-5[4:1],,3>6[4:1],,,,E`}));
