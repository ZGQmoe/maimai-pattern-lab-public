import {test} from 'node:test';import assert from 'node:assert/strict';
import {parse,readCharts,analyze,signature,demos,searchSegments} from './dist/core.js';
const p=body=>parse({title:'test',level:'12',body});
test('tempo, subdivision, offset, multiple difficulties',()=>{const cs=readCharts('&title=X\n&first=0.5\n&lv_5=12+\n&inote_5=(120){4}1,(240)2,3,E\n&lv_6=13\n&inote_6=(120)1,E');assert.equal(cs.length,2);const ns=parse(cs[0]).notes;assert.deepEqual(ns.map(n=>n.t),[.5,1,1.25]);assert.equal(cs[0].level,'12+');});
test('hold, slide, touch and simultaneous',()=>{const ns=p('(120){4}1h[4:2]/B2,2-6[4:1],E').notes;assert.equal(ns.length,3);assert.equal(ns[0].duration,1);assert.equal(ns[2].wait,.5);assert.equal(ns[2].duration,.5);assert.equal(ns[1].kind,'touch');});
test('rotation and mirror share identity but speed changes load',()=>{const a=p('(120){16}1,2,1,2,E'),b=p('(240){16}5,4,5,4,E');assert.equal(signature(a.notes),signature(b.notes));assert.ok(analyze(b)[0].load>analyze(a)[0].load);});
test('sample families and unsupported syntax fail closed',()=>{assert.deepEqual([...new Set(analyze(parse(demos[0])).map(s=>s.family))].sort(),['交互','基础 Slide','纵连'].sort());assert.throws(()=>p('(120)1-5-1[4:1],E'));assert.throws(()=>p('(0)1,E'));assert.throws(()=>p('1`2,E'));});
test('identical ordinary Tap background does not match a different target pattern',()=>{
 const background='(120){16}'+Array.from({length:16},(_,i)=>i%8+1).join(',')+',,,,,';
 const jack=analyze(p(background+'1,1,1,1,E'));
 const trill=analyze(p(background+'1,5,1,5,E'));
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
test('arc slide < > direction follows start half under rotation and mirror (R02/A03)',()=>{
 // Simai: '>' is clockwise from 7/8/1/2 and counter-clockwise from 3/4/5/6; '<' is the reverse.
 const seg=body=>analyze(p(body))[0];
 const cwShort=seg('(120){4}1>3[4:1],E'),ccwLong=seg('(120){4}5>7[4:1],E');
 assert.notEqual(cwShort.signature,ccwLong.signature);
 assert.equal(searchSegments([cwShort,ccwLong],{family:'基础 Slide',level:'12',strategy:'all',reference:cwShort}).items.length,0);
 assert.equal(seg('(120){4}1<7[4:1],E').signature,seg('(120){4}5>3[4:1],E').signature);
 assert.equal(cwShort.signature,seg('(120){4}1<7[4:1],E').signature);
});
