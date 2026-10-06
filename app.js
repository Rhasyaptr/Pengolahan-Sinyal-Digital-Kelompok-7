/* =====================================================================
   D-Clean: DCT Signal Engine  |  Kelompok 7, PSD
   Struktur berkas ini:
     1. DCT-II / IDCT ortonormal (matriks basis N x N, dihitung sekali)
     2. Pembangkit sinyal sintesis (noise ber-seed agar hasil uji dapat diulang)
     3. Update utama: DCT -> filter K -> IDCT -> metrik (MSE, SNR, energi)
     4. Audio: parser WAV, pemutaran asli vs hasil filter
     5. Grafik (Chart.js), bola 3D, kontrol, eksperimen sapuan K, gambar sinyal, demo
   ===================================================================== */
const N=256, RM=matchMedia('(prefers-reduced-motion:reduce)').matches;
// ---------- Judul: huruf muncul berurutan ----------
const tEl=document.getElementById('title');
let li=0;'D-Clean Signal Engine'.split(' ').forEach(w=>{const b=document.createElement('b');w.split('').forEach(ch=>{const sp=document.createElement('span');sp.textContent=ch;sp.style.animationDelay=(.3+li++*.045)+'s';b.appendChild(sp)});tEl.appendChild(b);tEl.appendChild(document.createTextNode(' '))});

// ---------- PRNG ber-seed (mulberry32): noise sama untuk seed yang sama ----------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

// ---------- DCT ----------
const t=Array.from({length:N},(_,i)=>i/N);
let sig=new Array(N).fill(0),dct=sig.slice(),rec=sig.slice(),mxS=1,mxD=1;
let inputMode='manual',fullAudioBuffer=null,visualAudioData=new Array(N).fill(0),currentSignal=null,chart1,chart2,chart3;
const Cm=new Float64Array(N*N);for(let k=0;k<N;k++){const a=k?Math.sqrt(2/N):Math.sqrt(1/N);for(let n=0;n<N;n++)Cm[k*N+n]=a*Math.cos(Math.PI/N*(n+.5)*k)}
let orthoErr=0;for(let a=0;a<N;a++)for(let b=a;b<N;b++){let q=0;for(let n=0;n<N;n++)q+=Cm[a*N+n]*Cm[b*N+n];orthoErr=Math.max(orthoErr,Math.abs(q-(a===b?1:0)))}
function getDCT(x){const X=new Array(N);for(let k=0;k<N;k++){let q=0;const o=k*N;for(let n=0;n<N;n++)q+=x[n]*Cm[o+n];X[k]=q}return X}
function getIDCT(X){const x=new Array(N).fill(0);for(let k=0;k<N;k++){const v=X[k];if(!v)continue;const o=k*N;for(let n=0;n<N;n++)x[n]+=v*Cm[o+n]}return x}
const mse=(a,b)=>a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length;

// ---------- Angka bergulir ----------
const prev={};
function roll(id,to,fmt,els){const from=prev[id]??to;prev[id]=to;const t0=performance.now();(function f(now){const p=Math.min((now-t0)/450,1),e=1-Math.pow(1-p,3),v=from+(to-from)*e;els.forEach(x=>{const o=document.getElementById(x);if(o)o.textContent=fmt(v)});if(p<1)requestAnimationFrame(f)})(t0)}

let shape='sine',live=false,liveT=null,hk=1,aGain=1,segPos=.33,audioSR=44100,AC=null,curSrc=null,chartEnergy,KS=[4,8,16,32,64,128,256],chartSweep,lastCsv='';
function base(x,f1,f2){const w=f=>2*Math.PI*f*x;
  if(shape==='square')return Math.sign(Math.sin(w(f1)))+.4*Math.sign(Math.sin(w(f2)));
  if(shape==='saw')return 2*((f1*x)%1)-1+.4*(2*((f2*x)%1)-1);
  if(shape==='chirp')return Math.sin(2*Math.PI*(f1*x+(f2-f1)*x*x/2));
  return Math.sin(w(f1))+.7*Math.sin(w(f2))}
