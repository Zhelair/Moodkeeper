(function(){
  TrackboardRouter.register('home', async (mount)=>{
    const d = new Date();
    document.getElementById('brand-subtitle').textContent =
      `Today · ${UI.fmtDate(d)} · Private · Stored on this device`;

    const stack = UI.h('div',{class:'stack'},[]);

    const primary = UI.h('div',{class:'card'},[
      UI.h('div',{class:'h1'},['Today']),
      UI.h('p',{class:'p'},['Pick one small action. Ten seconds counts.']),
      UI.h('div',{class:'hr'},[]),
      UI.h('div',{class:'col'},[
        UI.h('button',{class:'btn primary full', type:'button', 'data-route':'checkin'},['Check in']),
        UI.h('button',{class:'btn full', type:'button', 'data-route':'calm'},['Calm']),
        UI.h('button',{class:'btn full', type:'button', 'data-route':'alcohol'},['Alcohol'])
      ]),
      UI.h('p',{class:'small', style:'margin-top:10px'},['Nothing here leaves your device.'])
    ]);

    const notebook = UI.h('div',{class:'card soft'},[
      UI.h('div',{class:'h2'},['Notebook']),
      UI.h('div',{class:'col'},[
        UI.h('button',{class:'btn full', type:'button', 'data-route':'goals'},['Goals']),
        UI.h('button',{class:'btn full', type:'button', 'data-route':'insights'},['Insights'])
      ])
    ]);

    stack.appendChild(primary);
    stack.appendChild(notebook);
    mount.appendChild(stack);
  });
})();
