import fs from 'node:fs';import path from 'node:path';
const root=process.cwd(),dist=path.join(root,'dist');fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});
for(const item of ['index.html','manifest.webmanifest','sw.js','src','assets'])fs.cpSync(path.join(root,item),path.join(dist,item),{recursive:true});
const conf={supabaseUrl:process.env.VITE_SUPABASE_URL||'',supabasePublishableKey:process.env.VITE_SUPABASE_PUBLISHABLE_KEY||''};
fs.writeFileSync(path.join(dist,'config.js'),`window.INKSPACE_CONFIG=${JSON.stringify(conf).replace(/</g,'\\u003c')};\n`);
console.log('Built InkSpace to dist; cloud '+(conf.supabaseUrl&&conf.supabasePublishableKey?'configured':'not configured'));
