import { presentationSections, formatValue } from './analytics.js';
import {presentationSnapshot} from './presentation-model.js';

const colors={background:'0B1018',text:'F2F5FA',muted:'A7B5C8',accent:'C83E4D'};
// Exports use a portable font. Preserve all evidence while normalizing unsupported glyphs.
const portable=value=>String(value ?? '').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/→/g,' -> ').replace(/·/g,' / ').replace(/[^\x20-\x7e\n\r\t\u00a0-\u00ff]/g,'?');
// Conservative font-width units keep long uppercase IDs inside both PDF and PPTX margins.
const width=value=>[...value].reduce((sum,char)=>sum+(/[WM@%]/.test(char)?1.8:/[A-Z]/.test(char)?1.3:/[il.,'!|]/.test(char)?0.5:1),0);
function wrap(value,limit=80){
 const lines=[];
 for(const paragraph of portable(value).split(/\r?\n/)){
  let line='';
  for(let word of paragraph.split(/\s+/)){
   while(width(word)>limit){
    if(line){lines.push(line);line='';}
    let split=1;while(split<word.length&&width(word.slice(0,split+1))<=limit)split++;
    lines.push(word.slice(0,split));word=word.slice(split);
   }
   if(width(line)+width(word)+1>limit){lines.push(line);line=word;}else line+=(line?' ':'')+word;
  }
  lines.push(line);
 }
 return lines;
}
function pagesFor(analytics,team){
 const pages=[];
 for(const section of presentationSections(analytics,team)){
  const lines=section.lines.flatMap(line=>wrap(line));
  if(section.sourceIds.length)lines.push(...wrap(`Evidence report IDs: ${section.sourceIds.join(', ')}`));
  for(let offset=0;offset<Math.max(lines.length,1);offset+=11)pages.push({...section,title:portable(section.title)+(offset?' (continued)':''),subtitle:portable(section.subtitle),lines:lines.slice(offset,offset+11)});
  if(section.title==='Performance trends'){
   for(const metric of Object.values(team.metrics).filter(item=>item.mean!=null&&item.values?.length)){
    for(let offset=0;offset<metric.values.length;offset+=8){
     const values=metric.values.slice(offset,offset+8);
     const context=wrap(`${metric.label} / ${metric.unit || 'question units'} / n=${metric.n}. Per-match medians; unlinked reports remain separate. Sources: ${values.flatMap(item=>item.sourceIds).join(', ')}`);
     pages.push({title:'Match-by-match observations',subtitle:'Question-specific measurements; no inferred scoring',chart:values,lines:context.slice(0,2)});
     for(let detail=2;detail<context.length;detail+=11)pages.push({title:'Trend evidence (continued)',subtitle:'Full metric label and source references',lines:context.slice(detail,detail+11)});
    }
   }
  }
 }
 return pages;
}
function download(blob,filename){
 const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
/** Builds the same evidence sections used by interactive presentation. Never fetches external data. */
export async function exportTeamPresentation(format,analytics,team,{download:shouldDownload=true,generatedAt=new Date().toISOString(),teamNumbers,includeNotes=false,picklists,onProgress=()=>{}}={}){
 if(!['pdf','pptx'].includes(format))throw new Error('Unsupported presentation export format.');
 if(!team)throw new Error('Select a team to export.');
 analytics=presentationSnapshot(analytics,{includeNotes,picklists});
 team=analytics.teams.find(row=>row.teamNumber===String(team.teamNumber));
 const chosen=teamNumbers||[team.teamNumber];
 if(!chosen.length||chosen.length>1000||new Set(chosen.map(String)).size!==chosen.length)throw new Error('Choose between 1 and 1000 distinct event teams.');
 const pages=chosen.flatMap(number=>{const item=analytics.teams.find(row=>row.teamNumber===String(number));if(!item)throw new Error('A presentation team is outside the snapshot.');return pagesFor(analytics,item).map(page=>({...page,team:item}));});
 const event=portable(analytics.event?.name || 'No event selected');
 let blob;
 if(format==='pdf'){
  const {jsPDF}=await import('jspdf');
  const pdf=new jsPDF({orientation:'landscape',unit:'pt',format:[960,540],compress:false});
  pdf.setProperties({title:`ARGUS Team ${team.teamNumber}`,subject:event,author:'ARGUS'});
  pages.forEach((page,index)=>{
   const metadata=`Team ${page.team.teamNumber} / ${event} / ${page.team.reportCount} reports / ${page.team.matchCount} linked matches`;
   const freshness=`Latest report: ${page.team.confidence.freshness || 'Unavailable'} / Generated: ${generatedAt}`;
   onProgress({completed:index,total:pages.length});
   if(index)pdf.addPage([960,540],'landscape');
   pdf.setFillColor(`#${colors.background}`);pdf.rect(0,0,960,540,'F');
   pdf.setTextColor(`#${colors.accent}`);pdf.setFontSize(13);pdf.text('ARGUS / TEAM INTELLIGENCE',48,40);
   pdf.setTextColor(`#${colors.text}`);pdf.setFontSize(30);pdf.text(wrap(page.title,48),48,87);
   pdf.setTextColor(`#${colors.muted}`);pdf.setFontSize(13);pdf.text(wrap(page.subtitle,105),48,116);
   if(page.chart){
    const values=page.chart,max=Math.max(1,...values.map(item=>Math.abs(item.value)));
    // Zero baseline permits signed observations without implying missing values are zero.
    const baseline=310,scale=120/max,step=840/values.length;
    pdf.setDrawColor(`#${colors.muted}`);pdf.line(60,baseline,900,baseline);
    values.forEach((item,i)=>{const x=60+i*step,height=item.value*scale;pdf.setFillColor('#4D73F5');pdf.rect(x+8,height>=0?baseline-height:baseline,Math.max(12,step-20),Math.abs(height),'F');pdf.setTextColor(`#${colors.text}`);pdf.setFontSize(13);pdf.text(formatValue(item.value),x+8,height>=0?baseline-height-10:baseline-height+16);pdf.setFontSize(10);pdf.text(wrap(item.matchKey || `Report ${i+1}`,17).slice(0,2),x+8,454);});
    pdf.setTextColor(`#${colors.muted}`);pdf.setFontSize(10);pdf.text(page.lines.slice(0,2),48,150);
   }else{pdf.setTextColor(`#${colors.text}`);pdf.setFontSize(19);pdf.text(page.lines,48,163,{lineHeightFactor:1.43});}
   pdf.setTextColor(`#${colors.muted}`);pdf.setFontSize(9);pdf.text(wrap(metadata,145).slice(0,2),48,488);pdf.text(wrap(freshness,145).slice(0,2),48,508);pdf.text(`${index+1} / ${pages.length}`,900,528,{align:'right'});
  });
  blob=pdf.output('blob');
 }else{
  const {default:PptxGenJS}=await import('pptxgenjs');
  const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='ARGUS';pptx.subject=event;pptx.title=`Team ${team.teamNumber} scouting presentation`;pptx.company='ARGUS';pptx.lang='en-US';
  const text=(slide,value,x,y,w,h,size,color=colors.text)=>slide.addText(value,{x,y,w,h,fontFace:'Arial',fontSize:size,color,margin:0,breakLine:false,vertAlign:'top',paraSpaceAfter:0});
  pages.forEach((page,index)=>{
   const metadata=`Team ${page.team.teamNumber} / ${event} / ${page.team.reportCount} reports / ${page.team.matchCount} linked matches`;
   const freshness=`Latest report: ${page.team.confidence.freshness || 'Unavailable'} / Generated: ${generatedAt}`;
   onProgress({completed:index,total:pages.length});
   const slide=pptx.addSlide();slide.background={color:colors.background};
   text(slide,'ARGUS / TEAM INTELLIGENCE',0.66,0.28,12,0.25,12,colors.accent);
   text(slide,page.title,0.66,0.77,12,0.56,30);
   text(slide,page.subtitle,0.66,1.38,12,0.42,13,colors.muted);
   if(page.chart){
    slide.addChart(pptx.ChartType.bar,[{name:page.subtitle,labels:page.chart.map((item,i)=>portable(item.matchKey || `Report ${i+1}`)),values:page.chart.map(item=>item.value)}],{x:0.7,y:2.15,w:11.9,h:4.2,catAxisLabelColor:colors.muted,catAxisLabelFontSize:11,valAxisLabelColor:colors.muted,valAxisLabelFontSize:11,showValue:true,dataLabelColor:colors.text,dataLabelPosition:'outEnd',chartColors:['4D73F5'],chartArea:{fill:{color:colors.background}},plotArea:{fill:{color:colors.background}},showLegend:false,showTitle:false,showCatName:false,showBorder:false,showCatNameInLabel:false,showShadow:false,showValueInLabel:true,catAxisLabelRotate:0,showMarker:false,showLine:false,showCatNameInLegend:false,showPercent:false,valGridLine:{color:'263244'},showCatNameInTitle:false});
    text(slide,page.lines.slice(0,2).join('\n'),0.66,1.86,12,0.4,10,colors.muted);
   }else text(slide,page.lines.join('\n'),0.66,2.04,12,4.18,18);
   text(slide,wrap(metadata,145).slice(0,2).join('\n'),0.66,6.77,11.9,0.25,9,colors.muted);
   text(slide,wrap(freshness,145).slice(0,2).join('\n'),0.66,7.06,11.9,0.25,8,colors.muted);
   text(slide,`${index+1} / ${pages.length}`,12,7.26,0.65,0.15,8,colors.muted);
   slide.addNotes([`Report evidence: ${page.sourceIds?.join(', ') || page.chart?.flatMap(item=>item.sourceIds).join(', ') || 'None'}`,freshness]);
  });
  const bytes=await pptx.write({outputType:'arraybuffer'});blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
 }
 const filename=`argus-team-${String(teamNumbers?'all':team.teamNumber).replace(/[^a-z0-9-]/gi,'')}-${String(analytics.event?.key || 'unassigned').replace(/[^a-z0-9-]/gi,'')}.${format}`;
 onProgress({completed:pages.length,total:pages.length});
 if(shouldDownload&&typeof document!=='undefined')download(blob,filename);
 return {blob,filename,pageCount:pages.length};
}
