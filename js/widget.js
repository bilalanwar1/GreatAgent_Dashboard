/* GreatAgen embeddable chat widget — answers only from agent knowledge */
(function () {
  'use strict';

  const roleIntro = {
    'Customer Service': "Hi! I'm your Customer Service assistant. How can I help you today?",
    Sales: 'Hi there! Ask me about our products, pricing or current offers.',
    Receptionist: 'Hello, thanks for calling! How can I direct you today?',
    'Virtual Receptionist': "Hello! I'm your Virtual Receptionist. How can I help you today?",
    'Inbound Call Agent': "Thank you for calling. I'm your AI inbound agent — how can I help you today?",
    'Outbound Call Agent': 'Hello, this is your AI outbound agent calling. Do you have a moment to talk?',
    HR: 'Hi! I can help with leave balances, onboarding and HR policies.',
    'Appointment Booking': "Hi! Tell me a date and I'll find you an open slot.",
    Support: "Hi! Tell me what's going wrong and I'll help troubleshoot.",
    'Task Manager': "Hi! I'm your Task Manager. Tell me what you need done and I'll organize it."
  };

  function getScriptEl() {
    return document.currentScript || document.querySelector('script[data-agent-id]');
  }

  function loadAgent(id) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || key.indexOf('greatagen_agents') !== 0) continue;
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        if (!Array.isArray(list)) continue;
        const found = list.find((a) => a.id === id);
        if (found) return found;
      }
    } catch (e) {}
    return null;
  }

  function answerQuestion(question, agent) {
    if (typeof Knowledge !== 'undefined' && Knowledge.answerFromKnowledge) {
      return Knowledge.answerFromKnowledge(question, agent);
    }
    return {
      answer:
        'Knowledge engine not loaded. Include js/knowledge.js before the widget script.',
      cite: null,
      found: false
    };
  }

  function injectStyles() {
    if (document.getElementById('greatagen-widget-css')) return;
    const style = document.createElement('style');
    style.id = 'greatagen-widget-css';
    style.textContent = `
      #greatagen-root{all:initial;font-family:Inter,system-ui,-apple-system,sans-serif;position:fixed;right:20px;bottom:20px;z-index:2147483000;}
      #greatagen-root *{box-sizing:border-box;font-family:inherit;}
      .ga-bubble{width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(135deg,#5B5FEF,#8B5CF6);color:#fff;font-size:24px;box-shadow:0 12px 28px -8px rgba(91,95,239,.55);display:flex;align-items:center;justify-content:center;}
      .ga-panel{position:absolute;right:0;bottom:72px;width:360px;max-width:calc(100vw - 24px);height:480px;max-height:calc(100vh - 100px);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 24px 50px -18px rgba(11,15,25,.45);border:1px solid #E7E9F3;display:none;flex-direction:column;}
      .ga-panel.open{display:flex;}
      .ga-head{background:#0B0F19;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;}
      .ga-title{font-size:14px;font-weight:700;margin:0;}
      .ga-sub{font-size:11px;color:#AEB1C6;margin-top:2px;}
      .ga-close{border:none;background:rgba(255,255,255,.12);color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;}
      .ga-body{flex:1;overflow:auto;padding:14px;background:#F8F8FC;display:flex;flex-direction:column;gap:8px;}
      .ga-msg{max-width:82%;padding:9px 12px;border-radius:10px;font-size:13px;line-height:1.45;white-space:pre-wrap;}
      .ga-msg.bot{align-self:flex-start;background:#fff;border:1px solid #E7E9F3;border-bottom-left-radius:3px;color:#0F1424;}
      .ga-msg.user{align-self:flex-end;background:linear-gradient(135deg,#5B5FEF,#8B5CF6);color:#fff;border-bottom-right-radius:3px;}
      .ga-typing{align-self:flex-start;background:#fff;border:1px solid #E7E9F3;border-radius:10px;padding:10px 12px;display:flex;gap:4px;}
      .ga-typing i{width:6px;height:6px;border-radius:50%;background:#9498A6;display:block;animation:gaBlink 1.2s infinite;}
      .ga-typing i:nth-child(2){animation-delay:.2s}.ga-typing i:nth-child(3){animation-delay:.4s}
      @keyframes gaBlink{0%,80%,100%{opacity:.25}40%{opacity:1}}
      .ga-foot{display:flex;gap:8px;padding:12px;border-top:1px solid #E7E9F3;background:#fff;}
      .ga-foot input{flex:1;border:1px solid #E7E9F3;border-radius:9px;padding:10px 12px;font-size:13px;outline:none;min-width:0;color:#0F1424;}
      .ga-foot input:focus{border-color:#5B5FEF;box-shadow:0 0 0 3px rgba(91,95,239,.12);}
      .ga-send{border:none;border-radius:9px;padding:0 14px;background:linear-gradient(135deg,#5B5FEF,#8B5CF6);color:#fff;font-weight:600;font-size:13px;cursor:pointer;}
      .ga-powered{font-size:10px;color:#9498A6;text-align:center;padding:0 12px 10px;background:#fff;}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    const script = getScriptEl();
    const agentId = script && script.getAttribute('data-agent-id');
    if (!agentId) return;

    const agent = loadAgent(agentId) || {
      id: agentId,
      name: 'GreatAgen Assistant',
      role: 'Customer Service',
      sources: []
    };

    injectStyles();

    const root = document.createElement('div');
    root.id = 'greatagen-root';
    root.innerHTML = `
      <div class="ga-panel" id="ga-panel" role="dialog" aria-label="Chat">
        <div class="ga-head">
          <div>
            <div class="ga-title"></div>
            <div class="ga-sub">Online · powered by GreatAgen</div>
          </div>
          <button class="ga-close" type="button" aria-label="Close">✕</button>
        </div>
        <div class="ga-body" id="ga-body"></div>
        <div class="ga-foot">
          <input id="ga-input" type="text" placeholder="Type your message…" autocomplete="off" />
          <button class="ga-send" type="button">Send</button>
        </div>
        <div class="ga-powered">GreatAgen</div>
      </div>
      <button class="ga-bubble" type="button" aria-label="Open chat">💬</button>
    `;
    document.body.appendChild(root);

    const panel = root.querySelector('#ga-panel');
    const body = root.querySelector('#ga-body');
    const input = root.querySelector('#ga-input');
    root.querySelector('.ga-title').textContent = agent.name;
    root.querySelector('.ga-bubble').addEventListener('click', () => panel.classList.toggle('open'));
    root.querySelector('.ga-close').addEventListener('click', () => panel.classList.remove('open'));

    function addMsg(text, who) {
      const el = document.createElement('div');
      el.className = 'ga-msg ' + who;
      el.textContent = text;
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
    }

    addMsg(roleIntro[agent.role] || 'Hi! How can I help you today?', 'bot');

    function reply() {
      const q = input.value.trim();
      if (!q) return;
      addMsg(q, 'user');
      input.value = '';
      const typing = document.createElement('div');
      typing.className = 'ga-typing';
      typing.innerHTML = '<i></i><i></i><i></i>';
      body.appendChild(typing);
      body.scrollTop = body.scrollHeight;

      setTimeout(() => {
        typing.remove();
        const latest = loadAgent(agentId) || agent;
        const result = answerQuestion(q, latest);
        addMsg(result.answer, 'bot');
      }, 650);
    }

    root.querySelector('.ga-send').addEventListener('click', reply);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') reply();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