function update(){
  const comp=+document.getElementById('comp').value;
  document.getElementById('valComp').textContent=comp;
  if(inputMode==='audio'){sig=visualAudioData}else if(inputMode==='draw'){sig=drawData}
  else{
    const f1=+freq1.value,f2=+freq2.value,na=+noise.value,sd=Math.max(0,Math.floor(+seedIn.value)||0);
    valFreq1.textContent=f1;valFreq2.textContent=f2;valNoise.textContent=na;
    sF1.textContent=f1+' Hz';sF2.textContent=f2+' Hz';
    if(live||!currentSignal||currentSignal.f1!==f1||currentSignal.f2!==f2||currentSignal.na!==na||currentSignal.sh!==shape||currentSignal.sd!==sd)
      {const cl=t.map(x=>base(x,f1,f2)),rnd=live?Math.random:mulberry32(sd);currentSignal={f1,f2,na,sd,sh:shape,clean:cl,data:cl.map(v=>v+(rnd()*2-1)*na)}};
    sig=currentSignal.data;
  }
  dct=getDCT(sig);rec=getIDCT(dct.map((v,i)=>i<comp?v:0));
  mxS=Math.max(.001,...sig.map(Math.abs),...rec.map(Math.abs));mxD=Math.max(.001,...dct.map(Math.abs));
  const pct=comp/N*100,m=mse(sig,rec);
  const eT=dct.reduce((q,v)=>q+v*v,0)||1,eK=dct.reduce((q,v,i)=>q+(i<comp?v*v:0),0),en=eK/eT*100;
  const err=sig.reduce((q,v,i)=>q+(v-rec[i])**2,0)||1e-12,pw=sig.reduce((q,v)=>q+v*v,0);
  valEnergy.textContent=en.toFixed(1)+'%';ring.style.strokeDashoffset=326.7*(1-en/100);
  valSNR.textContent=pw>1e-9?Math.min(99,10*Math.log10(pw/err)).toFixed(1)+' dB':'—';
  const chk=(el,v)=>{el.textContent=v.toExponential(1)+(v<1e-9?' ✓':' ✗');el.style.color=v<1e-9?'#3dffa0':'#ff2a6d'};
  chk(vO,orthoErr);chk(vP,Math.abs(pw-eT));chk(vR,mse(sig,getIDCT(dct)));
  let cu=0;chartEnergy.data.labels=t.map((_,i)=>i);chartEnergy.data.datasets[0].data=dct.map(v=>(cu+=v*v)/eT*100);chartEnergy.update('none');
  fcInfo.textContent=inputMode==='audio'?'Setara low-pass ≈ '+Math.round(comp/N*audioSR/2)+' Hz (fs = '+audioSR+' Hz). Amplitudo audio dinormalisasi, MSE dalam satuan relatif.':'';
  drawBasis(hk);sweep(comp);
  roll('c',comp,v=>Math.round(v),['valRetained','sKeep']);
  roll('p',pct,v=>v.toFixed(2)+'%',['valPercentage','sPct']);
  roll('m',m,v=>v.toFixed(6),['valMSE','sMse']);
  chart1.data.labels=chart2.data.labels=t.map((_,i)=>i);
  chart1.data.datasets[0].data=sig;chart1.data.datasets[1].data=rec;
  chart2.data.datasets[0].data=dct;chart2.data.datasets[0].backgroundColor=dct.map((_,i)=>i<comp?'#00f0ff':'rgba(255,255,255,.1)');
  const m0=live?'none':undefined;chart1.update(m0);chart2.update(m0);
}

// ---------- Audio ----------
function ctx(){AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();return AC}
function parseWav(ab){
  const v=new DataView(ab),tag=o=>String.fromCharCode(v.getUint8(o),v.getUint8(o+1),v.getUint8(o+2),v.getUint8(o+3));
  if(ab.byteLength<44||tag(0)!=='RIFF'||tag(8)!=='WAVE')throw new Error('berkas bukan WAV');
  let o=12,fmt=null,dOff=0,dLen=0;
  while(o+8<=ab.byteLength){const id=tag(o),sz=v.getUint32(o+4,true);
    if(id==='fmt '){let f=v.getUint16(o+8,true);const ch=v.getUint16(o+10,true),sr=v.getUint32(o+12,true),bits=v.getUint16(o+22,true);if(f===0xFFFE&&sz>=26)f=v.getUint16(o+32,true);fmt={f,ch,sr,bits}}
    else if(id==='data'){dOff=o+8;dLen=Math.min(sz,ab.byteLength-dOff);break}
    o+=8+sz+(sz&1)}
  if(!fmt||!dOff)throw new Error('header WAV tidak lengkap');
  const{f,ch,sr,bits}=fmt,B=bits/8;
  if(!((f===1&&[8,16,24,32].includes(bits))||(f===3&&[32,64].includes(bits))))throw new Error('format tidak didukung (kode '+f+', '+bits+'-bit)');
  const n=Math.floor(dLen/(B*ch)),out=new Float32Array(n);
  for(let i=0;i<n;i++){let q=0;for(let c=0;c<ch;c++){const p=dOff+(i*ch+c)*B;let x;
    if(f===3)x=bits===32?v.getFloat32(p,true):v.getFloat64(p,true);
    else if(bits===8)x=(v.getUint8(p)-128)/128;
    else if(bits===16)x=v.getInt16(p,true)/32768;
    else if(bits===24){x=(v.getUint8(p+2)<<16)|(v.getUint8(p+1)<<8)|v.getUint8(p);if(x&0x800000)x-=0x1000000;x/=8388608}
    else x=v.getInt32(p,true)/2147483648;
    q+=x}out[i]=q/ch}
  return{data:out,sr,ch}}
