(() => {
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const KEY="moodkeeper_v1";
let state=JSON.parse(localStorage.getItem(KEY))||{theme:"warm",days:{}};
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const today=()=>new Date().toISOString().slice(0,10);
const day=()=>state.days[today()]||=( {alcohol:0,practices:0} );
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1200);};
const render=t=>{
 const v=$("#view");
 if(t==="alcohol"){
  v.innerHTML=`<div class="card"><h3>Alcohol</h3>
   <div><button class="btn" data-a>🍺</button> <button class="btn" data-a>🍷</button> <button class="btn" data-a>🥃</button></div>
   <p>Today: <strong>${day().alcohol}</strong></p></div>`;
  v.onclick=e=>{if(e.target.dataset.a!==undefined){day().alcohol++;save();toast("Saved");render("alcohol");}};
  return;
 }
 if(t==="practices"){
  v.innerHTML=`<div class="card"><h3>Practices</h3>
   <button class="btn" id="addP">+1 Practice</button>
   <p>Today: <strong>${day().practices}</strong></p></div>`;
  $("#addP").onclick=()=>{day().practices++;save();toast("Saved");render("practices");};
  return;
 }
 v.innerHTML=`<div class="card"><p>Coming soon</p></div>`;
};
$("#tabs").onclick=e=>{const b=e.target.closest(".tab");if(!b)return;$$(".tab").forEach(x=>x.classList.toggle("active",x===b));render(b.dataset.tab);};
$("#themeToggle").onclick=()=>{state.theme=state.theme==="warm"?"night":"warm";document.body.dataset.theme=state.theme;save();};
document.body.dataset.theme=state.theme;
render("checkin");
})();