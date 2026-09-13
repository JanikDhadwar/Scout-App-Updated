import { useEffect, useRef, useState } from 'react';

export function ReportPhoto({ question, value, onChange }) {
  const [busy,setBusy]=useState(false), [error,setError]=useState('');
  async function choose(event) {
    const file=event.target.files?.[0];
    if(!file)return;
    setBusy(true);setError('');
    const url=URL.createObjectURL(file);
    try {
      const image=new Image();
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
      const ratio=Math.min(1,1600/Math.max(image.width,image.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      onChange(canvas.toDataURL('image/jpeg',0.82));
    } catch {setError('Could not read that photo. Choose a JPEG or PNG image.');}
    finally{URL.revokeObjectURL(url);setBusy(false);event.target.value='';}
  }
  return <div className="photo-input"><label className="quiet-button photo-picker">{busy?'Preparing photo…':value?'Replace photo':'Take or choose photo'}<input aria-label={question.text} type="file" accept="image/*" capture="environment" onChange={choose} disabled={busy}/></label>{error&&<p role="alert" className="error-text">{error}</p>}{value&&<><img src={value} alt={question.text}/><button className="text-button" onClick={()=>onChange(null)}>Remove photo</button></>}</div>;
}

export function ReportDrawing({ question, value, onChange }) {
  const canvasRef=useRef(null), drawing=useRef(false), background=useRef(null), initial=useRef(value);
  const [ready,setReady]=useState(false);
  const paintBackground=()=>{
    const canvas=canvasRef.current, ctx=canvas.getContext('2d');
    ctx.fillStyle='#202328';ctx.fillRect(0,0,800,400);
    if(background.current)ctx.drawImage(background.current,0,0,800,400);
    else {
      ctx.strokeStyle='#6c727d';ctx.lineWidth=2;ctx.strokeRect(16,16,768,368);
      ctx.beginPath();ctx.moveTo(400,16);ctx.lineTo(400,384);ctx.stroke();
      ctx.beginPath();ctx.arc(400,200,52,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#b82e3944';ctx.fillRect(16,16,112,368);
      ctx.fillStyle='#477dae44';ctx.fillRect(672,16,112,368);
    }
  };
  useEffect(()=>{
    let active=true;
    const image=new Image();image.crossOrigin='anonymous';
    const url=initial.current || question.imageUrl;
    const done=()=>{if(!active)return;paintBackground();if(initial.current&&image.complete&&image.naturalWidth)canvasRef.current.getContext('2d').drawImage(image,0,0,800,400);setReady(true);};
    if(url){image.onload=()=>{if(!initial.current)background.current=image;done();};image.onerror=done;image.src=url;}else done();
    return ()=>{active=false;};
    // A saved drawing is restored once when the question is opened.
  },[question.imageUrl]);
  const point=event=>{const rect=canvasRef.current.getBoundingClientRect();return [(event.clientX-rect.left)*800/rect.width,(event.clientY-rect.top)*400/rect.height];};
  function start(event){if(!ready)return;event.preventDefault();drawing.current=true;event.currentTarget.setPointerCapture(event.pointerId);const [x,y]=point(event),ctx=canvasRef.current.getContext('2d');ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+.1,y+.1);ctx.strokeStyle='#ff858c';ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
  function move(event){if(!drawing.current)return;const [x,y]=point(event),ctx=canvasRef.current.getContext('2d');ctx.lineTo(x,y);ctx.stroke();}
  function stop(){if(!drawing.current)return;drawing.current=false;onChange(canvasRef.current.toDataURL('image/png'));}
  return <div><canvas ref={canvasRef} className="drawing-canvas" width="800" height="400" aria-label={question.text} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}/><button className="text-button" onClick={()=>{paintBackground();initial.current=null;onChange(null);}}>Clear drawing</button><span className="field-help"> Draw with your finger, pencil, or mouse.</span></div>;
}
