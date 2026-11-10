/** Browser contact classification. Physical palm rejection is NOT guaranteed. */
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const sigmoid=x=>1/(1+Math.exp(-clamp(x,-35,35)));
export function extractFeatures(e){
  const w=Math.max(1,Number(e.width)||1),h=Math.max(1,Number(e.height)||1);
  return [Math.log1p(w*h)/9, Math.max(w,h)/70, 1-Math.min(w,h)/Math.max(w,h),clamp(Number(e.pressure)||0,0,1)];
}
export function scoreTouch(e){
  const w=Math.max(1,Number(e.width)||1),h=Math.max(1,Number(e.height)||1);
  return clamp(1-(Math.sqrt(w*h)-5)/28,0,1);
}
export function predictPalm(model,features){
  if(!model?.weights || model.weights.length!==features.length+1)return 0.5;
  const z=model.weights[0]+features.reduce((sum,x,i)=>sum+x*model.weights[i+1],0);
  return sigmoid(z);
}
/** Tiny on-device logistic regression, trained only on labeled calibration examples. */
export function trainPersonalModel(samples,epochs=400){
  const labeled=samples.filter(s=>Array.isArray(s.features)&&s.features.length===4&&(s.label===0||s.label===1));
  if(labeled.length<4 || !labeled.some(s=>s.label===0) || !labeled.some(s=>s.label===1))return null;
  const weights=[0,0,0,0,0], rate=1.2;
  for(let e=0;e<epochs;e++){
    const grads=[0,0,0,0,0];
    for(const s of labeled){const xs=[1,...s.features];const p=sigmoid(xs.reduce((a,x,i)=>a+x*weights[i],0));xs.forEach((x,i)=>grads[i]+=(p-s.label)*x);}
    weights.forEach((_,i)=>weights[i]-=rate*(grads[i]/labeled.length + (i?0.005*weights[i]:0)));
  }
  return {weights,trainedOn:labeled.length,kind:'personalized-logistic-v1',updatedAt:Date.now()};
}
/** Pen always wins; unknown browser contact geometry is explicitly best-effort. */
export function classifyPointer(e,{model=null,mode='auto',fingerMax=22}={}){
  if(e.pointerType==='mouse')return {action:'accept',reason:'mouse'};
  if(e.pointerType==='pen')return {action:'accept',reason:'active pen'};
  if(mode==='pen')return {action:'reject',reason:'pen-only mode'};
  const w=Math.max(1,Number(e.width)||1),h=Math.max(1,Number(e.height)||1);
  const size=Math.sqrt(w*h), max=Math.max(w,h), score=scoreTouch(e);
  // Never allow ML to override unambiguous huge contacts.
  if(max>fingerMax*1.65 || size>fingerMax*1.4)return {action:'reject',reason:'large contact',score};
  if(max<=fingerMax*.55 || size<=fingerMax*.46)return {action:'accept',reason:'small contact',score};
  if(model){const p=predictPalm(model,extractFeatures(e));if(p>.68)return {action:'reject',reason:'calibrated model',score:1-p};if(p<.43)return {action:'accept',reason:'calibrated model',score:1-p};}
  return {action:score>.58?'accept':'reject',reason:'rule fallback',score};
}
