// اسم الملف: script.js
// لعبة بسيطة تفاعلية: 58 ولاية قابلة للغرس.
// حفظ التقدّم في localStorage، رسالة خضراء صوتية، PWA-ready.

const WILAYAS = [
 "Adrar","Chlef","Laghouat","Oum El Bouaghi","Batna","Béjaïa","Biskra","Béchar","Blida","Bouira",
 "Tamanrasset","Tébessa","Tlemcen","Tiaret","Tizi Ouzou","Algiers","Djelfa","Jijel","Sétif","Saïda",
 "Skikda","Sidi Bel Abbès","Annaba","Guelma","Constantine","Médéa","Mostaganem","M'Sila","Mascara","Ouargla",
 "Oran","El Bayadh","Illizi","Bordj Bou Arréridj","Boumerdès","El Tarf","Tindouf","Tissemsilt","El Oued","Khenchela",
 "Souk Ahras","Tipaza","Mila","Aïn Defla","Naâma","Aïn Témouchent","Ghardaïa","Relizane","El M'Ghair","El Meniaa",
 "Ouled Djellal","Bordj Badji Mokhtar","Béni Abbès","Timimoun","Touggourt","Djanet"
];
// ملاحظة: القوائم قد تختلف في الترتيب/الأسماء المحلية — يمكنك تعديل الأسماء هنا بسهولة.

const STORAGE_KEY = 'dz_green_v1';
let state = {
  done: {}, // keyed by wilaya name
};

const $ = id => document.getElementById(id);
const mapWrap = document.getElementById('mapWrap');
const countDoneEl = $('countDone');
const progressFill = $('progressFill');
const overlay = $('overlay');
const overlayTitle = $('overlayTitle');
const overlayDesc = $('overlayDesc');
const overlayClose = $('overlayClose');
const sfx = $('sfx');

// انشاء صوت بسيط مدمج (نغمة قصيرة) باستخدام WebAudio وبلوب
function makeSfxBlob(){
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const duration = 0.28;
    const sr = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sr*duration, sr);
    const data = buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){
      const t = i/sr;
      // موجة نغمة خفيفة متصاعدة
      data[i] = Math.sin(2*Math.PI*(400 + t*800)*t) * Math.exp(-4*t);
    }
    const wav = audioBufferToWav(buffer);
    const blob = new Blob([wav], {type:'audio/wav'});
    return URL.createObjectURL(blob);
  }catch(e){
    console.warn('audio synth fail', e);
    return null;
  }
}

// helper: تحويل AudioBuffer إلى WAV (كود صغير منطق)
function audioBufferToWav(buffer){
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const buffer2 = new ArrayBuffer(length);
  const view = new DataView(buffer2);
  let offset = 0;
  const writeString = function(s){ for(let i=0;i<s.length;i++){ view.setUint8(offset++, s.charCodeAt(i)); } };
  writeString('RIFF'); view.setUint32(offset, 36 + buffer.length * numOfChan * 2, true); offset+=4;
  writeString('WAVE'); writeString('fmt '); view.setUint32(offset,16,true); offset+=4;
  view.setUint16(offset,1,true); offset+=2; view.setUint16(offset,numOfChan,true); offset+=2;
  view.setUint32(offset,buffer.sampleRate,true); offset+=4; view.setUint32(offset, buffer.sampleRate * numOfChan * 2,true); offset+=4;
  view.setUint16(offset,numOfChan * 2,true); offset+=2; view.setUint16(offset,16,true); offset+=2;
  writeString('data'); view.setUint32(offset, buffer.length * numOfChan * 2, true); offset+=4;
  // write interleaved data
  const channels = [];
  for(let i=0;i<numOfChan;i++) channels.push(buffer.getChannelData(i));
  let pos = offset;
  for(let i=0;i<buffer.length;i++){
    for(let ch=0;ch<numOfChan;ch++){
      let sample = Math.max(-1, Math.min(1, channels[ch][i]));
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
  }
  return view;
}

// تهيئة الصوت (أول زيارة) — نحاول صنع blob داخلي ليعمل offline
(function initSFX(){
  const url = makeSfxBlob();
  if(url) sfx.src = url;
  else {
    // كبديل لو synthesis فشل، ضع ملف خارجي (خياري)
    sfx.src = '';
  }
})();

function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw) {
    try{ state = JSON.parse(raw); }catch(e){ state = {done:{}}; }
  }
}

function buildMap(){
  mapWrap.innerHTML = '';
  WILAYAS.forEach(name=>{
    const tile = document.createElement('button');
    tile.className = 'tile';
    tile.setAttribute('data-name', name);
    tile.innerHTML = `<div class="name">${name}</div><div class="meta">انقر للغرس</div>`;
    tile.addEventListener('click', onTileClick);
    mapWrap.appendChild(tile);
    if(state.done[name]) tile.classList.add('done'), tile.querySelector('.meta').textContent = 'مغروسة';
  });
  updateStats();
}

function updateStats(){
  const doneCount = Object.keys(state.done).length;
  countDoneEl.textContent = doneCount;
  const pct = Math.round((doneCount / WILAYAS.length)*100);
  progressFill.style.width = pct + '%';
  if(doneCount === WILAYAS.length){
    // رسالة كاملة الخريطة خضراء
    showOverlay('ما شاء الله — الجزائر كلها خضراء 🌿', 'تهانينا! لقد غرست الأشجار في جميع الولايات — خضراءٌ بإذن الله.');
  }
}

function onTileClick(e){
  const name = e.currentTarget.getAttribute('data-name');
  if(state.done[name]){
    // بالفعل مغروسة — نعرض تفاصيل
    showOverlay('مغروسة سابقاً', `${name} بالفعل مُشار إليها بالخُضرة — شُكراً لمساهمتك!`);
    return;
  }
  // اجراء الغرس: انيم بسيطة + حفظ + صوت + رسالة
  plantTree(name, e.currentTarget);
}

function plantTree(name, tileEl){
  // تأثير بصري قصير
  tileEl.classList.add('done');
  tileEl.querySelector('.meta').textContent = 'مغروسة';
  state.done[name] = {ts: Date.now()};
  saveState();
  // تشغيل صوت
  try{ if(sfx && sfx.src){ sfx.currentTime = 0; sfx.play().catch(()=>{}); } }catch(e){}
  // عرض رسالة "خضراء بإذن الله"
  showOverlay('🌿 خضراءٌ بإذن الله 🌿', `الولاية: ${name} — شُكراً!`);
  updateStats();
}

// Overlay show/close
function showOverlay(title, desc){
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden','false');
  overlayTitle.textContent = title;
  overlayDesc.textContent = desc;
}
overlayClose.addEventListener('click', ()=>{ overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true'); });

// Reset
$('resetBtn').addEventListener('click', ()=>{
  if(!confirm('هل تريد إعادة ضبط التقدّم؟ سيتم حذف كل الولايات المغروسة.')) return;
  state = {done:{}};
  saveState();
  buildMap();
});

// theme toggle
$('toggleTheme').addEventListener('click', ()=>{
  document.documentElement.classList.toggle('light-mode');
});

// init
loadState();
buildMap();

// register service worker for offline caching
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/service-worker.js').catch(e=>console.warn('SW failed', e));
}
