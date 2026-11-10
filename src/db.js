const DB_NAME='inkspace-local-v1';const VERSION=1;
let connection;
function open(){
  if(!('indexedDB' in globalThis))return Promise.reject(new Error('IndexedDB unavailable in this browser'));
  if(connection)return connection;
  connection=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('documents'))db.createObjectStore('documents',{keyPath:'id'});if(!db.objectStoreNames.contains('assets'))db.createObjectStore('assets',{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });return connection;
}
async function operation(store,mode,fn){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);const req=fn(tx.objectStore(store));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.onerror=()=>reject(tx.error);});}
export const listDocuments=()=>operation('documents','readonly',s=>s.getAll());
export const saveDocument=d=>operation('documents','readwrite',s=>s.put(d));
export const deleteDocument=id=>operation('documents','readwrite',s=>s.delete(id));
export const saveAsset=(id,blob)=>operation('assets','readwrite',s=>s.put({id,blob}));
export const getAsset=async id=>(await operation('assets','readonly',s=>s.get(id)))?.blob||null;
export const deleteAsset=id=>operation('assets','readwrite',s=>s.delete(id));
export function newDocument(kind='notebook',title){
  const id=crypto.randomUUID(),page={id:crypto.randomUUID(),width:960,height:1358,strokes:[],background:kind==='notebook'?'ruled':'plain',assetId:null};
  return {id,kind,title:title||({notebook:'Untitled notebook',board:'Untitled whiteboard',document:'Untitled document'}[kind]),pages:[page],pageIndex:0,view:{zoom:kind==='board'?1:0.8,panX:0,panY:0},updatedAt:Date.now()};
}