async function loadAudio(file){
  uploadText.textContent='Memproses: '+file.name;
  try{
    const ab=await file.arrayBuffer();let r;
    try{r=parseWav(ab)}catch(e1){
      const d=await ctx().decodeAudioData(ab.slice(0)),cs=[...Array(d.numberOfChannels).keys()].map(i=>d.getChannelData(i)),m=new Float32Array(d.length);
      for(let i=0;i<d.length;i++){let q=0;cs.forEach(c=>q+=c[i]);m[i]=q/cs.length}
      r={data:m,sr:d.sampleRate,ch:d.numberOfChannels}}
    if(r.data.length<N)throw new Error('audio terlalu pendek (minimal '+N+' sampel)');
    setAudio(r,file.name)
  }catch(err){uploadText.textContent='⚠ Gagal: '+err.message+'. Coba .wav PCM lain atau klik "Pakai contoh audio".'}
}
function setAudio(r,name){
  fullAudioBuffer=r.data;audioSR=r.sr;segPos=.33;inputMode='audio';currentSignal=null;
  let pk=.001;for(let i=0;i<r.data.length;i+=3){const a=Math.abs(r.data[i]);if(a>pk)pk=a}aGain=1.5/pk;
  uploadText.textContent='✅ '+name+' · '+r.sr+' Hz · '+(r.data.length/r.sr).toFixed(2)+' dtk';
  audioBox.hidden=false;cutSeg();update();drawOv()}
function cutSeg(){const st=Math.floor(segPos*Math.max(0,fullAudioBuffer.length-N));for(let i=0;i<N;i++)visualAudioData[i]=fullAudioBuffer[st+i]*aGain}
function drawOv(){const w=ov.clientWidth||300,h=56,d=Math.min(devicePixelRatio||1,2);ov.width=w*d;ov.height=h*d;const q=ov.getContext('2d');q.setTransform(d,0,0,d,0,0);
  const L=fullAudioBuffer.length;q.fillStyle='rgba(255,255,255,.04)';q.fillRect(0,0,w,h);q.strokeStyle='rgba(0,240,255,.75)';q.beginPath();
  for(let x=0;x<w;x++){const a=Math.floor(x/w*L),e=Math.max(a+1,Math.floor((x+1)/w*L)),stp=Math.max(1,Math.floor((e-a)/30));let mn=1,mx=-1;
    for(let i=a;i<e;i+=stp){const u=fullAudioBuffer[i]*aGain/1.5;if(u<mn)mn=u;if(u>mx)mx=u}q.moveTo(x+.5,h/2-mx*h/2);q.lineTo(x+.5,h/2-mn*h/2)}
  q.stroke();const st=Math.floor(segPos*Math.max(0,L-N));q.fillStyle='rgba(177,75,244,.55)';q.fillRect(st/L*w-1,0,Math.max(4,N/L*w),h)}
let ovD=false;const ovSet=e=>{const r=ov.getBoundingClientRect();segPos=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));cutSeg();update();drawOv()};
ov.addEventListener('pointerdown',e=>{ovD=true;ov.setPointerCapture(e.pointerId);ovSet(e)});ov.addEventListener('pointermove',e=>{if(ovD)ovSet(e)});ov.addEventListener('pointerup',()=>ovD=false);
addEventListener('resize',()=>{if(fullAudioBuffer&&!audioBox.hidden)drawOv()});
audioInput.addEventListener('change',e=>{const f=e.target.files[0];if(f)loadAudio(f);e.target.value=''});
['dragover','dragenter'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.style.borderColor='var(--cy)'}));
drop.addEventListener('dragleave',()=>drop.style.borderColor='');
drop.addEventListener('drop',e=>{e.preventDefault();drop.style.borderColor='';const f=e.dataTransfer.files[0];if(f)loadAudio(f)});
sampleBtn.onclick=()=>{const sr=22050,L=sr*3,d=new Float32Array(L);for(let i=0;i<L;i++){const x=i/sr;d[i]=.5*Math.sin(2*Math.PI*(220+8*Math.sin(2*Math.PI*5*x))*x)+.3*Math.sin(2*Math.PI*660*x)+.2*Math.sin(2*Math.PI*1760*x)*(Math.sin(2*Math.PI*2*x)>0?1:.3)+(Math.random()*2-1)*.08}setAudio({data:d,sr,ch:1},'contoh-audio-sintetis')};
const MAX_PLAY=15;
let playRaf=0;
function stopSuara(){cancelAnimationFrame(playRaf);if(curSrc){try{curSrc.stop()}catch(e){}curSrc=null}}
function putarSuara(j){
  const c=ctx();stopSuara();
  let buf,dur=0;
  if(inputMode==='audio'&&fullAudioBuffer){
    // putar berkas dari awal, dibatasi MAX_PLAY detik agar halaman tidak macet (DCT O(N^2) per blok)
    const sr=audioSR,L=Math.min(fullAudioBuffer.length,Math.floor(sr*MAX_PLAY)),d=new Float32Array(L);
    if(j==='input')d.set(fullAudioBuffer.subarray(0,L));
    else{const cp=+document.getElementById('comp').value,ch=new Array(N);
      for(let b=0;b<L;b+=N){for(let i=0;i<N;i++)ch[i]=b+i<L?fullAudioBuffer[b+i]:0;
        const X=new Array(N).fill(0);for(let k=0;k<cp;k++){let q=0;const o=k*N;for(let n=0;n<N;n++)q+=ch[n]*Cm[o+n];X[k]=q}
        const r=getIDCT(X);for(let i=0;i<N&&b+i<L;i++)d[b+i]=r[i]}}
    buf=c.createBuffer(1,L,sr);buf.copyToChannel(d,0);dur=L/sr
  }else{
    const data=j==='input'?sig:rec,fc=Math.floor(c.sampleRate*2);buf=c.createBuffer(1,fc,c.sampleRate);const d=buf.getChannelData(0);
    let mx=.001;data.forEach(v=>{if(Math.abs(v)>mx)mx=Math.abs(v)});for(let i=0;i<fc;i++)d[i]=data[i%data.length]/mx*.5}
  const src=c.createBufferSource();src.buffer=buf;src.connect(c.destination);curSrc=src;const t0=c.currentTime+.02;src.start(t0);
  // jendela analisis mengikuti posisi pemutaran
  if(dur>0){let last=0;(function f(now){if(curSrc!==src)return;const el=c.currentTime-t0;if(el>=dur)return;
    if(now-last>100){last=now;const st=Math.max(0,Math.min(fullAudioBuffer.length-N,Math.floor(el*audioSR)));segPos=st/Math.max(1,fullAudioBuffer.length-N);cutSeg();update();drawOv()}
    playRaf=requestAnimationFrame(f)})(0)}}
