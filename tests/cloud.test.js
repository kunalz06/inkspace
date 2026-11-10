import test from 'node:test';import assert from 'node:assert/strict';
import {CloudClient,syncDocuments} from '../src/cloud.js';

test('cloud is opt-in and disabled with no public project settings',()=>{
 const client=new CloudClient('','');assert.equal(client.configured,false);
});
test('sync preserves newly created local documents and annotates sync markers',async()=>{
 const current={id:'id-1',title:'Notebook',updatedAt:1,pages:[{strokes:[]}]};
 const cache=[];
 const cloud={session:{user:{id:'user-1'}},rows:async()=>[],upsert:async()=>[{updated_at:'2026-11-10T00:00:00Z'}]};
 const count=await syncDocuments(cloud,[current],async item=>cache.push(item));
 assert.equal(count.uploaded,1);assert.equal(cache[0].syncedLocalAt,1);assert.equal(cache[0].syncedServerAt,'2026-11-10T00:00:00Z');
});
test('sync saves a conflict copy instead of deleting offline edits',async()=>{
 const local={id:'id-1',title:'Notebook',updatedAt:9,syncedLocalAt:2,syncedServerAt:'OLD'};
 const remote={id:'id-1',updated_at:'NEW',data:{id:'id-1',title:'Remote',updatedAt:5}};
 const items=[];const result=await syncDocuments({session:{user:{id:'u'}},rows:async()=>[remote]},[local],async doc=>items.push(doc));
 assert.equal(result.conflicts,1);assert.match(items[0].title,/conflict copy/);assert.equal(items[1].title,'Remote');
});

test('first-time sync conflicts preserve previously uploaded remote work',async()=>{
 const local={id:'same',title:'Local',updatedAt:12};
 const remote={id:'same',updated_at:'NEW',data:{id:'same',title:'Cloud',updatedAt:10}};
 const saves=[];const result=await syncDocuments({session:{user:{id:'u'}},rows:async()=>[remote]},[local],async d=>saves.push(d));
 assert.equal(result.conflicts,1);assert.equal(saves[0].title,'Local (conflict copy)');assert.equal(saves[1].title,'Cloud');
});
