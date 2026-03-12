(function(){

  var PROVIDERS = {
    deepseek: {
      name: 'DeepSeek',
      url: 'https://api.deepseek.com/chat/completions',
      model: 'deepseek-chat',
      format: 'openai'
    },
    openai: {
      name: 'OpenAI',
      url: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
      format: 'openai'
    },
    anthropic: {
      name: 'Claude (Anthropic)',
      url: 'https://api.anthropic.com/v1/messages',
      model: 'claude-haiku-4-5-20251001',
      format: 'anthropic'
    }
  };

  async function getConfig() {
    var provider = (await Store.getSetting('ai_provider')) || 'deepseek';
    var apiKey = await Store.getSetting('ai_api_key');
    var prov = PROVIDERS[provider] || PROVIDERS.deepseek;
    return Object.assign({ provider: provider, apiKey: apiKey }, prov);
  }

  async function hasKey() {
    var key = await Store.getSetting('ai_api_key');
    return !!(key && String(key).trim().length > 10);
  }

  function voiceInstructions(voice) {
    if (voice === 'direct') return 'Be brief and direct. No filler words. Max 3 sentences.';
    if (voice === 'supportive') return 'Be warm and practical. Max 3 sentences.';
    return 'Be gentle and calm. No pressure. Max 3 sentences.';
  }

  async function buildContext(days) {
    days = days || 14;
    if (!window.Store) return '';
    var entries = await Store.getAllEntries();
    if (!entries || !entries.length) return '';

    var sorted = entries
      .filter(function(e) { return e && e.date; })
      .sort(function(a, b) { return b.date.localeCompare(a.date); })
      .slice(0, days)
      .reverse();

    var lines = sorted.map(function(e) {
      var parts = [];
      if (typeof e.mood === 'number') parts.push('mood ' + e.mood + '/5');
      if (Array.isArray(e.tags) && e.tags.length) parts.push('tags: ' + e.tags.join(', '));
      if (e.alcohol && e.alcohol.status) parts.push('alcohol: ' + e.alcohol.status);
      if (e.poorSleep) parts.push('poor sleep');
      if (e.calmInterrupts > 0) parts.push('calm moments: ' + e.calmInterrupts);
      if (e.notes && e.notes.trim()) parts.push('note: "' + e.notes.trim().slice(0, 80) + '"');
      return e.date + ': ' + (parts.length ? parts.join(', ') : 'no data logged');
    });

    return lines.join('\n');
  }

  async function call(userMessage, opts) {
    opts = opts || {};
    var config = await getConfig();
    if (!config.apiKey) throw new Error('no_key');

    var voice = opts.voice || (await Store.getSetting('companion_voice')) || 'gentle';
    var ctx = (opts.context !== undefined) ? opts.context : await buildContext(14);

    var systemParts = [
      'You are a calm, private wellbeing companion built into the Moodkeeper app.',
      'Help the user reflect and notice patterns. Never diagnose or prescribe.',
      'No hype, no excessive positivity. Be real, grounded, and brief.',
      voiceInstructions(voice)
    ];
    if (ctx) systemParts.push('\nUser\'s recent check-in data:\n' + ctx);
    var systemPrompt = systemParts.join('\n');

    var prov = PROVIDERS[config.provider] || PROVIDERS.deepseek;

    if (prov.format === 'anthropic') {
      var resp = await fetch(prov.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: prov.model,
          max_tokens: 200,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }]
        })
      });
      if (!resp.ok) {
        var err = await resp.json().catch(function() { return {}; });
        throw new Error((err.error && err.error.message) || 'api_error_' + resp.status);
      }
      var data = await resp.json();
      return data.content[0].text.trim();
    } else {
      var resp2 = await fetch(prov.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + config.apiKey
        },
        body: JSON.stringify({
          model: prov.model,
          max_tokens: 200,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ]
        })
      });
      if (!resp2.ok) {
        var err2 = await resp2.json().catch(function() { return {}; });
        throw new Error((err2.error && err2.error.message) || 'api_error_' + resp2.status);
      }
      var data2 = await resp2.json();
      return data2.choices[0].message.content.trim();
    }
  }

  async function getMorningBriefing() {
    var ctx = await buildContext(7);
    return call(
      "Give me a brief morning reflection based on my recent patterns. What's worth being gentle about today?",
      { context: ctx }
    );
  }

  async function getEveningDebrief() {
    var ctx = await buildContext(7);
    return call(
      'Give me a brief evening reflection on my recent days. Keep it calm and grounding.',
      { context: ctx }
    );
  }

  window.AI = {
    call: call,
    buildContext: buildContext,
    hasKey: hasKey,
    getMorningBriefing: getMorningBriefing,
    getEveningDebrief: getEveningDebrief,
    getConfig: getConfig,
    PROVIDERS: PROVIDERS
  };

})();
