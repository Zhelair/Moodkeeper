(function(){
  const $ = (sel, root=document) => root.querySelector(sel);

  const TYPE_OPTIONS = [
    { key: "beer", label: "Beer", emoji: "🍺" },
    { key: "wine", label: "Wine", emoji: "🍷" },
    { key: "spirits", label: "Spirits", emoji: "🥃" },
  ];

  function startOfWeekISO(date){
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // Mon=0
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0,10);
  }

  function fmtWeekRange(weekStartISO){
    const d0 = new Date(weekStartISO+"T00:00:00");
    const d1 = new Date(d0); d1.setDate(d1.getDate()+6);
    const opts = { month: "short", day: "numeric" };
    return `${d0.toLocaleDateString('en-US', opts)} – ${d1.toLocaleDateString('en-US', opts)}`;
  }

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function meterClass(value, goodLow, goodHigh){
    // value in [0..1]
    if(value >= goodHigh) return "good";
    if(value >= goodLow) return "ok";
    return "warn";
  }

  function renderMeter(label, value01, text){
    const v = clamp(value01, 0, 1);
    const cls = meterClass(v, 0.45, 0.72);
    const pct = Math.round(v*100);
    return `
      <div class="meterblock">
        <div class="meterhead">
          <div class="label">${label}</div>
          <div class="meterval ${cls}">${text}</div>
        </div>
        <div class="meter ${cls}" aria-label="${label}">
          <span style="width:${pct}%"></span>
        </div>
      </div>
    `;
  }

  function summarizeWeek(entries){
    let moodSum=0, moodN=0;
    let poorSleep=0;
    let freeDays=0, hadDays=0, drinksTotal=0, alcoholLoggedDays=0;
    let waitsStarted=0, waitsCompleted=0, waitsPassed=0;
    const byType = { beer:0, wine:0, spirits:0 };
    const tagCounts = {};

    for(const e of entries){
      // mood
      if(typeof e.mood === "number"){
        moodSum += e.mood; moodN += 1;
      }

      // sleep
      if(e.sleep && e.sleep.poor) poorSleep += 1;

      // tags
      const tags = Array.isArray(e.tags) ? e.tags : [];
      for(const t of tags){
        tagCounts[t] = (tagCounts[t]||0)+1;
      }

      // alcohol
      const a = e.alcohol || null;
      if(a){
        alcoholLoggedDays += 1;
        if(a.status === "free"){
          freeDays += 1;
        }else if(a.status === "had"){
          hadDays += 1;
          const drinks = Number(a.drinks||0) || 0;
          drinksTotal += drinks;
          const t = a.type;
          if(t && byType.hasOwnProperty(t)) byType[t] += drinks;
        }
      }

      // craving waits
      const waits = Array.isArray(e.cravingWaits) ? e.cravingWaits : [];
      if(waits.length){
        waitsStarted += waits.length;
        for(const w of waits){
          if(w && w.completed) waitsCompleted += 1;
          if(w && w.outcome === 'passed') waitsPassed += 1;
        }
      }
    }

    const avgMood = moodN ? (moodSum/moodN) : 0;

    const topTags = Object.entries(tagCounts)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,3)
      .map(([k])=>k);

    return { avgMood, moodN, poorSleep, freeDays, hadDays, drinksTotal, byType, topTags, alcoholLoggedDays, waitsStarted, waitsCompleted, waitsPassed };
  }

  async function build(){
    const root = document.createElement("div");

    const weekStart = startOfWeekISO(new Date());
    const entries = await Store.getEntriesForWeek(weekStart);
    const sum = summarizeWeek(entries);
    const range = fmtWeekRange(weekStart);

    // meters (gentle, not competitive)
    const mood01 = sum.moodN ? (sum.avgMood/5) : 0;
    const sleep01 = 1 - (sum.poorSleep/7);
    const alcohol01 = sum.alcoholLoggedDays ? clamp(sum.freeDays/7, 0, 1) : 0;

    const moodText = sum.moodN ? `${sum.avgMood.toFixed(1)} / 5` : "No mood yet";
    const sleepText = `${7 - sum.poorSleep} steady night(s)`;
    const alcText = sum.alcoholLoggedDays ? `${sum.freeDays} alcohol-free day(s)` : "—";

    const alcLine = TYPE_OPTIONS.map(t=>{
      const n = sum.byType[t.key] || 0;
      const faded = n ? "" : "muted";
      return `<span class="${faded}" title="${t.label}">${t.emoji} ${n}</span>`;
    }).join(" · ");

    const toneBadge = sum.hadDays === 0 ? "good" : (sum.hadDays <= 2 ? "ok" : "warn");
    const weekLabel =
      sum.hadDays === 0 ? "Quiet week" :
      sum.hadDays <= 2 ? "Mostly steady" :
      "A bit heavy";

    // small “badge” moments (engaging, not gamified pressure)
    const badges = [];
    if(sum.freeDays >= 5) badges.push({cls:"good", txt:"🟢 Consistency"});
    if(sum.freeDays >= 3 && sum.hadDays > 0) badges.push({cls:"ok", txt:"🟡 Regrouped"});
    if(sum.poorSleep <= 1) badges.push({cls:"good", txt:"😴 Good sleep"});
    if(sum.topTags.includes("work")) badges.push({cls:"ok", txt:"🧠 Work week"});
    if(!badges.length) badges.push({cls:"ok", txt:"✨ Logged something"});

    root.innerHTML = `
      <section class="card">
        <div class="weekline">
          <div>
            <h2>Insights</h2>
            <p class="muted">Patterns, not judgement.</p>
          </div>
          <div class="badge ${toneBadge}">${weekLabel}</div>
        </div>
        <div class="muted tiny">${range}</div>
      </section>

      <section class="card">
        <h3>This week at a glance</h3>
        <div class="grid3 mt">
          <div class="stat">
            <div class="stat-k">Average mood</div>
            <div class="stat-v">${sum.moodN ? sum.avgMood.toFixed(1) : "—"}</div>
          </div>
          <div class="stat">
            <div class="stat-k">Alcohol-free days</div>
            <div class="stat-v">${sum.freeDays}</div>
          </div>
          <div class="stat">
            <div class="stat-k">Poor sleep days</div>
            <div class="stat-v">${sum.poorSleep}</div>
          </div>
        </div>
      </section>

      <section class="card">
        <h3>Dashboard</h3>
        <p class="muted">A “weather report” for your week.</p>
        <div class="mt">
          ${renderMeter("Mood", mood01, moodText)}
          ${renderMeter("Sleep", sleep01, sleepText)}
          ${renderMeter("Alcohol-free", alcohol01, alcText)}
        </div>
      </section>

      <section class="card">
        <h3>Alcohol snapshot</h3>
        <div class="muted">Drinks logged: <strong>${sum.alcoholLoggedDays ? sum.drinksTotal : "—"}</strong></div>
        <div class="mt">${alcLine}</div>
        <div class="muted tiny mt">Tip: log type + count on the Alcohol screen. Estimates are fine.</div>
      </section>

      <section class="card">
        
      <section class="card">
        <h3>Craving waits</h3>
        <div class="muted">Logging the wait is the win.</div>
        <div class="mt">
          <div class="row" style="gap:14px; flex-wrap:wrap;">
            <div><strong>${sum.waitsStarted}</strong> started</div>
            <div><strong>${sum.waitsCompleted}</strong> completed</div>
            <div><strong>${sum.waitsPassed}</strong> passed</div>
          </div>
        </div>
      </section>

      <h3>What showed up</h3>
        <div class="pillrow mt">
          ${(sum.topTags.length ? sum.topTags : ["No tags yet"]).map(t=>`<span class="pill ghost">${t}</span>`).join("")}
        </div>
      </section>

      <section class="card">
        <h3>Small wins</h3>
        <div class="badgerow mt">
          ${badges.map(b=>`<span class="badge ${b.cls}">${b.txt}</span>`).join("")}
        </div>
        <p class="muted mt">If you want it more “game-like”, we can add optional weekly “quests” — but only if it stays gentle.</p>
      </section>
    `;

    return root;
  }

  TrackboardRouter.register("insights", async ()=>{
    const view = document.getElementById("view");
    const node = await build();
    view.appendChild(node);
    TrackboardUI.setActiveNav("insights");
    TrackboardUI.setSubtitle("Insights · Private · Stored on this device");
  });
})();
