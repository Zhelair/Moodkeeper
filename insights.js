function calculateWeeklyInsights(logs) {
  const moodLogs = logs.filter(l => l.type === "mood");
  const alcoholLogs = logs.filter(l => l.type === "alcohol");

  const avgMood =
    moodLogs.reduce((s, l) => s + l.value.mood, 0) /
    (moodLogs.length || 1);

  const drinks = alcoholLogs.reduce(
    (s, l) => s + l.value.drinks,
    0
  );

  return {
    avgMood: avgMood.toFixed(2),
    drinks
  };
}
