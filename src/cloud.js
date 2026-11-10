/** Optional Supabase REST sync. Browser holds publishable key only; RLS enforces ownership. */
export class CloudClient{
  constructor(url,key){this.url=url?.replace(/\/$/,'');this.key=key;this.session=null;}
  get configured(){return Boolean(this.url&&this.key);}
  async request(path,{method='GET',body,session=true,extraHeaders={}}={}){
    if(!this.configured)throw new Error('Cloud sync is not configured yet.');
    const headers={'apikey':this.key,'Content-Type':'application/json',...extraHeaders};
    if(session&&this.session?.access_token)headers.Authorization=`Bearer ${this.session.access_token}`;
    const res=await fetch(this.url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    const text=await res.text();let value;try{value=JSON.parse(text)}catch{value=text};
    if(!res.ok)throw new Error(value?.msg||value?.message||value?.error_description||String(value)||`HTTP ${res.status}`);
    return value;
  }
  async signIn(email,password){const data=await this.request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},session:false});this.session=data;return data;}
  async signUp(email,password){return this.request('/auth/v1/signup',{method:'POST',body:{email,password},session:false});}
  signOut(){this.session=null;}
  async rows(){return this.request('/rest/v1/workspace_docs?select=id,data,updated_at&order=updated_at.desc');}
  async upsert(doc){const data={id:doc.id,owner_id:this.session?.user?.id,data:{...doc,syncedServerAt:undefined,syncedLocalAt:undefined}};
    return this.request('/rest/v1/workspace_docs?on_conflict=id',{method:'POST',body:data,extraHeaders:{Prefer:'resolution=merge-duplicates,return=representation'}});
  }
}
/** Detect cloud/local concurrent edits: preserve local as a conflict copy. */
export async function syncDocuments(cloud,localDocs,put){
  if(!cloud.session?.user?.id)throw new Error('Sign in before syncing');
  const remote=await cloud.rows();const cloudById=new Map(remote.map(r=>[r.id,r]));let uploaded=0,downloaded=0,conflicts=0;
  for(const local of localDocs){
    const row=cloudById.get(local.id);
    if(!row){const created=await cloud.upsert(local);await put({...local,syncedServerAt:created?.[0]?.updated_at||null,syncedLocalAt:local.updatedAt});uploaded++;continue;}
    cloudById.delete(local.id);
    const remotelyChanged=Boolean(!local.syncedServerAt || local.syncedServerAt!==row.updated_at);
    const locallyChanged=Boolean(!local.syncedLocalAt || local.updatedAt!==local.syncedLocalAt);
    if(remotelyChanged&&locallyChanged){
      const conflict={...local,id:crypto.randomUUID(),title:local.title+' (conflict copy)',updatedAt:Date.now(),syncedServerAt:null,syncedLocalAt:null};
      await put(conflict);conflicts++;await put({...row.data,syncedServerAt:row.updated_at,syncedLocalAt:row.data.updatedAt});downloaded++;continue;
    }
    if(remotelyChanged){await put({...row.data,syncedServerAt:row.updated_at,syncedLocalAt:row.data.updatedAt});downloaded++;continue;}
    if(locallyChanged){const rows=await cloud.upsert(local);const newTime=rows?.[0]?.updated_at;await put({...local,syncedServerAt:newTime||row.updated_at,syncedLocalAt:local.updatedAt});uploaded++;}
  }
  for(const row of cloudById.values()){await put({...row.data,syncedServerAt:row.updated_at,syncedLocalAt:row.data.updatedAt});downloaded++;}
  return {uploaded,downloaded,conflicts};
}