['freq1','freq2','noise','seedIn'].forEach(id=>document.getElementById(id).addEventListener('input',()=>{inputMode='manual';uploadText.textContent='📁 Impor atau seret berkas .wav ke sini';update()}));
comp.addEventListener('input',update);

// ---------- Grafik ----------
Chart.defaults.font.family='Inter';Chart.defaults.color='#777';Chart.defaults.scale.grid.color='rgba(255,255,255,.04)';
const opt={animation:{duration:400,easing:'easeOutQuart'},plugins:{legend:{display:false},tooltip:{mode:'index',intersect:false}},scales:{x:{border:{display:false}},y:{border:{display:false}}}};
const line=(c,bg,w)=>({borderColor:c,backgroundColor:bg,borderWidth:w,pointRadius:0,fill:true,tension:0,data:[]});
chart1=new Chart(chartInput,{type:'line',data:{labels:[],datasets:[line('rgba(255,42,109,.75)','rgba(255,42,109,.08)',1.5),line('#00f0ff','rgba(0,240,255,.07)',2.5)]},options:opt});
const cut={id:'cut',afterDatasetsDraw(c){const x=c.scales.x.getPixelForValue(+document.getElementById('comp').value-.5),{top,bottom,left}=c.chartArea,g=c.ctx;
  g.save();g.fillStyle='rgba(177,75,244,.07)';g.fillRect(left,top,x-left,bottom-top);
  g.strokeStyle='#b14bf4';g.lineWidth=2;g.setLineDash([6,5]);g.shadowColor='#b14bf4';g.shadowBlur=14;g.beginPath();g.moveTo(x,top);g.lineTo(x,bottom);g.stroke();
  g.setLineDash([]);g.fillStyle='#fff';g.beginPath();g.arc(x,(top+bottom)/2,9,0,6.3);g.fill();
  g.fillStyle='#000';g.font='700 10px Inter';g.textAlign='center';g.fillText('⇔',x,(top+bottom)/2+3.5);g.restore()}};
chart2=new Chart(chartDCT,{type:'bar',data:{labels:[],datasets:[{backgroundColor:'#00f0ff',data:[],barPercentage:1,categoryPercentage:1}]},options:opt,plugins:[cut]});
const cut2={id:'cut2',afterDatasetsDraw(c){const x=c.scales.x.getPixelForValue(+document.getElementById('comp').value-1),{top,bottom}=c.chartArea,g=c.ctx;g.save();g.strokeStyle='#b14bf4';g.setLineDash([5,4]);g.lineWidth=1.5;g.beginPath();g.moveTo(x,top);g.lineTo(x,bottom);g.stroke();g.restore()}};
chartEnergy=new Chart(document.getElementById('chartEnergy'),{type:'line',data:{labels:[],datasets:[line('#00f0ff','rgba(0,240,255,.12)',2)]},options:{...opt,animation:false,scales:{x:{border:{display:false}},y:{min:0,max:100,border:{display:false},ticks:{callback:v=>v+'%'}}}},plugins:[cut2]});
chartSweep=new Chart(document.getElementById('chartSweep'),{type:'line',data:{labels:KS,datasets:[{...line('#ff2a6d','rgba(255,42,109,.08)',2),pointRadius:4},{...line('#00f0ff','rgba(0,240,255,.08)',2),pointRadius:4}]},options:opt});
function drawBasis(k){hk=k;bk.textContent=k;const w=basis.clientWidth||300,h=120,d=Math.min(devicePixelRatio||1,2);basis.width=w*d;basis.height=h*d;const q=basis.getContext('2d');q.setTransform(d,0,0,d,0,0);
  q.strokeStyle='rgba(255,255,255,.1)';q.beginPath();q.moveTo(0,h/2);q.lineTo(w,h/2);q.stroke();
  const mxA=Math.sqrt(2/N)||1;q.strokeStyle=k<+comp.value?'#00f0ff':'rgba(255,255,255,.35)';q.lineWidth=2;q.shadowColor=q.strokeStyle;q.shadowBlur=8;q.beginPath();
  for(let n=0;n<N;n++){const x=n/(N-1)*w,y=h/2-Cm[k*N+n]/mxA*(h/2-12);n?q.lineTo(x,y):q.moveTo(x,y)}q.stroke();
  bInfo.textContent='X('+k+') = '+dct[k].toFixed(4)+(k<+comp.value?' · dipertahankan':' · dibuang')+' · frekuensi '+(k/2).toFixed(1)+' siklus per jendela'}
