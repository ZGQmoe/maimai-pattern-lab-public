export function chartData({title,level,body,offset = 0,difficulty}) {
 return {title,level,body,offset,difficulty};
}

async function accessLibrary(mode, action) {
 const database = await new Promise((resolve,reject) => {
  // Keep the original database name so the Mailab rename preserves existing libraries.
  const request = indexedDB.open('maikiri-library',1);
  request.onupgradeneeded = () => request.result.createObjectStore('charts');
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(request.result);
 });
 try {
  return await new Promise((resolve,reject) => {
   const transaction = database.transaction('charts',mode);
   const request = action(transaction.objectStore('charts'));
   transaction.oncomplete = () => resolve(request?.result);
   transaction.onabort = () => reject(transaction.error ?? Error('练习库保存中断'));
  });
 } finally {
  database.close();
 }
}

export function loadCharts() {
 return accessLibrary('readonly', store => store.getAll());
}

export async function saveCharts(charts) {
 const records = await Promise.all(charts.map(async chart => {
  const data = chartData(chart);
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)));
  const key = Array.from(new Uint8Array(digest),byte => byte.toString(16).padStart(2,'0')).join('');
  return {key,data};
 }));
 await accessLibrary('readwrite', store => {
  for (const record of records) store.put(record.data,record.key);
 });
}

export function clearCharts() {
 return accessLibrary('readwrite', store => store.clear());
}
