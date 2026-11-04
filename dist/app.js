import {readCharts,parse,analyze,demos,levels,searchSegments} from './core.js';
const $=id=>document.getElementById(id);
const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
let charts=[],segments=[],reference=null,loaded=false,submitted=false;
let query={family:'全部',level:'全部',strategy:'all'};
const time=s=>`${s.toFixed(2)} 秒`;
function ingest(items){
 if(!Array.isArray(items)||items.length>100)throw Error('练习库应为最多 100 张谱面的数组');
 const errors=[];let added=0;
 for(const c of items)try{
  if(!c||typeof c.body!=='string'||c.body.length>500000||!Number.isFinite(c.offset??0)||!levels.includes(c.level))throw Error('谱面内容、偏移或等级无效');
  const chart=parse(c);segments.push(...analyze(chart));charts.push(chart);added++;
 }catch(e){errors.push(`${c?.title??'未知曲目'}：${e.message}`);}
 $('import-status').textContent=`加入 ${added} 张。${errors.join('；')}`;render();
}
function render(){
 $('library').textContent=`${charts.length} 张谱面，${segments.length} 个片段。原创样例的等级仅用于演示。`;
 $('export').disabled=!charts.length;
 $('empty-state').hidden=submitted;
 $('reference-panel').hidden=!reference;
 $('clear').disabled=!reference;
 const list=$('results');list.replaceChildren();
 $('detail').replaceChildren();
 if(reference){
  const s=reference;
  $('reference').textContent=`参考 · ${s.chart.title} / ${s.family} / ${time(s.start)} · 模型负荷 ${s.load.toFixed(1)}`;
  $('detail').append(node('p',`密度 ${s.density.toFixed(2)} Note/秒；持续 ${s.duration.toFixed(2)} 秒；干扰 ${s.interference} Note；前后上下文 ${s.context.toFixed(1)} Note/秒。模型估计，不自动标注为难点。`),node('pre',s.notes.map(n=>`${time(n.t)}  ${n.raw}`).join('\n')));
 }
 if(!submitted)return;
 const {items,message}=searchSegments(segments,{...query,reference});
 let summary=`找到 ${items.length} 段 · 按局部模型负荷排序`;
 if(!items.length){
  summary='没有匹配片段。';
  if(!charts.length)summary='练习库为空。请加载原创样例或导入谱面。';
  else if(query.level!=='全部'&&!charts.some(chart=>chart.level===query.level))summary=`练习库里还没有 ${query.level} 级谱面。`;
 }
 $('status').textContent=[message,summary].filter(Boolean).join(' ');
 for(const {segment:s,sim,ratio} of items){
  const li=node('li','');
  const title=node('div','');title.className='track-title';
  const badge=node('span',s.chart.level);badge.className='level-badge';
  title.append(badge,node('strong',s.chart.title));
  li.append(title,node('p',`${s.family} · ${time(s.start)}–${time(s.end)} · 模型负荷 ${s.load.toFixed(1)}`));
  if(sim!==null)li.append(node('p',`结构相似度 ${Math.round(sim*100)}% · 参考负荷的 ${ratio.toFixed(2)} 倍`));
  const b=node('button','设为参考并查看');b.type='button';b.className='button compact';
  b.onclick=()=>{reference=s;render();$('clear').focus();};
  li.append(b);list.append(li);
 }
}
$('search').onsubmit=e=>{
 e.preventDefault();
 submitted=true;
 query=Object.fromEntries(new FormData(e.currentTarget));
 render();
 $('results-title').focus();
};
$('clear').onclick=()=>{reference=null;render();$('results-title').focus();};
$('demo').onclick=()=>{if(!loaded){loaded=true;ingest(demos);}else $('import-status').textContent='原创样例已加入。';};
const report=e=>$('import-status').textContent=e.message;
$('add').onclick=()=>{try{ingest(readCharts($('source').value,$('title').value,$('level').value));}catch(e){report(e);}};
$('files').onchange=async e=>{for(const f of e.target.files)try{if(f.size>500000)throw Error(f.name+' 超过 500 KB');const t=await f.text();ingest(f.name.endsWith('.json')?JSON.parse(t):readCharts(t,f.name));}catch(err){report(err);}};
$('export').onclick=()=>{const data=charts.map(({title,level,body,offset,difficulty})=>({title,level,body,offset,difficulty}));const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=node('a','');a.href=url;a.download='maimai-practice-library.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
render();
