async function logMood() {
  const mood = Number(document.getElementById("mood").value);
  if (!mood) return alert("Enter mood");

  await supabase.from("logs").insert({
    date: new Date().toISOString().slice(0,10),
    type: "mood",
    value: { mood }
  });

  loadInsights();
}

async function logAlcohol() {
  const drinks = Number(document.getElementById("alcohol").value || 0);

  await supabase.from("logs").insert({
    date: new Date().toISOString().slice(0,10),
    type: "alcohol",
    value: { drinks }
  });

  loadInsights();
}

async function loadInsights() {
  const { data } = await supabase
    .from("logs")
    .select("*")
    .gte("date", new Date(Date.now()-6*864e5).toISOString().slice(0,10));

  const stats = calculateWeeklyInsights(data || []);
  document.getElementById("insightsBox").textContent =
    JSON.stringify(stats, null, 2);
}

loadInsights();