let drag=false;
function setCut(e){const r=chartDCT.getBoundingClientRect(),v=Math.round(chart2.scales.x.getValueForPixel((e.clientX-r.left)*(chartDCT.width/r.width)/(devicePixelRatio||1)))+1;
  comp.value=Math.max(1,Math.min(N,v));update()}
chartDCT.addEventListener('pointerdown',e=>{drag=true;chartDCT.setPointerCapture(e.pointerId);setCut(e)});
const kOf=e=>{const r=chartDCT.getBoundingClientRect();return Math.max(0,Math.min(N-1,Math.round(chart2.scales.x.getValueForPixel((e.clientX-r.left)*(chartDCT.width/r.width)/(devicePixelRatio||1)))))};
chartDCT.addEventListener('pointermove',e=>{if(drag)setCut(e);else drawBasis(kOf(e))});
chartDCT.addEventListener('pointerup',()=>drag=false);
update();

// ---------- Bola titik 3D (digerakkan scroll) ----------
const cv=document.getElementById('sphere'),g=cv.getContext('2d');
let W,H,DPR;
function size(){DPR=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;g.setTransform(DPR,0,0,DPR,0,0)}
addEventListener('resize',size);size();
const M=3200,P=[];
for(let i=0;i<M;i++){const y=1-2*(i+.5)/M,r=Math.sqrt(1-y*y),a=i*2.399963;P.push({x:Math.cos(a)*r,y,z:Math.sin(a)*r,u:(Math.atan2(Math.sin(a)*r,Math.cos(a)*r)+Math.PI)/(2*Math.PI)})}
const CX=[.5,.7,.7,.7,.78],CR=[.3,.33,.33,.33,.2],NS=5;
let sT=0,sS=0,rot=0,mx=0,my=0;
const lerp=(a,b,k)=>a+(b-a)*k;
function onScroll(){sT=Math.min(scrollY/innerHeight,NS-1)}
addEventListener('scroll',onScroll,{passive:true});onScroll();
addEventListener('pointermove',e=>{mx=e.clientX/W-.5;my=e.clientY/H-.5});
function colorFor(p,i){
  const th=p.u,idx=Math.floor(th*N)%N,y=p.y;
  switch(i){
    case 0:{const k=(y+1)/2;return[lerp(255,60,k),lerp(60,90,k),lerp(170,255,k),1,0]}
    case 1:{const v=sig[idx]/mxS;return[255,42+Math.abs(v)*120,109,.3+.7*Math.abs(v),v*.08]}
    case 2:{const L=32,b=Math.floor((1-y)/2*L),lit=b<Math.ceil(+comp.value/N*L),m=Math.abs(dct[Math.min(N-1,b*8)])/mxD;
      return lit?[0,240,255,.4+.6*Math.min(1,m*2),Math.min(1,m*2)*.05]:[200,210,255,.13,0]}
    default:{const v=rec[idx]/mxS,a=Math.abs(v);return[lerp(0,177,.5+v/2),lerp(240,75,.5+v/2),lerp(255,244,.5+v/2),(.4+.6*a)*(i===4?.45:1),v*.08]}
  }
}
const labEl=document.getElementById('lab');
function frame(now){
  const op=Math.max(0,Math.min(1,(labEl.getBoundingClientRect().top-H*.2)/(H*.7)));cv.style.opacity=op;if(op<.02){requestAnimationFrame(frame);return}
  sS+=(sT-sS)*(RM?1:.07);
  rot+=RM?0:.0035+(Math.abs(sT-sS))*.05;
  g.clearRect(0,0,W,H);
  const wts=[];for(let i=0;i<NS;i++)wts.push(Math.max(0,1-Math.abs(sS-i)));
  const mob=W<800;
  let cxF=0,rF=0;wts.forEach((w,i)=>{cxF+=w*CX[i];rF+=w*CR[i]});
  const R=Math.min(W,H)*rF*(mob?1.15:1.35),cx=mob?W/2:W*cxF,cy=mob?H*.36:H*.5;
  const cr=Math.cos(rot),sr=Math.sin(rot),tx=my*.5,ct=Math.cos(tx),st=Math.sin(tx);
  const act=wts.map((w,i)=>w>.01?i:-1).filter(i=>i>=0);
  g.globalCompositeOperation='lighter';
  for(const p of P){
    let c=[0,0,0,0,0];
    for(const i of act){const k=colorFor(p,i),w=wts[i];for(let j=0;j<5;j++)c[j]+=k[j]*w}
    const s=1+c[4];
    let x=p.x*s,y=p.y*s,z=p.z*s;
    const x1=x*cr+z*sr,z1=-x*sr+z*cr,y2=y*ct-z1*st,z2=y*st+z1*ct;
    const depth=(z2+1)/2,a=c[3]*(.18+.82*depth)*(mob?.7:1);
    if(a<.02)continue;
    g.fillStyle=`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a.toFixed(2)})`;
    const r=(.7+depth*1.6)*(R/260+.45);
    g.beginPath();g.arc(cx+x1*R+mx*18,cy+y2*R+my*10,r,0,6.2832);g.fill();
  }
  g.globalCompositeOperation='source-over';
  // halo
  const gr=g.createRadialGradient(cx,cy,R*.8,cx,cy,R*1.5);gr.addColorStop(0,'rgba(90,70,255,.10)');gr.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=gr;g.fillRect(0,0,W,H);
  document.querySelector('#bar i').style.top=(sS/(NS-1)*60)+'px';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- Kontrol lab ----------
document.querySelectorAll('#shapes .chip').forEach(b=>b.onclick=()=>{shape=b.dataset.s;inputMode='manual';document.querySelectorAll('#shapes .chip').forEach(x=>x.classList.toggle('on',x===b));update()});
document.querySelectorAll('#presets .chip').forEach(b=>b.onclick=()=>{const[a,c,d]=b.dataset.p.split(',');freq1.value=a;freq2.value=c;noise.value=d;inputMode='manual';update()});
document.querySelectorAll('#view button').forEach(b=>b.onclick=()=>{const v=b.dataset.v;document.querySelectorAll('#view button').forEach(x=>x.classList.toggle('on',x===b));
  chart1.setDatasetVisibility(0,v!=='out');chart1.setDatasetVisibility(1,v!=='in');chart1.update()});
document.getElementById('live').onclick=function(){live=!live;this.classList.toggle('on',live);clearInterval(liveT);
  if(live){inputMode='manual';liveT=setInterval(update,160)}else update()};
document.querySelectorAll('.spot').forEach(c=>c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect();c.style.setProperty('--mx',e.clientX-r.left+'px');c.style.setProperty('--my',e.clientY-r.top+'px')}));

