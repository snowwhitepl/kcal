// ====== storage ======
const KEY = 'calapp_v1';
const load = () => JSON.parse(localStorage.getItem(KEY) || '[]');
const save = data => localStorage.setItem(KEY, JSON.stringify(data));
let items = load(); // {id, name, kcal, date, note}

// ====== helpers ======
const $ = s => document.querySelector(s);
const todayISO = () => new Date().toISOString().slice(0,10);

const toISO = d => {
if(!d) return todayISO();
if(typeof d === 'string') return d;
return d.toISOString().slice(0,10);
};

const inLastNDays = (iso, n) => {
const d = new Date(iso);
const from = new Date(); from.setHours(0,0,0,0); from.setDate(from.getDate()-(n-1));
const to = new Date(); to.setHours(23,59,59,999);
return d >= from && d <= to;
};

const sameMonth = (iso, ref=new Date()) => {
const d = new Date(iso);
return d.getMonth()===ref.getMonth() && d.getFullYear()===ref.getFullYear();
};

const sumForDate = (iso) => items.filter(i=>i.date===iso).reduce((a,b)=>a+b.kcal,0);

function escapeHtml(s){
return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// ====== UI refs ======
const listEl = $('#list');
const todayTotalEl = $('#todayTotal');
const weekTotalEl = $('#weekTotal');
const weekAvgEl = $('#weekAvg');
const rangeEl = $('#range');
const canvas = $('#canvas');
const ctx = canvas.getContext('2d');

// kolor akcentu z CSS (dla wykresu)
const ACCENT = (getComputedStyle(document.documentElement)
.getPropertyValue('--accent') || '#4A40E0').trim();

// ====== canvas sizing (responsive, HiDPI) ======
function sizeCanvas(){
const dpr = window.devicePixelRatio || 1;
const cssW = canvas.parentElement.clientWidth;
const cssH = 240; // spójne z CSS
canvas.width = Math.floor(cssW * dpr);
canvas.height = Math.floor(cssH * dpr);
ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // rysujemy w jednostkach CSS
}

function drawChart(){
const W = canvas.parentElement.clientWidth;
const H = 240;

ctx.clearRect(0,0,W,H);
const days = [...Array(7)].map((_,i)=>{
const d = new Date(); d.setDate(d.getDate()-(6-i));
const iso = d.toISOString().slice(0,10);
return {label: d.toLocaleDateString('pl-PL',{weekday:'short'}), sum: sumForDate(iso)};
});

const max = Math.max(100, ...days.map(d=>d.sum));
const padX = 30, padBottom = 22, gap = 10;
const availW = W - padX*2;
const barW = (availW/7) - gap;

// baseline
ctx.fillStyle = '#e9e9ee';
ctx.fillRect(0, H-1, W, 1);

days.forEach((d, idx)=>{
const x = padX + idx*((availW)/7);
const h = Math.round((d.sum/max)*(H - padBottom - 20));
// bar
ctx.fillStyle = ACCENT;
ctx.fillRect(x, H - padBottom - h, barW, h);
// label
ctx.fillStyle = '#6c6c6c';
ctx.font = '12px Inter, Arial';
ctx.textAlign = 'center';
ctx.fillText(d.label, x + barW/2, H - 6);
});
}

function rerenderChart(){
sizeCanvas();
drawChart();
}

// ====== render list/totals ======
function render() {
const today = todayISO();
const weekItems = items.filter(i => inLastNDays(i.date, 7));
const weekSum = weekItems.reduce((a,b)=>a+b.kcal,0);

todayTotalEl.textContent = items.filter(i=>i.date===today).reduce((a,b)=>a+b.kcal,0).toFixed(0);
weekTotalEl.textContent = weekSum.toFixed(0);
weekAvgEl.textContent = (weekSum/7).toFixed(0);

let toShow = items.slice().sort((a,b)=> b.date.localeCompare(a.date) || b.id - a.id);
const r = rangeEl.value;
if(r==='today') toShow = toShow.filter(i=>i.date===today);
if(r==='week') toShow = toShow.filter(i=>inLastNDays(i.date,7));
if(r==='month') toShow = toShow.filter(i=>sameMonth(i.date));

listEl.innerHTML = toShow.map(i => `
<li class="item">
<div class="meta">
<div class="name">${escapeHtml(i.name || 'Posiłek')} – <span class="kcal">${i.kcal}</span> kcal</div>
<div class="note">${i.date}${i.note ? ' • ' + escapeHtml(i.note) : ''}</div>
</div>
<div class="right">
<button class="del" aria-label="Usuń" data-id="${i.id}">×</button>
</div>
</li>
`).join('');

rerenderChart();
}

// ====== actions ======
$('#form').addEventListener('submit', e=>{
e.preventDefault();
const name = $('#name').value.trim();
const kcal = parseFloat($('#kcal').value);
const date = toISO($('#date').value || todayISO());
const note = $('#note').value.trim();

if(!kcal || kcal<=0) return alert('Podaj poprawną liczbę kalorii.');

items.push({ id: Date.now(), name, kcal: Math.round(kcal), date, note });
save(items);
e.target.reset();
$('#date').value = date; // zostaw bieżącą
render();
});

listEl.addEventListener('click', e=>{
const id = e.target.dataset.id;
if(!id) return;
items = items.filter(i => String(i.id)!==String(id));
save(items);
render();
});

$('#clear').addEventListener('click', ()=>{
if(confirm('Na pewno usunąć WSZYSTKIE wpisy?')) {
items = [];
save(items);
render();
}
});

$('#export').addEventListener('click', ()=>{
const blob = new Blob([JSON.stringify(items,null,2)], {type:'application/json'});
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'kalorie.json';
a.click();
URL.revokeObjectURL(a.href);
});

$('#import').addEventListener('change', async (e)=>{
const file = e.target.files[0];
if(!file) return;
const text = await file.text();
try{
const data = JSON.parse(text);
if(Array.isArray(data)){
items = data.filter(x => x && typeof x.kcal==='number' && x.date);
save(items);
render();
} else alert('Plik nie zawiera listy wpisów.');
}catch(err){ alert('Nieprawidłowy JSON.'); }
e.target.value='';
});

rangeEl.addEventListener('change', render);

// init
$('#date').value = todayISO();
render();
window.addEventListener('resize', rerenderChart);