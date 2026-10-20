import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {buildServiceWorker} from '../../scripts/build-service-worker.mjs';

const output=new URL('../../dist/',import.meta.url);
const workerFile=new URL('sw.js',output);
const source=readFileSync(workerFile,'utf8');
const html=readFileSync(new URL('index.html',output),'utf8');
const script=html.match(/<script[^>]+src="([^"]+)"/)[1];
const files=readdirSync(output,{recursive:true})
 .map(file=>file.replaceAll('\\','/'))
 .filter(file=>statSync(new URL(file,output)).isFile()&&file!=='sw.js');
function worker(scope){
 const handlers={},entries=new Map(),deleted=[];
 const self={registration:{scope},location:new URL(scope),clients:{claim:async()=>{}},addEventListener:(type,fn)=>handlers[type]=fn};
 const caches={
  async open(name){if(!entries.has(name))entries.set(name,new Map());const data=entries.get(name);return{
   async addAll(assets){for(const asset of assets){const url=new URL(asset,scope).href;data.set(url,{url})}},
   async match(request){return data.get(typeof request==='string'?request:request.url)}
  }},
  async keys(){return [...entries.keys()]},
  async delete(key){deleted.push(key);return entries.delete(key)}
 };
 vm.runInNewContext(source,{self,caches,URL,fetch:async()=>{throw new Error('offline')}});
 const lifecycle=type=>new Promise((resolve,reject)=>handlers[type]({waitUntil:p=>p.then(resolve,reject)}));
 const request=(path,mode='cors')=>new Promise((resolve,reject)=>handlers.fetch({request:{url:new URL(path,scope).href,method:'GET',mode},respondWith:p=>p.then(resolve,reject)}));
 return {entries,deleted,lifecycle,request};
}
for(const scope of ['https://example.github.io/habit-seasons/','https://example.com/']){
 test(`built assets are available offline at ${scope}`,async()=>{
  const w=worker(scope);await w.lifecycle('install');
  assert.match(script,/^\.\/assets\/[^/]+\.js$/);
  assert.equal((await w.request(script)).url,new URL(script,scope).href);
  const cached=[...w.entries.values()][0];
  assert.equal(cached.size,files.length+1);
  for(const file of files){
   assert.ok(cached.has(new URL(file,scope).href),file);
   assert.equal((await w.request('./'+file)).url,new URL(file,scope).href);
  }
  for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
   assert.ok(match[1].startsWith('./'),match[1]);
   assert.ok(cached.has(new URL(match[1],scope).href),match[1]);
  }
 });
}
test('offline navigation falls back inside the repository path',async()=>{
 const w=worker('https://example.github.io/habit-seasons/');await w.lifecycle('install');
 assert.equal((await w.request('./unavailable','navigate')).url,'https://example.github.io/habit-seasons/index.html');
});
test('activation leaves other projects caches intact',async()=>{
 const scope='https://example.github.io/habit-seasons/',w=worker(scope),other='habit-seasons:https://example.github.io/another-app/:v1',old=`habit-seasons:${scope}:v0`;
 w.entries.set(other,new Map());w.entries.set(old,new Map());await w.lifecycle('install');await w.lifecycle('activate');
 assert.deepEqual(w.deleted,[old]);assert.ok(w.entries.has(other));
});
test('unchanged builds are stable and public asset changes create a new offline version',async()=>{
 const manifest=new URL('manifest.webmanifest',output),original=readFileSync(manifest);
 await buildServiceWorker();assert.equal(readFileSync(workerFile,'utf8'),source);
 try{
  writeFileSync(manifest,Buffer.concat([original,Buffer.from('\n')]));await buildServiceWorker();
  const updated=readFileSync(workerFile,'utf8');
  assert.notEqual(updated.match(/const CACHE=(.*);/)[1],source.match(/const CACHE=(.*);/)[1]);
 }finally{writeFileSync(manifest,original);await buildServiceWorker()}
 assert.equal(readFileSync(workerFile,'utf8'),source);
});
