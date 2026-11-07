#!/usr/bin/env node
// Mailab coverage scan: node tools/scan.mjs <file-or-folder>... [--json] [--family 交互] [--level 13+]
// Reads .adx/.zip packages and maidata.txt files locally with the same parser as the web page.
// Nothing is uploaded. Only scan charts you are allowed to use.
import {readdir, readFile, stat} from 'node:fs/promises';
import {join, basename, dirname, extname} from 'node:path';
import {readCharts, parse, analyze, coverage, searchSegments, levels} from '../dist/core.js';
import {readAdx} from '../dist/adx.js';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
const json = args.includes('--json') && args.splice(args.indexOf('--json'), 1);
const family = flag('--family'), level = flag('--level') ?? '全部';
if (!args.length) {
 console.error('用法：node tools/scan.mjs <文件或目录>... [--json] [--family 交互] [--level 13+]');
 process.exit(2);
}

async function* files(path) {
 const info = await stat(path);
 if (info.isDirectory()) for (const entry of await readdir(path)) yield* files(join(path, entry));
 else yield path;
}

const charts = [], failures = [], packages = {read: 0, failed: 0};
const fail = (title, chart, reason) => failures.push({title, difficulty: chart?.difficulty, level: chart?.level ?? '未知', reason});
function ingest(list, source) {
 for (const chart of list) {
  try { charts.push({...parse(chart), source}); } catch (error) { fail(chart.title, chart, error.message); }
 }
}
for (const root of args) {
 for await (const path of files(root)) {
  const ext = extname(path).toLowerCase();
  try {
   if (ext === '.adx' || ext === '.zip') {
    const pack = await readAdx(new File([await readFile(path)], basename(path)));
    packages.read++;
    for (const message of pack.errors) fail(basename(path) + ' · ' + message.split('：')[0], null, message);
    ingest(pack.charts, path);
   } else if (/^maidata\.txt$/i.test(basename(path)) || ext === '.simai') {
    const text = await readFile(path, 'utf8');
    ingest(readCharts(text, basename(dirname(path))), path);
   }
  } catch (error) {
   packages.failed++;
   fail(path, null, error.message);
  }
 }
}

const segments = charts.flatMap(analyze);
const report = coverage(charts, segments, failures);
const hits = family ? searchSegments(segments, {family, level, sort: 'title'}) : null;
if (json) {
 console.log(JSON.stringify({packages, ...report, hits: hits?.items.map(({segment}) => ({
  title: segment.chart.title, difficulty: segment.chart.difficulty, level: segment.chart.level, family: segment.family,
  start: +segment.start.toFixed(3), end: +segment.end.toFixed(3), evidence: segment.features.evidence,
  rate: +segment.features.rate.toFixed(2), count: segment.features.count, source: segment.chart.source,
 }))}, null, 1));
} else {
 console.log(`压缩包 ${packages.read} 个（读取失败 ${packages.failed}）；难度谱 扫描 ${report.scanned} · 成功解析 ${report.parsed} · 失败 ${report.failed} · 曲目 ${report.songs}`);
 console.log('整谱等级 | 已解析 | 失败 | ' + report.supported.join(' | '));
 for (const row of report.levels) console.log([row.level, row.parsed, row.failed, ...report.supported.map(f => row.hits[f] ?? 0)].join(' | '));
 for (const [reason, items] of Object.entries(report.reasons)) console.log(`失败 · ${reason}：${items.length} 张`);
 console.log(`识别支持：${report.supported.join('、')}；其余 ${report.unsupported.length} 项未支持，结果为空不代表没有该配置。命中只计显示等级 ${levels[0]} 及以上。`);
 if (hits) {
  console.log(hits.message || `${family} · ${level}：${hits.items.length} 段`);
  for (const {segment} of hits.items) console.log(`- ${segment.chart.title} / ${segment.chart.difficulty} / Lv ${segment.chart.level} / ${segment.start.toFixed(2)}–${segment.end.toFixed(2)} 秒 / ${segment.features.evidence}`);
 }
}
