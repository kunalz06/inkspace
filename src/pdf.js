import {saveAsset} from './db.js';
const PDF_VERSION='5.4.394';
const CDN=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDF_VERSION}/build/`;
/** On first PDF import PDF.js must be downloaded; subsequent rasterized pages are local. */
export async function importPDF(file,onProgress=()=>{}){
  let lib;
  try{lib=await import(/* @vite-ignore */ `${CDN}pdf.mjs`);}catch{throw new Error('PDF renderer could not load. Connect to the internet for the first PDF import.');}
  lib.GlobalWorkerOptions.workerSrc=`${CDN}pdf.worker.mjs`;
  const data=new Uint8Array(await file.arrayBuffer());
  const pdf=await lib.getDocument({data}).promise;
  const pages=[];
  const rawId=crypto.randomUUID();await saveAsset(rawId,file);
  for(let number=1;number<=pdf.numPages;number++){
    const page=await pdf.getPage(number);
    const unit=page.getViewport({scale:1});
    const scale=Math.min(1.6,960/unit.width);const viewport=page.getViewport({scale});
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',0.95));
    if(!blob)throw new Error('Unable to render PDF page');
    const id=crypto.randomUUID();await saveAsset(id,blob);
    pages.push({id:crypto.randomUUID(),width:canvas.width,height:canvas.height,assetId:id,strokes:[],background:'plain'});
    onProgress(number,pdf.numPages);
  }
  return {pages,rawId};
}
