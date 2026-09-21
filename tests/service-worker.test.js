import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';

const source=readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8');
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
test('Pages subdirectory assets are cached and available offline',async()=>{
 const w=worker('https://example.github.io/habit-seasons/');await w.lifecycle('install');
 const response=await w.request('./app.js');assert.equal(response.url,'https://example.github.io/habit-seasons/app.js');
 const cached=[...w.entries.values()][0];for(const url of cached.keys()){const name=new URL(url).pathname.split('/').at(-1);if(name)assert.ok(existsSync(new URL('../dist/'+name,import.meta.url)),name)}
});
test('offline navigation falls back inside the repository path',async()=>{
 const w=worker('https://example.github.io/habit-seasons/');await w.lifecycle('install');
 assert.equal((await w.request('./unavailable','navigate')).url,'https://example.github.io/habit-seasons/index.html');
});
test('activation leaves other projects caches intact',async()=>{
 const scope='https://example.github.io/habit-seasons/',w=worker(scope),other='habit-seasons:https://example.github.io/another-app/:v1',old=`habit-seasons:${scope}:v0`;
 w.entries.set(other,new Map());w.entries.set(old,new Map());await w.lifecycle('install');await w.lifecycle('activate');
 assert.deepEqual(w.deleted,[old]);assert.ok(w.entries.has(other));
});
