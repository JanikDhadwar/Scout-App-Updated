import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { buildAnalytics } from './analytics.js';
import { exportTeamPresentation } from './exports.js';
import { createAnalystProvider } from './provider-adapter.js';

const forms=[{id:'f',questions:[{id:'n',text:'Auto pieces',type:'number'},{id:'notes',text:'Scout notes',type:'text'}]}];
function fixture(long=false){return buildAnalytics({forms,event:{event_key:'test',event_name:'Export Test'},reports:[{id:'source-1',event_key:'test',scouted_team:254,form_id:'f',match_key:'test_qm1',created_at:'2026-10-18T12:00:00Z',answers:{n:4,notes:long?('Long scouting evidence '.repeat(100)+'W'.repeat(180)+' END OF EVIDENCE'):'Observed useful capability'}}],asOf:'2026-10-18T13:00:00Z'});}

test('real PDF contains all sections, source IDs, timestamps and paginated long evidence',async()=>{
 const a=fixture(true),result=await exportTeamPresentation('pdf',a,a.teams[0],{download:false,generatedAt:'2026-10-18T14:00:00Z'});
 const text=new TextDecoder('latin1').decode(await result.blob.arrayBuffer());
 assert.equal(result.blob.type,'application/pdf');assert.match(text,/^%PDF/);assert.ok(result.pageCount>7);assert.equal((text.match(/\/Type \/Page\b/g)||[]).length,result.pageCount);
 for(const value of ['Performance overview','Scoring breakdown','Performance trends','Match history','Strategy summary','source-1','END OF EVIDENCE','2026-10-18T14:00:00Z'])assert.ok(text.includes(value),value);
 const dir=await mkdtemp(join(tmpdir(),'argus-export-'));try{await writeFile(join(dir,result.filename),new Uint8Array(await result.blob.arrayBuffer()));}finally{await rm(dir,{recursive:true});}
});

test('real editable PPTX contains sections, a native data chart and evidence without lost long text',async()=>{
 const a=fixture(true),result=await exportTeamPresentation('pptx',a,a.teams[0],{download:false,generatedAt:'2026-10-18T14:00:00Z'});
 const zip=await JSZip.loadAsync(await result.blob.arrayBuffer()),slides=Object.keys(zip.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name));
 assert.equal(slides.length,result.pageCount);assert.ok(slides.length>7);
 const xml=(await Promise.all(slides.map(name=>zip.file(name).async('string')))).join('\n');
 for(const value of ['Performance overview','Scoring breakdown','Performance trends','Match history','Strategy summary','source-1','END OF EVIDENCE','2026-10-18T14:00:00Z'])assert.ok(xml.includes(value),value);
 assert.ok(Object.keys(zip.files).some(name=>/^ppt\/charts\/chart\d+\.xml$/.test(name)));assert.match(xml,/<a:t>/);
});

test('missing data exports remain valid and invalid formats fail',async()=>{
 const a=buildAnalytics({teams:[{team_number:254}]}),result=await exportTeamPresentation('pdf',a,a.teams[0],{download:false});
 assert.equal(result.pageCount,7);await assert.rejects(exportTeamPresentation('csv',a,a.teams[0]),/format/i);
});

test('external provider is explicitly unavailable and never invokes a transport',async()=>{
 const provider=createAnalystProvider();assert.equal(provider.status,'unconfigured');assert.equal(provider.mode,'local');
 await assert.rejects(provider.explain({private:'scouting'}),/disabled|unconfigured/i);
});
