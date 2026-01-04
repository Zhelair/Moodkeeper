const $=q=>document.querySelector(q);
let state=JSON.parse(localStorage.getItem("moodkeeper"))||{alcohol:{drinks:0,type:null},practices:{pushups:0,pullups:0,abs:0},goals:{practices:5,alcoholFree:4},theme:"warm"};
function save(){localStorage.setItem("moodkeeper",JSON.stringify(state));}
function setType(t){state.alcohol.type=t;save();render('alcohol');}
function renderAlcohol(){$('#view').innerHTML=`<div class=card><h3>Alcohol</h3>
<button onclick=setType('beer')>🍺</button>
<button onclick=setType('wine')>🍷</button>
<button onclick=setType('spirits')>🥃</button>
<p>Drinks <button onclick="state.alcohol.drinks=Math.max(0,state.alcohol.drinks-1);save();render('alcohol')">-</button>
${state.alcohol.drinks}
<button onclick="state.alcohol.drinks++;save();render('alcohol')">+</button></p>
<span class=badge>Saved ✓</span></div>`;}
function renderPractices(){$('#view').innerHTML=`<div class=card><h3>Practices</h3>
${Object.keys(state.practices).map(k=>`<p>${k}
<button onclick="state.practices['${k}']=Math.max(0,state.practices['${k}']-1);save();render('practices')">-</button>
${state.practices[k]}
<button onclick="state.practices['${k}']++;save();render('practices')">+</button></p>`).join('')}
<span class=badge>Saved ✓</span></div>`;}
function renderGoals(){$('#view').innerHTML=`<div class=card><h3>Goals</h3>
<p>Practices/week ${state.goals.practices}</p>
<p>Alcohol-free ${state.goals.alcoholFree}</p></div>`;}
function renderInsights(){$('#view').innerHTML=`<div class=card><h3>Insights</h3>
<p>Weekly stamp: ⭐ Steady Week</p></div>`;}
function renderSettings(){$('#view').innerHTML=`<div class=card><h3>Settings</h3>
<button onclick=exportLink()>Room link</button></div>`;}
function exportLink(){prompt("Room link",location.href+"#"+btoa(JSON.stringify(state)));}
function render(tab){({alcohol:renderAlcohol,practices:renderPractices,goals:renderGoals,insights:renderInsights,settings:renderSettings})[tab]();}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>render(b.dataset.tab));
$('#themeToggle').onclick=()=>{state.theme=state.theme==="warm"?"night":"warm";document.body.dataset.theme=state.theme;save();}
document.body.dataset.theme=state.theme;render('alcohol');