// ---------- Teks muncul saat scene aktif ----------
const io=new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('on',e.isIntersecting)),{threshold:.45});
document.querySelectorAll('.scene .t').forEach(e=>io.observe(e));

// ---------- Stage: jendela kaca, animasi masuk, debu ----------
(function(){
  const st=document.getElementById('stage'),lab=document.getElementById('lab');
  const T1=['Panel kontrol','Sinyal waktu','Spektrum DCT','Kompaksi energi','Fungsi basis','Eksperimen otomatis','Verifikasi'],T2=['DCT-II (maju)','IDCT (balik)','Mengapa DCT?','Kode inti'];
  const bar=(c,t)=>{if(!c)return;const w=document.createElement('div');w.className='wbar';w.innerHTML='<i></i><i></i><i></i><span>'+t+'</span>';c.prepend(w)};
  lab.querySelectorAll('.card').forEach((c,i)=>bar(c,T1[i]));
  document.querySelectorAll('#teori .card').forEach((c,i)=>bar(c,T2[i]));
  // isi jendela ikut beranimasi saat muncul
  const CH={chartInput:()=>chart1,chartDCT:()=>chart2};
  function onShow(t){
    const cv=t.querySelector('canvas'),f=cv&&CH[cv.id];if(f){const c=f();if(c&&c.reset){c.reset();c.update()}}
    if(t.querySelector('#ring')){const to=ring.style.strokeDashoffset;ring.style.transition='none';ring.style.strokeDashoffset=326.7;void ring.getBoundingClientRect();ring.style.transition='';ring.style.strokeDashoffset=to}}
  // jendela muncul satu per satu
  const rv=[...st.querySelectorAll('.card,.mi,.lh,.fs')];
  const io=new IntersectionObserver(es=>{let k=0;
    es.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top||a.boundingClientRect.left-b.boundingClientRect.left)
      .forEach(e=>{const t=e.target;io.unobserve(t);setTimeout(()=>{t.classList.add('in');onShow(t)},RM?0:k*170);k++})},{threshold:.12});
  rv.forEach(e=>{e.classList.add('reveal');io.observe(e)});
  // paralaks patung
  const bu=document.querySelector('#bust .st');
  addEventListener('pointermove',e=>{bu.style.setProperty('--px',((e.clientX/innerWidth-.5)*-16)+'px');bu.style.setProperty('--py',((e.clientY/innerHeight-.5)*-10)+'px')});
  // debu emas halus
  const dc=document.getElementById('dust'),dg=dc.getContext('2d'),Dp=[];let on=false;
  const fit=()=>{dc.width=st.clientWidth;dc.height=st.clientHeight};fit();addEventListener('resize',fit);
  for(let i=0;i<34;i++)Dp.push({x:Math.random(),y:Math.random(),r:.6+Math.random()*1.3,v:.1+Math.random()*.3,p:Math.random()*6});
  (function loop(){if(on&&!RM){dg.clearRect(0,0,dc.width,dc.height);for(const q of Dp){q.y-=q.v/dc.height*2;q.p+=.025;if(q.y<-.02){q.y=1.02;q.x=Math.random()}
    dg.fillStyle='rgba(255,226,160,'+(.15+.35*Math.abs(Math.sin(q.p))).toFixed(2)+')';dg.beginPath();dg.arc(q.x*dc.width+Math.sin(q.p*.5)*14,q.y*dc.height,q.r,0,6.3);dg.fill()}}requestAnimationFrame(loop)})();
  new IntersectionObserver(es=>on=es[0].isIntersecting).observe(st);
})();

