import test from 'node:test';
import assert from 'node:assert/strict';
import {clearStoredData,LOCAL_DATA_KEY,HABIT_VIEW_KEY} from '../dist/local-data.js';
import {populatedState} from './fixtures.js';

function fixture(raw=JSON.stringify(populatedState())){
 const entries=new Map([[LOCAL_DATA_KEY,raw],[HABIT_VIEW_KEY,'detail'],['other-app','keep me']]);
 const storage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,String(value)),removeItem:key=>entries.delete(key)};
 return {entries,storage,raw};
}

test('clearing removes the app records and preferences while preserving unrelated storage',()=>{
 const {entries,storage,raw}=fixture();
 clearStoredData(storage,raw);
 assert.equal(storage.getItem(LOCAL_DATA_KEY),null);
 assert.equal(storage.getItem(HABIT_VIEW_KEY),null);
 assert.deepEqual([...entries],[['other-app','keep me']]);
 // Repeating the clear on an empty installation is safe.
 clearStoredData(storage,null);
 assert.equal(storage.getItem('other-app'),'keep me');
});

test('a newer record written by another tab requires fresh confirmation',()=>{
 const {entries,storage,raw}=fixture();
 storage.setItem(LOCAL_DATA_KEY,'newer data');
 const before=[...entries];
 assert.throws(()=>clearStoredData(storage,raw),error=>error.code==='LOCAL_DATA_CHANGED');
 assert.deepEqual([...entries],before);
});

test('a storage read failure leaves all records untouched',()=>{
 const {entries,storage,raw}=fixture(),before=[...entries];
 storage.getItem=()=>{throw new Error('Storage blocked')};
 assert.throws(()=>clearStoredData(storage,raw),/Storage blocked/);
 assert.deepEqual([...entries],before);
});

test('a preference deletion failure does not delete the main record',()=>{
 const {entries,storage,raw}=fixture(),before=[...entries];
 const remove=storage.removeItem;
 storage.removeItem=key=>{if(key===HABIT_VIEW_KEY)throw new Error('Deletion blocked');remove(key)};
 assert.throws(()=>clearStoredData(storage,raw),/Deletion blocked/);
 assert.deepEqual([...entries],before);
});

test('a main-record deletion failure preserves data and restores its preference',()=>{
 const {storage,raw}=fixture(),remove=storage.removeItem;
 storage.removeItem=key=>{if(key===LOCAL_DATA_KEY)throw new Error('Deletion blocked');remove(key)};
 assert.throws(()=>clearStoredData(storage,raw),/Deletion blocked/);
 assert.equal(storage.getItem(LOCAL_DATA_KEY),raw);
 assert.equal(storage.getItem(HABIT_VIEW_KEY),'detail');
 assert.equal(storage.getItem('other-app'),'keep me');
});

test('confirmed clearing can recover from an unreadable or corrupt backup',()=>{
 const {storage,raw}=fixture('{invalid json');
 clearStoredData(storage,raw);
 assert.equal(storage.getItem(LOCAL_DATA_KEY),null);
});
