import {BlobReader, ZipReader} from './vendor/zip-native.min.js';
import {readCharts} from './core.js';

export async function readAdx(file) {
 if (file.size > 100_000_000) throw Error('ADX / ZIP 超过 100 MB，请拆包后导入');
 const reader = new ZipReader(new BlobReader(file));
 try {
  const entries = [];
  let count = 0;
  for await (const entry of reader.getEntriesGenerator()) {
   if (++count > 5000) throw Error('压缩包内文件过多');
   if (!entry.directory && /(?:^|\/)maidata\.txt$/i.test(entry.filename) && !entry.filename.startsWith('__MACOSX/')) {
    entries.push(entry);
    if (entries.length > 100) throw Error('单个压缩包最多读取 100 份 maidata.txt');
   }
  }
  if (!entries.length) throw Error('包内没有 maidata.txt');
  const charts = [], errors = [];
  for (const entry of entries) {
   const parts = entry.filename.split('/');
   const label = parts.at(-2) || file.name || 'ADX 谱面';
   try {
    if (entry.encrypted) throw Error('不支持加密谱面');
    if (entry.uncompressedSize > 500_000) throw Error('谱面文本超过 500 KB');
    const decoder = new TextDecoder('utf-8', {fatal:true});
    let text = '', size = 0;
    await entry.getData(new WritableStream({
     write(chunk) {
      size += chunk.byteLength;
      if (size > 500_000) throw Error('谱面文本超过 500 KB');
      text += decoder.decode(chunk, {stream:true});
     },
    }), {checkSignature:true, useWebWorkers:false});
    const parsed = readCharts(text + decoder.decode(), label);
    if (parsed[0].difficulty === '自定义') throw Error('缺少 inote 谱面字段');
    if (charts.length + parsed.length > 100) throw Error('单个压缩包最多导入 100 张难度谱面');
    charts.push(...parsed);
   } catch (error) {
    errors.push(label + '：' + error.message);
   }
  }
  return {charts, errors};
 } finally {
  await reader.close();
 }
}