// ---------- Eksperimen otomatis (sapuan K) ----------
function sweep(cur){
  const ref=(inputMode==='manual'&&currentSignal&&currentSignal.clean)||null;
  const eT=dct.reduce((q,v)=>q+v*v,0)||1,pw=sig.reduce((q,v)=>q+v*v,0);
  const rows=KS.map(K=>{const r=getIDCT(dct.map((v,i)=>i<K?v:0)),m=mse(sig,r);
    return{K,e:dct.reduce((q,v,i)=>q+(i<K?v*v:0),0)/eT*100,m,snr:m>1e-12&&pw>1e-9?Math.min(99,10*Math.log10(pw/(m*N))):99,mc:ref?mse(ref,r):null}});
  const best=ref?rows.reduce((a,b)=>b.mc<a.mc?b:a):null,near=KS.filter(k=>k<=cur).pop();
  sweepT.innerHTML='<tr><th>K</th><th>Retensi</th><th>Rasio</th><th>Energi</th><th>MSE</th><th>SNR (dB)</th>'+(ref?'<th>MSE vs bersih</th>':'')+'</tr>'+
    rows.map(r=>'<tr class="'+(best&&r.K===best.K?'best ':'')+(r.K===near?'cur':'')+'"><td>'+r.K+'</td><td>'+(r.K/N*100).toFixed(1)+'%</td><td>'+(N/r.K).toFixed(1)+':1</td><td>'+r.e.toFixed(1)+'%</td><td>'+r.m.toFixed(4)+'</td><td>'+r.snr.toFixed(1)+'</td>'+(ref?'<td>'+r.mc.toFixed(4)+'</td>':'')+'</tr>').join('');
  let cu=0,k95=0,k99=0;dct.forEach((v,i)=>{cu+=v*v;if(!k95&&cu/eT>=.95)k95=i+1;if(!k99&&cu/eT>=.99)k99=i+1});
  kinfo.innerHTML='<span class="chip on">K95 = '+k95+' (energi 95%)</span><span class="chip on">K99 = '+k99+' (energi 99%)</span>'+(best?'<span class="chip on">K terbaik untuk pembersihan = '+best.K+'</span>':'');
  chartSweep.data.datasets[0].data=rows.map(r=>r.m);chartSweep.data.datasets[1].data=ref?rows.map(r=>r.mc):[];chartSweep.update('none');
  lastCsv='K,retensi_persen,rasio_kompresi,energi_persen,MSE,SNR_dB'+(ref?',MSE_vs_bersih':'')+'\n'+rows.map(r=>[r.K,(r.K/N*100).toFixed(2),(N/r.K).toFixed(2),r.e.toFixed(2),r.m.toFixed(6),r.snr.toFixed(2)].concat(ref?[r.mc.toFixed(6)]:[]).join(',')).join('\n');
  if(ref){const mi=mse(ref,sig),mo=mse(ref,rec);cleanNote.innerHTML='Referensi sinyal bersih tersedia (mode sintesis). Noise pada input: MSE = <b>'+mi.toFixed(4)+'</b>; setelah filter K = '+cur+': MSE = <b>'+mo.toFixed(4)+'</b>'+(mi>1e-6&&mo>1e-9?'; peningkatan SNR = <b>'+(10*Math.log10(mi/mo)).toFixed(1).replace('-0.0','0.0')+' dB</b>':'')+'. MSE terhadap sinyal asli (kolom MSE) bernilai 0 pada K = 256 karena noise ikut direkonstruksi, sedangkan MSE terhadap sinyal bersih menunjukkan K yang benar-benar membersihkan noise.'}
  else cleanNote.textContent='Referensi sinyal bersih hanya tersedia pada mode sintesis. Pada mode audio atau gambar, hanya MSE terhadap input yang dihitung.'}
