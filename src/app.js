import {newDocument,listDocuments,saveDocument,deleteDocument,saveAsset,getAsset} from './db.js';
import {extractFeatures,trainPersonalModel,classifyPointer} from './input.js';
import {createPointerTracker} from './tracker.js';
import {importPDF} from './pdf.js';
import {CloudClient,syncDocuments} from './cloud.js';

const $=(selector)=>document.querySelector(selector);
const $$=(selector)=>[...document.querySelectorAll(selector)];
const canvas=$('#canvas'),workspace=$('#workspace'),ctx=canvas.getContext('2d',{alpha:true});
const options={mode:localStorage.getItem('inkspace-input-mode')||'auto',fingerMax:Number(localStorage.getItem('inkspace-finger-max'))||22};
const cloud=new CloudClient(window.INKSPACE_CONFIG?.supabaseUrl,window.INKSPACE_CONFIG?.supabasePublishableKey);
const mkSamples=()=>{
 const arr=[];
 for(let i=0;i<24;i++){
  const k=i%12;
  const palm=i>=12;
  const w=palm?24+k*1.5:5+k*.72,h=palm?21+k*1.2:5+k*.56;
  arr.push({features:extractFeatures({width:w,height:h,pressure:.5}),label:palm?1:0});
 }
 return arr;
};
const syntheticModel=trainPersonalModel(mkSamples(),340);syntheticModel.kind='synthetic-bootstrap-unvalidated';
let personalModel;
try{personalModel=JSON.parse(localStorage.getItem('inkspace-personal-model')||'null')}catch{personalModel=null}
let docs=[],doc=null,tool='pen',color='#242f44',size=4,stroke=null,pan=null,history=[],redoHistory=[];
let savedTimer=null,toastTimer=null,dirty=false;
const assets=new Map();
function notice(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3400);}
function stamp(){if(doc){doc.updatedAt=Date.now();dirty=true;$('#saveState').textContent='Saving…';clearTimeout(savedTimer);savedTimer=setTimeout(async()=>{try{await saveDocument(doc);dirty=false;$('#saveState').textContent='✓ Saved locally';renderDocs();}catch(err){notice('Local save failed: '+err.message);$('#saveState').textContent='Save failed';}},350);}}
function flush(){if(doc&&dirty){clearTimeout(savedTimer);return saveDocument(doc).then(()=>{dirty=false;$('#saveState').textContent='✓ Saved locally';});}return Promise.resolve();}
function page(){return doc?.pages[doc.pageIndex]}
function updateHeader(){
 $('#welcome').classList.toggle('hidden',!!doc);$('#bottomControls').classList.toggle('hidden',!doc);$('#toolbar').style.opacity=doc?'1':'.45';
 $('#currentTitle').textContent=doc?.title||'Welcome to InkSpace';$('#modeLabel').textContent=(doc?.kind||'NOTEBOOK').toUpperCase();
 $('#pageTitle').textContent=doc?`Page ${doc.pageIndex+1}`:'Your new workspace';$('#pageCounter').textContent=doc?`${doc.pageIndex+1} / ${doc.pages.length}`:'—';
 $('#pageControls').classList.toggle('hidden',doc?.kind==='board');$('#zoomLevel').textContent=doc?`${Math.round(doc.view.zoom*100)}%`:'100%';
 $('#prevPage').disabled=!doc||doc.pageIndex===0;
 $('#engineStatus').textContent=personalModel?'Personalized ML + rules':'Experimental ML + rules';
}
function renderDocs(){
 $('#docCount').textContent=docs.length;$('#docList').replaceChildren();
 for(const item of [...docs].sort((a,b)=>b.updatedAt-a.updatedAt)){
  const el=document.createElement('div');el.role='button';el.tabIndex=0;el.className='doc-row'+(doc?.id===item.id?' selected':'');
  const ico=document.createElement('span');ico.className='doc-icon';ico.textContent={board:'◇',notebook:'▤',document:'▧'}[item.kind]||'▤';
  const info=document.createElement('span');info.className='doc-info';const title=document.createElement('strong');title.textContent=item.title;
  const secondary=document.createElement('small');secondary.textContent=item.kind==='board'?'Whiteboard':`${item.pages.length} page${item.pages.length===1?'':'s'} · ${item.kind}`;
  info.append(title,secondary);
  const del=document.createElement('button');del.type='button';del.className='doc-delete';del.title='Delete document';del.textContent='×';del.addEventListener('click',async event=>{event.stopPropagation();if(!confirm(`Delete “${item.title}” from this device?`))return;await deleteDocument(item.id);docs=docs.filter(x=>x.id!==item.id);if(doc?.id===item.id){doc=docs[0]||null;history=[];redoHistory=[];}renderDocs();updateHeader();render();});
  el.append(ico,info,del);el.addEventListener('click',()=>{chooseDoc(item.id);$('#sidebar').classList.remove('open');});el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();chooseDoc(item.id);}});$('#docList').append(el);
 }
}
async function chooseDoc(id){await flush();doc=docs.find(d=>d.id===id)||null;history=[];redoHistory=[];renderDocs();updateHeader();render();}
async function createDoc(kind='notebook'){
 await flush();const item=newDocument(kind);docs.push(item);await saveDocument(item);await chooseDoc(item.id);$('#sidebar').classList.remove('open');notice(kind==='board'?'Your whiteboard is ready':'New notebook created');
}
function metrics(){
 if(!doc)return null;const p=page(),z=doc.view.zoom,board=doc.kind==='board';
 return {z,x:(board?canvas.clientWidth/2:Math.max(26,(canvas.clientWidth-p.width*z)/2))+doc.view.panX,y:(board?canvas.clientHeight/2:55)+doc.view.panY,w:p.width,h:p.height};
}
function toWorld(e){const r=canvas.getBoundingClientRect(),m=metrics();return {x:(e.clientX-r.left-m.x)/m.z,y:(e.clientY-r.top-m.y)/m.z,pressure:e.pressure||.5};}
async function loadImage(id){if(!id)return null;if(assets.has(id))return assets.get(id);
 const blob=await getAsset(id);if(!blob)return null;
 const url=URL.createObjectURL(blob),img=new Image();
 const promise=new Promise((resolve)=>{img.onload=()=>{URL.revokeObjectURL(url);resolve(img);render();};img.onerror=()=>{URL.revokeObjectURL(url);resolve(null);};});
 img.src=url;assets.set(id,promise);return promise;
}
function drawStroke(s){const points=s.points||[];if(!points.length)return;
 ctx.save();ctx.globalAlpha=s.tool==='highlighter'?.24:1;ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=s.width*(s.tool==='highlighter'?3:1);
 if(points.length===1){const p=points[0];ctx.beginPath();ctx.arc(p.x,p.y,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}
 else{ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];ctx.quadraticCurveTo(a.x,a.y,(a.x+b.x)/2,(a.y+b.y)/2);}ctx.lineTo(points.at(-1).x,points.at(-1).y);ctx.stroke();}ctx.restore();
}
function render(){
 const ratio=Math.min(devicePixelRatio||1,3);const cw=Math.max(1,Math.round(canvas.clientWidth*ratio)),ch=Math.max(1,Math.round(canvas.clientHeight*ratio));if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
 ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);if(!doc)return;
 const p=page(),m=metrics();ctx.save();ctx.translate(m.x,m.y);ctx.scale(m.z,m.z);
 if(doc.kind!=='board'){
  ctx.shadowColor='#1c29401e';ctx.shadowBlur=32/m.z;ctx.shadowOffsetY=12/m.z;ctx.fillStyle='#fff';ctx.fillRect(0,0,p.width,p.height);ctx.shadowColor='transparent';ctx.beginPath();ctx.rect(0,0,p.width,p.height);ctx.clip();
  if(p.background==='ruled'&&!p.assetId){ctx.strokeStyle='#e7edf7';ctx.lineWidth=1;for(let y=78;y<p.height;y+=39){ctx.beginPath();ctx.moveTo(55,y);ctx.lineTo(p.width-48,y);ctx.stroke();}ctx.strokeStyle='#f2ccd4';ctx.beginPath();ctx.moveTo(69,0);ctx.lineTo(69,p.height);ctx.stroke();}
  if(p.assetId){const pending=assets.get(p.assetId);if(pending&&pending.image)ctx.drawImage(pending.image,0,0,p.width,p.height);else if(!pending){loadImage(p.assetId).then(image=>{if(image)assets.set(p.assetId,{image});render();});}}
 }else{
  const startX=Math.floor((-m.x/m.z)/40)*40,endX=startX+canvas.clientWidth/m.z+80,startY=Math.floor((-m.y/m.z)/40)*40,endY=startY+canvas.clientHeight/m.z+80;
  ctx.fillStyle='#c9d2e3';for(let x=startX;x<endX;x+=40)for(let y=startY;y<endY;y+=40){ctx.beginPath();ctx.arc(x,y,1.2,0,Math.PI*2);ctx.fill();}
 }
 for(const s of p.strokes)drawStroke(s);if(stroke)drawStroke(stroke);
 ctx.restore();$('#zoomLevel').textContent=`${Math.round(doc.view.zoom*100)}%`;
}
function eraseNear(point){const p=page(),radius=size*3+13;const before=p.strokes.length;p.strokes=p.strokes.filter(s=>!s.points.some(pt=>Math.hypot(pt.x-point.x,pt.y-point.y)<radius));if(before!==p.strokes.length){stamp();render();}}
function snapshot(){history.push(JSON.stringify(page().strokes));if(history.length>75)history.shift();redoHistory=[];}
function begin(e){if(!doc)return;const point=toWorld(e);
 if(doc.kind!=='board' && (point.x<0||point.y<0||point.x>page().width||point.y>page().height))return;
 snapshot();
 if(tool==='eraser'){eraseNear(point);return;}
 stroke={id:crypto.randomUUID(),tool,color,width:size,points:[point]};render();
}
function move(e){if(!doc)return;const point=toWorld(e);if(tool==='eraser'){eraseNear(point);return;}
 if(stroke){const last=stroke.points.at(-1);if(Math.hypot(last.x-point.x,last.y-point.y)>=.6){stroke.points.push(point);render();}}
}
function end(){if(stroke&&doc){page().strokes.push(stroke);stroke=null;stamp();render();}}
const tracker=createPointerTracker({onStart:begin,onMove:move,onEnd:end,onReject:()=>{},getOptions:()=>({model:personalModel||syntheticModel,mode:options.mode,fingerMax:options.fingerMax})});
canvas.addEventListener('pointerdown',e=>{
 if(!doc)return;e.preventDefault();
 if(tool==='pan'){
  if(pan)return;pan={id:e.pointerId,x:e.clientX,y:e.clientY,px:doc.view.panX,py:doc.view.panY};try{canvas.setPointerCapture(e.pointerId)}catch{}return;
 }
 if(tracker.down(e))try{canvas.setPointerCapture(e.pointerId)}catch{}
});
canvas.addEventListener('pointermove',e=>{
 if(pan){if(e.pointerId===pan.id){doc.view.panX=pan.px+e.clientX-pan.x;doc.view.panY=pan.py+e.clientY-pan.y;render();}return;}
 const coalesced=e.getCoalescedEvents?.();for(const pt of (coalesced?.length?coalesced:[e]))tracker.move(pt);
});
function pointerEnd(e){if(pan){if(pan.id===e.pointerId){pan=null;stamp();}return;}tracker.up(e);}
canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',pointerEnd);
canvas.addEventListener('lostpointercapture',e=>{if(tracker.activeId===e.pointerId)tracker.up(e);if(pan?.id===e.pointerId){pan=null;stamp();}});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function setTool(value){tool=value;$$('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));canvas.style.cursor=tool==='pan'?'grab':tool==='eraser'?'cell':'crosshair';tracker.reset();stroke=null;render();}
$$('[data-tool]').forEach(btn=>btn.addEventListener('click',()=>setTool(btn.dataset.tool)));
$$('[data-color]').forEach(btn=>btn.addEventListener('click',()=>{color=btn.dataset.color;$$('[data-color]').forEach(b=>b.classList.toggle('selected',b===btn));setTool('pen');}));
$('#brushSize').addEventListener('input',e=>{$('#sizeReadout').textContent=e.target.value;size=Number(e.target.value)});
$$('[data-create]').forEach(btn=>btn.addEventListener('click',()=>createDoc(btn.dataset.create)));
$('#undoBtn').addEventListener('click',()=>{if(!doc||!history.length)return;redoHistory.push(JSON.stringify(page().strokes));page().strokes=JSON.parse(history.pop());stamp();render();});
$('#redoBtn').addEventListener('click',()=>{if(!doc||!redoHistory.length)return;history.push(JSON.stringify(page().strokes));page().strokes=JSON.parse(redoHistory.pop());stamp();render();});
function changePage(n){if(!doc)return;const next=Math.max(0,Math.min(doc.pages.length-1,n));doc.pageIndex=next;history=[];redoHistory=[];doc.view.panX=0;doc.view.panY=0;stamp();updateHeader();render();}
$('#prevPage').addEventListener('click',()=>changePage(doc.pageIndex-1));$('#nextPage').addEventListener('click',()=>changePage(doc.pageIndex+1));
$('#addPage').addEventListener('click',()=>{if(!doc||doc.kind==='board')return;const prev=page();doc.pages.push({id:crypto.randomUUID(),width:prev.width,height:prev.height,strokes:[],background:doc.kind==='notebook'?'ruled':'plain',assetId:null});changePage(doc.pages.length-1);});
function zoom(amount){if(!doc)return;doc.view.zoom=Math.min(3,Math.max(.2,Math.round((doc.view.zoom+amount)*100)/100));stamp();render();}
$('#zoomIn').addEventListener('click',()=>zoom(.15));$('#zoomOut').addEventListener('click',()=>zoom(-.15));$('#zoomReset').addEventListener('click',()=>{if(!doc)return;doc.view.zoom=doc.kind==='board'?1:.8;doc.view.panX=0;doc.view.panY=0;stamp();render();});
canvas.addEventListener('wheel',e=>{if(!doc)return;e.preventDefault();zoom(e.deltaY>0?-.08:.08);},{passive:false});
$('#currentTitle').title='Tap to rename this workspace';$('#currentTitle').style.cursor='pointer';$('#currentTitle').addEventListener('click',async()=>{if(!doc)return;const value=prompt('Rename workspace',doc.title)?.trim();if(!value||value===doc.title)return;doc.title=value.slice(0,100);stamp();updateHeader();renderDocs();});
window.addEventListener('keydown',e=>{if(!doc||!e.ctrlKey&&!e.metaKey||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if(e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'#redoBtn':'#undoBtn').click();}else if(e.key.toLowerCase()==='y'){e.preventDefault();$('#redoBtn').click();}});
$('#openSidebar').addEventListener('click',()=>$('#sidebar').classList.add('open'));$('#closeSidebar').addEventListener('click',()=>$('#sidebar').classList.remove('open'));
$('#importBtn').addEventListener('click',()=>$('#fileInput').click());
$('#fileInput').addEventListener('change',async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file)return;
 try{
  if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
   notice('Converting PDF pages for offline annotation…');
   const {pages,rawId}=await importPDF(file,(n,total)=>{if(n===total)notice(`Prepared ${n} PDF pages`)});
   const item=newDocument('document',file.name.replace(/\.pdf$/i,''));item.pages=pages;item.originalAssetId=rawId;docs.push(item);await saveDocument(item);await chooseDoc(item.id);
  }else if(file.type.startsWith('image/')){
   const image=await createImageBitmap(file);const id=crypto.randomUUID();await saveAsset(id,file);
   const item=newDocument('document',file.name);item.pages[0]={...item.pages[0],width:image.width,height:image.height,assetId:id};image.close();docs.push(item);await saveDocument(item);await chooseDoc(item.id);
  }else throw new Error('Choose a PDF or image file.');
  $('#sidebar').classList.remove('open');notice('Imported and saved to this device');
 }catch(err){notice(err.message);console.error(err);}
});
function downloadBlob(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('#shareBtn').addEventListener('click',()=>{if(!doc)return notice('Create a workspace first');canvas.toBlob(b=>{if(b)downloadBlob(b,`${doc.title.replace(/[^a-z0-9 -]/gi,'')}-page-${doc.pageIndex+1}.png`);else notice('Could not export image');},'image/png');});
function closeModal(){$('#modalBackdrop').classList.add('hidden');$('#modalContent').replaceChildren();}
$('#modalClose').addEventListener('click',closeModal);$('#modalBackdrop').addEventListener('pointerdown',e=>{if(e.target===$('#modalBackdrop'))closeModal();});
function openModal(title,markup){$('#modalTitle').textContent=title;$('#modalContent').innerHTML=markup;$('#modalBackdrop').classList.remove('hidden');}
function settings(){
 openModal('Settings & sync',`<p>InkSpace saves your work locally first. The hybrid touch engine runs entirely on your device.</p>
 <h3>Writing & palm rejection</h3><label>Input mode<select id="inputMode"><option value="auto">Automatic — pen or finger</option><option value="pen">Active stylus only</option></select></label>
 <label>Maximum finger contact size (CSS px)<input id="fingerMax" type="range" min="12" max="36" value="${options.fingerMax}"/><span id="fingerMaxValue">${options.fingerMax}px</span></label>
 <div class="note">${personalModel?`Personalized ML model: ${personalModel.trainedOn} labeled samples.`:'Experimental ML bootstrap uses synthetic reference contacts, NOT a validated pretrained model. Calibrate on your device for personalized classification.'} Actual palm rejection varies by touchscreen.</div>
 <button id="calibrateBtn" class="primary-btn modal-action">Personalize touch detection</button>
 <h3>Backup</h3><p>Export your strokes and notebook structure as JSON. Imported image/PDF backgrounds remain on this device in the current release.</p><button id="backupBtn" class="subtle-btn">Export workspace JSON</button>
 <h3>Cloud synchronization</h3><p>${cloud.configured?'Cloud connection is available. Sign in to sync handwriting data.':'Cloud project not configured yet. Offline work is fully usable.'}</p><button id="cloudSettingsBtn" class="subtle-btn" ${cloud.configured?'':'disabled'}>Open cloud account</button>`);
 $('#inputMode').value=options.mode;$('#inputMode').addEventListener('change',e=>{options.mode=e.target.value;localStorage.setItem('inkspace-input-mode',options.mode);});
 $('#fingerMax').addEventListener('input',e=>{options.fingerMax=Number(e.target.value);$('#fingerMaxValue').textContent=e.target.value+'px';localStorage.setItem('inkspace-finger-max',e.target.value);});
 $('#calibrateBtn').addEventListener('click',calibrate);$('#cloudSettingsBtn').addEventListener('click',cloudModal);
 $('#backupBtn').addEventListener('click',()=>{downloadBlob(new Blob([JSON.stringify({version:1,documents:docs,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),'inkspace-backup.json');});
}
function calibrate(){
 let phase=0;let samples=[];
 const stages=[{title:'Writing finger or stylus',label:0,description:'Tap the area 8 times using your writing finger or stylus.'},{title:'Your palm',label:1,description:'Tap the area 8 times with the palm position you normally rest on the screen.'}];
 const show=()=>{
  const step=stages[phase];openModal('Personalize touch detection',`<p><strong>${step.title}</strong> — ${step.description}</p><div class="sample-area" id="sampleArea"></div><p id="sampleCount">0 of 8 contact samples collected</p><div class="note">Only contact geometry and pressure are used locally. No handwriting content is collected or uploaded.</div><button class="subtle-btn" id="cancelCalib">Cancel</button>`);
  let count=0;const area=$('#sampleArea');area.addEventListener('pointerdown',e=>{
   e.preventDefault();samples.push({features:extractFeatures(e),label:step.label});count++;$('#sampleCount').textContent=`${count} of 8 samples collected`;area.classList.add('sampling');
   if(count>=8){phase++;if(phase<2)setTimeout(show,220);else{
    const trained=trainPersonalModel(samples,800);if(trained){personalModel=trained;localStorage.setItem('inkspace-personal-model',JSON.stringify(trained));notice('Personalized model saved on this device');}closeModal();updateHeader();
   }}
  });$('#cancelCalib').addEventListener('click',closeModal);
 };show();
}
async function cloudModal(){
 if(!cloud.configured){notice('Supabase is not configured.');return;}
 openModal('Cloud account',`<p>Optional synchronization across devices. Your locally saved work remains available without signing in.</p>
 <label>Email<input type="email" id="cloudEmail" autocomplete="email" placeholder="you@example.com"/></label>
 <label>Password<input type="password" id="cloudPassword" autocomplete="current-password" placeholder="At least 6 characters"/></label>
 <div style="display:flex;gap:8px;margin-top:15px"><button class="primary-btn" id="loginBtn">Sign in</button><button class="subtle-btn" id="registerBtn">Create account</button></div>
 <p id="cloudMessage"></p><div class="note">Initial cloud sync includes strokes and document structure only. PDF and image files stay on the original device until file synchronization is added.</div>`);
 const email=()=>$('#cloudEmail').value.trim(),pass=()=>$('#cloudPassword').value;
 $('#loginBtn').addEventListener('click',async()=>{try{await cloud.signIn(email(),pass());$('#cloudMessage').textContent='Signed in. Synchronizing…';await doSync();closeModal();}catch(err){$('#cloudMessage').textContent=err.message;}});
 $('#registerBtn').addEventListener('click',async()=>{try{await cloud.signUp(email(),pass());$('#cloudMessage').textContent='Account created. Check email for confirmation if required, then sign in.';}catch(err){$('#cloudMessage').textContent=err.message;}});
}
async function doSync(){await flush();const result=await syncDocuments(cloud,docs,saveDocument);docs=await listDocuments();if(doc)doc=docs.find(d=>d.id===doc.id)||docs[0]||null;renderDocs();updateHeader();render();notice(`Synced: ${result.uploaded} uploaded · ${result.downloaded} downloaded · ${result.conflicts} conflicts`);}
$('#settingsBtn').addEventListener('click',settings);$('#syncBtn').addEventListener('click',()=>cloud.session?doSync().catch(err=>notice(err.message)):cloudModal());
window.addEventListener('resize',render);if('ResizeObserver' in window)new ResizeObserver(render).observe(workspace);
window.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});
window.addEventListener('beforeunload',()=>{if(dirty)saveDocument(doc);});
(async()=>{try{docs=await listDocuments();if(docs.length)doc=docs.sort((a,b)=>b.updatedAt-a.updatedAt)[0];}catch(err){notice('Storage error: '+err.message);}renderDocs();updateHeader();render();})();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(console.warn));
