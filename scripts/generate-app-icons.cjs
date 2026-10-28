// Render the existing Argus SVG without adding another image dependency or
// changing the mark. Run locally when app-icon.svg changes; commit the PNGs.
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const app=path.resolve(__dirname,'../Clasue-scout-app');
const {chromium}=createRequire(path.join(app,'package.json'))('playwright');

async function generate(){
  const source=fs.readFileSync(path.join(app,'public/app-icon.svg'),'utf8');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const [filename,size,safe]of [['app-icon-192.png',192,1],['app-icon-512.png',512,1],['app-icon-maskable-512.png',512,0.8],['apple-touch-icon.png',180,1]]){
      const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
      await page.setContent(`<html><body style="margin:0;width:100vw;height:100vh;background:#1e2024;display:grid;place-items:center"><img alt="" style="display:block;width:${safe*100}%;height:${safe*100}%" src="data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}"></body></html>`);
      await page.locator('img').evaluate(async image=>{await image.decode();});
      await page.screenshot({path:path.join(app,'public',filename),type:'png',animations:'disabled'});
      await page.close();console.log(`Rendered ${filename} (${size}x${size})`);
    }
  }finally{await browser.close();}
}
if(require.main===module)generate().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={generate};