copyCsv.onclick=()=>{const done=()=>{copyCsv.textContent='✓ Tersalin';setTimeout(()=>copyCsv.textContent='⧉ Salin CSV',1500)};
  const fb=()=>{const t=document.createElement('textarea');t.value=lastCsv;document.body.appendChild(t);t.select();try{document.execCommand('copy');done()}catch(e){}t.remove()};
  navigator.clipboard?navigator.clipboard.writeText(lastCsv).then(done,fb):fb()};

// ---------- Gambar sinyal sendiri ----------
const drawData=new Array(N).fill(0);
(function(){const cv=drawCv,g=cv.getContext('2d');cv.width=512;cv.height=96*2;let prev=-1,dn=false;
  const paint=()=>{g.clearRect(0,0,512,192);g.strokeStyle='rgba(255,255,255,.12)';g.beginPath();g.moveTo(0,96);g.lineTo(512,96);g.stroke();
    g.strokeStyle='#00f0ff';g.lineWidth=3;g.beginPath();drawData.forEach((v,i)=>{const x=i/(N-1)*512,y=96-v*80;i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke()};
  const pt=e=>{const r=cv.getBoundingClientRect(),i=Math.max(0,Math.min(N-1,Math.round((e.clientX-r.left)/r.width*(N-1)))),v=Math.max(-1.2,Math.min(1.2,(.5-(e.clientY-r.top)/r.height)*2.4));
    if(prev>=0&&prev!==i){const va=drawData[prev];for(let k=Math.min(i,prev);k<=Math.max(i,prev);k++)drawData[k]=va+(v-va)*((k-prev)/(i-prev))}else drawData[i]=v;
    prev=i;paint();inputMode='draw';currentSignal=null;uploadText.textContent='📁 Impor atau seret berkas .wav ke sini';update()};
  cv.addEventListener('pointerdown',e=>{dn=true;prev=-1;cv.setPointerCapture(e.pointerId);pt(e)});
  cv.addEventListener('pointermove',e=>{if(dn)pt(e)});cv.addEventListener('pointerup',()=>dn=false);
  drawClr.onclick=()=>{drawData.fill(0);paint();inputMode='draw';update()};paint()})();

// ---------- Demo otomatis ----------
(function(){
  let run=false;const sl=ms=>new Promise(r=>setTimeout(r,ms)),W=async ms=>{await sl(ms);if(!run)throw 0};
  const cap=t=>{demoCap.textContent=t;demoCap.classList.add('on')};
  const setP=(a,b,c)=>{freq1.value=a;freq2.value=b;noise.value=c;inputMode='manual';update()};
  async function tw(a,b,ms){for(let i=0;i<=24;i++){comp.value=Math.round(a+(b-a)*i/24);update();await W(ms/24)}}
  const go=id=>document.getElementById(id).scrollIntoView({behavior:'smooth',block:'center'});
  demoBtn.onclick=async()=>{
    if(run){run=false;return}
    run=true;demoBtn.textContent='■ Hentikan demo';ctx();
    try{
      document.querySelector('#shapes [data-s="sine"]').click();setP(5,10,.5);comp.value=256;update();go('chartInput');
      cap('1. Sinyal sintesis: 5 Hz + 10 Hz + noise. Garis cyan adalah hasil filter.');await W(3200);
      go('chartDCT');cap('2. Spektrum DCT: energi menumpuk di koefisien rendah, noise tersebar di seluruh koefisien.');await W(3200);
      cap('3. Cut-off diturunkan dari 256 ke 32: noise terbuang, bentuk sinyal bertahan.');await tw(256,32,4200);await W(1200);
      cap('4. Terlalu rendah (K = 8): kedua nada hilang, MSE naik.');await tw(32,8,2600);await W(1400);
      cap('5. Kembali ke K = 32 dan lihat tabel eksperimen: K terbaik ditandai ★.');await tw(8,32,2000);go('sweepT');await W(4200);
      go('chartInput');document.querySelector('#shapes [data-s="square"]').click();setP(3,9,.3);cap('6. Gelombang kotak: ujung tajam butuh lebih banyak koefisien.');await tw(32,16,1800);await tw(16,96,2800);await W(1000);
      cap('7. Dengarkan sinyal asli, lalu hasil filter.');putarSuara('input');await W(1500);putarSuara('output');await W(1700);
      cap('Selesai. Silakan mencoba sendiri: tarik garis cut-off, gambar sinyal, atau unggah .wav.');await W(3200);
    }catch(e){}
    run=false;demoBtn.textContent='▶ Demo otomatis';demoCap.classList.remove('on')};
})();
