/* ---------------- MOCK CONTENT MAPS ---------------- */
const roleIntro = {
  "Customer Service": "Hi! I'm your Customer Service assistant. How can I help you today?",
  "Sales": "Hi there! Ask me about our products, pricing or current offers.",
  "Receptionist": "Hello, thanks for calling! How can I direct you today?",
  "Virtual Receptionist": "Hello! I'm your Virtual Receptionist. How can I help you today?",
  "HR": "Hi! I can help with leave balances, onboarding and HR policies.",
  "Appointment Booking": "Hi! Tell me a date and I'll find you an open slot.",
  "Support": "Hi! Tell me what's going wrong and I'll help troubleshoot.",
  "Task Manager": "Hi! I'm your Task Manager. Tell me what you need done and I'll organize it."
};
const roleDemo = {
  "Customer Service": {q:"What time do you open?", a:"We're open from 9 AM to 11 PM, every day."},
  "Sales": {q:"Do you have any discounts running?", a:"Yes! We currently have 15% off on all new orders this week."},
  "Receptionist": {q:"I'd like to speak to Dr. Williams.", a:"Sure, let me check his availability and connect you right away."},
  "Virtual Receptionist": {q:"I'd like to speak to Dr. Williams.", a:"Sure, let me check his availability and connect you right away."},
  "HR": {q:"How many leaves do I have left?", a:"You have 6 annual leaves remaining this year."},
  "Appointment Booking": {q:"Can I book a slot for tomorrow at 5 PM?", a:"Yes, 5 PM tomorrow is available — I've booked it for you."},
  "Support": {q:"My order hasn't arrived yet.", a:"I'm sorry about that — let me check your order status right now."},
  "Task Manager": {q:"Can you create a follow-up task for tomorrow?", a:"Done — I've created a follow-up task for tomorrow and set a reminder."}
};

/* ---------------- STATE ---------------- */
let currentStep = 1;
let selectedRole = null;
let sources = [];
function genAgentId(){ return 'agt_' + Math.random().toString(36).slice(2,10); }

const AGENTS_KEY = 'greatagen_agents';
const INBOX_KEY = 'greatagen_inbox';
const defaultAgents = [
  {id:'agt_support01', name:"Customer Support Agent", role:"Customer Service", industry:"E-commerce", language:"English", voice:"Emma (Natural)", status:"Active", channels:["Web Chat","WhatsApp","Email"], resolved:"12,456", rate:"92%", sources:[{type:'file',name:'faq.pdf'}], whatsapp:{connected:true, phone:'+1 555 010 2001', autoReply:true, demo:true}},
  {id:'agt_sales001', name:"Sales Assistant", role:"Sales", industry:"Real Estate", language:"English", voice:"Sofia (Friendly)", status:"Active", channels:["Web Chat","WhatsApp"], resolved:"8,743", rate:"88%", sources:[], whatsapp:{connected:true, phone:'+1 555 010 2002', autoReply:true, demo:true}},
  {id:'agt_recept01', name:"Virtual Receptionist", role:"Virtual Receptionist", industry:"Clinic", language:"English", voice:"James (Professional)", status:"Active", channels:["Voice","SMS","Web Chat"], resolved:"6,231", rate:"90%", sources:[], whatsapp:{connected:false, phone:'', autoReply:true, demo:true}},
  {id:'agt_collect1', name:"Collections Agent", role:"Support", industry:"Finance", language:"English", voice:"Marcus (Calm)", status:"Active", channels:["Voice","Email"], resolved:"3,123", rate:"85%", sources:[], whatsapp:{connected:false, phone:'', autoReply:true, demo:true}},
];
function normalizeAgent(a){
  if(!a.whatsapp) a.whatsapp = {connected: (a.channels||[]).includes('WhatsApp'), phone: a.whatsapp?.phone || '', autoReply:true, demo:true};
  if(a.whatsapp.connected && !(a.channels||[]).includes('WhatsApp')) a.channels = [...(a.channels||[]), 'WhatsApp'];
  const voiceMap = {'Ethan (Natural)':'Emma (Natural)', 'Oliver (Friendly)':'Sofia (Friendly)'};
  if(voiceMap[a.voice]) a.voice = voiceMap[a.voice];
  if(!a.voice) a.voice = 'Emma (Natural)';
  return a;
}
function loadAgents(){
  try{
    const raw = localStorage.getItem(AGENTS_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed) && parsed.length) return parsed.map(normalizeAgent);
    }
  }catch(e){}
  return defaultAgents.map(a=>({...a, sources:(a.sources||[]).map(s=>({...s})), whatsapp:{...a.whatsapp}}));
}
function persistAgents(){
  try{ localStorage.setItem(AGENTS_KEY, JSON.stringify(agents)); }catch(e){}
}
let agents = loadAgents();

const channelMeta = {
  'WhatsApp': {icon:'🟢', tag:'wa'},
  'Web Chat': {icon:'💬', tag:'web'},
  'Email': {icon:'📧', tag:''},
  'Instagram': {icon:'🟣', tag:''},
  'Phone': {icon:'📞', tag:''},
  'Voice': {icon:'📞', tag:''},
  'SMS': {icon:'💬', tag:''}
};
function defaultInbox(){
  const a1 = agents[0]?.id || 'agt_support01';
  const a2 = agents[1]?.id || 'agt_sales001';
  return [
    {id:'th_wa_1', channel:'WhatsApp', customer:'John D.', phone:'+1 555 014 2211', agentId:a1, updatedAt:Date.now()-120000, messages:[
      {from:'customer', text:'Hi, I need my order status', at:Date.now()-180000},
      {from:'agent', text:"Sure — please share your order number and I'll check right away.", at:Date.now()-150000},
      {from:'customer', text:'Order #48291', at:Date.now()-120000}
    ]},
    {id:'th_web_1', channel:'Web Chat', customer:'Robert R.', phone:'', agentId:a1, updatedAt:Date.now()-18*60000, messages:[
      {from:'customer', text:'Can I book an appointment?', at:Date.now()-20*60000},
      {from:'agent', text:'Yes! Tell me a preferred date and time.', at:Date.now()-18*60000}
    ]},
    {id:'th_em_1', channel:'Email', customer:'David L.', phone:'', agentId:a1, updatedAt:Date.now()-12*60000, messages:[
      {from:'customer', text:'I would like a refund for my last purchase.', at:Date.now()-12*60000}
    ]},
    {id:'th_wa_2', channel:'WhatsApp', customer:'Michael M.', phone:'+1 555 014 8833', agentId:a2, updatedAt:Date.now()-5*60000, messages:[
      {from:'customer', text:'Do you have any discounts this week?', at:Date.now()-5*60000}
    ]},
    {id:'th_ig_1', channel:'Instagram', customer:'Brian A.', phone:'', agentId:a2, updatedAt:Date.now()-31*60000, messages:[
      {from:'customer', text:'Is this property still available?', at:Date.now()-31*60000},
      {from:'agent', text:'Yes, it is still available. Want a viewing slot?', at:Date.now()-30*60000}
    ]}
  ];
}
function loadInbox(){
  try{
    const raw = localStorage.getItem(INBOX_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed) && parsed.length) return parsed;
    }
  }catch(e){}
  return defaultInbox();
}
function persistInbox(){
  try{ localStorage.setItem(INBOX_KEY, JSON.stringify(inbox)); }catch(e){}
}
let inbox = loadInbox();
let omniFilter = 'all';
let activeThreadId = null;

const recentConv = [
  {ch:"WhatsApp", icon:"🟢", name:"John D.", msg:"Order status", time:"2 min ago"},
  {ch:"Phone", icon:"📞", name:"Michael M.", msg:"Product support", time:"5 min ago"},
  {ch:"Email", icon:"📧", name:"David L.", msg:"Refund request", time:"12 min ago"},
  {ch:"Web Chat", icon:"💬", name:"Robert R.", msg:"Booking question", time:"18 min ago"},
  {ch:"Instagram", icon:"🟣", name:"Brian A.", msg:"Product inquiry", time:"31 min ago"},
];
let activeDetailId = null;

/* ---------------- INIT ---------------- */
window.onload = function(){
  persistAgents();
  persistInbox();
  renderOverview(); renderAgentsGrid(); renderConversations(); renderKnowledge(); renderIntegrations();
  const bubble = document.getElementById('wp-bubble');
  if(bubble) bubble.addEventListener('click', ()=>toggleWidgetPreview(true));
};

/* ---------------- NAV ---------------- */
const pageTitles = {overview:"Overview", agents:"AI Agents", "agent-detail":"Agent Details", conversations:"Omni Inbox", workflows:"Workflows", knowledge:"Knowledge", integrations:"Integrations", analytics:"Analytics", settings:"Settings"};
function goPage(p){
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active', el.dataset.page===p));
  document.querySelectorAll('.page').forEach(el=>el.classList.add('hidden'));
  document.getElementById('page-'+p).classList.remove('hidden');
  document.getElementById('topbar-title').textContent = pageTitles[p];
  if(p==='knowledge') renderKnowledge();
  if(p==='conversations') renderConversations();
}

/* ---------------- OVERVIEW ---------------- */
function renderOverview(){
  let n=0; const target=30509; const el=document.getElementById('kpi-conv');
  const t=setInterval(()=>{ n+=Math.ceil(target/30); if(n>=target){n=target; clearInterval(t);} el.textContent=n.toLocaleString(); },25);
  document.getElementById('top-agents-list').innerHTML = agents.map(a=>`
    <div class="agent-row" onclick="openAgentDetail('${a.id}')">
      <div class="agent-icon">${a.name.charAt(0)}</div>
      <div><div class="name">${a.name}</div><div class="meta">${a.role}</div></div>
      <div class="stat"><b>${a.resolved}</b><span>${a.rate} resolved</span></div>
    </div>`).join('');
  document.getElementById('recent-conv-list').innerHTML = recentConv.map(c=>`
    <div class="conv-row"><div class="ch-badge">${c.icon}</div>
      <div><div class="name">${c.ch} — ${c.name}</div><div class="msg">${c.msg}</div></div>
      <div class="time">${c.time}<div class="tag">Resolved</div></div></div>`).join('');
}
function renderConversations(){
  const list = document.getElementById('omni-thread-list');
  if(!list) return;
  const threads = inbox
    .filter(t => omniFilter==='all' || t.channel===omniFilter)
    .sort((a,b)=>b.updatedAt-a.updatedAt);
  if(!threads.length){
    list.innerHTML = '<p style="padding:16px;font-size:12.5px;color:var(--muted);">No conversations for this channel.</p>';
  } else {
    list.innerHTML = threads.map(t=>{
      const meta = channelMeta[t.channel] || {icon:'💬', tag:''};
      const last = t.messages[t.messages.length-1];
      const agent = agents.find(a=>a.id===t.agentId);
      const tagCls = t.channel==='WhatsApp'?'wa':(t.channel==='Web Chat'?'web':'');
      return `<div class="omni-thread ${t.channel==='WhatsApp'?'wa':''} ${t.id===activeThreadId?'active':''}" onclick="openOmniThread('${t.id}')">
        <div class="ch-badge">${meta.icon}</div>
        <div style="min-width:0;">
          <div class="name">${escapeHtml(t.customer)}</div>
          <div class="msg">${escapeHtml(last?last.text:'')}</div>
        </div>
        <div class="meta-right">
          <div class="time">${relTime(t.updatedAt)}</div>
          <span class="ch-tag ${tagCls}">${escapeHtml(t.channel)}</span>
          ${agent?`<div class="msg" style="margin-top:4px;">${escapeHtml(agent.name)}</div>`:''}
        </div>
      </div>`;
    }).join('');
  }
  if(activeThreadId && inbox.some(t=>t.id===activeThreadId)) openOmniThread(activeThreadId, true);
  else showOmniEmpty();
}
function relTime(ts){
  const m = Math.max(1, Math.round((Date.now()-ts)/60000));
  if(m < 60) return m + ' min ago';
  const h = Math.round(m/60);
  if(h < 24) return h + 'h ago';
  return Math.round(h/24) + 'd ago';
}
function setOmniFilter(f){
  omniFilter = f;
  document.querySelectorAll('.omni-filter').forEach(el=>el.classList.toggle('active', el.dataset.filter===f));
  renderConversations();
}
function showOmniEmpty(){
  document.getElementById('omni-empty')?.classList.remove('hidden');
  document.getElementById('omni-active')?.classList.add('hidden');
}
function openOmniThread(id, keepOnly){
  const t = inbox.find(x=>x.id===id); if(!t) return;
  activeThreadId = id;
  if(!keepOnly){
    document.querySelectorAll('.omni-thread').forEach(el=>el.classList.toggle('active', el.getAttribute('onclick')?.includes(id)));
  }
  const agent = agents.find(a=>a.id===t.agentId);
  document.getElementById('omni-empty').classList.add('hidden');
  document.getElementById('omni-active').classList.remove('hidden');
  const meta = channelMeta[t.channel] || {icon:'💬'};
  document.getElementById('omni-chat-head').innerHTML = `
    <div class="ch-badge">${meta.icon}</div>
    <div>
      <div class="title">${escapeHtml(t.customer)}</div>
      <div class="sub">${escapeHtml(t.channel)}${t.phone?' · '+escapeHtml(t.phone):''}</div>
    </div>
    <span class="omni-agent-chip">${escapeHtml(agent?agent.name:'Unassigned')}</span>`;
  const body = document.getElementById('omni-chat-body');
  body.classList.toggle('wa-theme', t.channel==='WhatsApp');
  body.innerHTML = t.messages.map(m=>`
    <div class="omni-bubble ${m.from==='customer'?'customer':'agent'}">${escapeHtml(m.text)}</div>`).join('');
  body.scrollTop = body.scrollHeight;
  const input = document.getElementById('omni-reply');
  if(input) input.placeholder = t.channel==='WhatsApp' ? 'Reply on WhatsApp (demo)…' : 'Reply as the AI agent…';
}
function sendOmniReply(){
  const t = inbox.find(x=>x.id===activeThreadId); if(!t) return;
  const input = document.getElementById('omni-reply');
  let text = (input.value||'').trim();
  const agent = agents.find(a=>a.id===t.agentId);
  if(!text && agent){
    const lastCustomer = [...t.messages].reverse().find(m=>m.from==='customer');
    if(lastCustomer){
      const kb = answerFromSources(lastCustomer.text, agent.sources);
      text = kb.cite ? kb.answer : (roleDemo[agent.role]?.a || 'Thanks — we are looking into this for you.');
    }
  }
  if(!text){ showToast('Type a reply first'); return; }
  t.messages.push({from:'agent', text, at:Date.now()});
  t.updatedAt = Date.now();
  input.value = '';
  persistInbox();
  renderConversations();
  openOmniThread(t.id);
  showToast(t.channel==='WhatsApp' ? 'WhatsApp reply sent (demo)' : 'Reply sent');
}
function renderKnowledge(){
  fillKnowledgeAgentSelects();
  let all = [];
  agents.forEach(a=>a.sources.forEach((s,i)=>all.push({...s, agent:a.name, agentId:a.id, sourceIndex:i})));
  const list = document.getElementById('knowledge-list');
  if(all.length===0){
    list.innerHTML = '<p style="font-size:12.5px; color:var(--muted);">No knowledge sources yet. Add a website URL above.</p>';
    return;
  }
  list.innerHTML = all.map(s=>{
    const status = sourceStatusLabel(s);
    const cls = s.status==='extracting' ? 'extracting' : (s.status==='error' ? 'error' : 'uploaded');
    const snip = s.content ? `<span class="preview-snip">${escapeHtml(s.content.slice(0,140))}…</span>` : '';
    return `<div class="source-item ${cls}"><div class="ic">${s.type==='url'?'🌐':'📄'}</div>
      <div><div class="name">${escapeHtml(s.name)}</div><div class="sub">${status} · ${escapeHtml(s.agent)}</div>${snip}</div>
      <button class="rm" onclick="removeKnowledgeSource('${s.agentId}',${s.sourceIndex})" title="Remove">✕</button></div>`;
  }).join('');
}
function fillKnowledgeAgentSelects(){
  const opts = agents.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  const kb = document.getElementById('kb-agent');
  const ask = document.getElementById('kb-ask-agent');
  if(kb){ const v=kb.value; kb.innerHTML = opts || '<option value="">No agents</option>'; if(v) kb.value=v; }
  if(ask){ const v=ask.value; ask.innerHTML = opts || '<option value="">No agents</option>'; if(v) ask.value=v; }
}
function sourceStatusLabel(s){
  if(s.type==='file') return 'File uploaded';
  if(s.status==='extracting') return 'Extracting content…';
  if(s.status==='error') return s.error || 'Extraction failed';
  if(s.content) return `${(s.wordCount||0).toLocaleString()} words extracted`;
  return 'Ready';
}
function escapeHtml(str){
  return String(str||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function removeKnowledgeSource(agentId, index){
  const a = agents.find(x=>x.id===agentId); if(!a) return;
  a.sources.splice(index,1);
  renderKnowledge();
  if(activeDetailId===agentId) renderDetailSources();
  persistAgents();
  showToast('Source removed');
}

/* ---------------- WEBSITE EXTRACT + ANSWER ---------------- */
function normalizeUrl(raw){
  let u = (raw||'').trim();
  if(!u) return null;
  if(!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { return new URL(u).href; } catch(e){ return null; }
}
function parseHtmlToText(html){
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript,svg,iframe,nav,footer,header').forEach(el=>el.remove());
  const title = (doc.querySelector('title')?.textContent || '').trim();
  const desc = (doc.querySelector('meta[name="description"]')?.getAttribute('content') || '').trim();
  const main = doc.querySelector('main, article, [role="main"], .content, #content, body');
  let text = (main || doc.body)?.innerText || '';
  text = text.replace(/\s+\n/g,'\n').replace(/\n{3,}/g,'\n\n').replace(/[ \t]{2,}/g,' ').trim();
  if(desc && !text.includes(desc)) text = desc + '\n\n' + text;
  if(title && !text.startsWith(title)) text = title + '\n\n' + text;
  return { title: title || 'Website', content: text.slice(0, 50000) };
}
async function extractWebsiteContent(url){
  const proxies = [
    (u)=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u)=>`https://corsproxy.io/?${encodeURIComponent(u)}`
  ];
  let lastErr = 'Could not reach website';
  for(const build of proxies){
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), 20000);
    try{
      const res = await fetch(build(url), { signal: ctrl.signal });
      clearTimeout(timer);
      if(!res.ok){ lastErr = 'Website returned ' + res.status; continue; }
      const html = await res.text();
      if(!html || html.length < 40){ lastErr = 'No readable content found'; continue; }
      const parsed = parseHtmlToText(html);
      if(!parsed.content || parsed.content.length < 40){ lastErr = 'No readable content found'; continue; }
      const wordCount = parsed.content.split(/\s+/).filter(Boolean).length;
      return { title: parsed.title, content: parsed.content, wordCount, status: 'ready' };
    }catch(e){
      clearTimeout(timer);
      lastErr = e.name === 'AbortError' ? 'Request timed out' : (e.message || 'Extraction failed');
    }
  }
  throw new Error(lastErr);
}
function answerFromSources(question, sources){
  const q = (question||'').trim();
  if(!q) return { answer: 'Please type a question.', cite: null };
  const urlSources = (sources||[]).filter(s=>s.type==='url' && s.content && s.status!=='error');
  if(!urlSources.length) return { answer: 'No extracted website content yet. Add a URL and click Extract first.', cite: null };

  const stop = new Set(['the','a','an','and','or','to','of','in','on','for','is','are','what','when','where','how','do','does','can','you','your','me','my','we','our','with','from','about','please','tell']);
  let tokens = q.toLowerCase().replace(/[^\w\s]/g,' ').split(/\s+/).filter(t=>t.length>2 && !stop.has(t));
  if(!tokens.length) tokens = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0,3);

  let best = { score:0, para:'', source:null };
  urlSources.forEach(src=>{
    const paras = src.content.split(/\n+/).map(p=>p.trim()).filter(p=>p.length>40);
    paras.forEach(para=>{
      const lower = para.toLowerCase();
      let score = 0;
      tokens.forEach(t=>{ if(lower.includes(t)) score += 1 + (t.length>5?0.5:0); });
      if(score > best.score) best = { score, para, source: src };
    });
  });

  if(best.score === 0){
    const fallback = urlSources[0];
    const snippet = fallback.content.split(/\n+/).map(p=>p.trim()).filter(p=>p.length>40)[0] || fallback.content.slice(0,280);
    return {
      answer: `I couldn't find an exact match, but here's related content from ${fallback.name}:\n\n${snippet.slice(0,420)}${snippet.length>420?'…':''}`,
      cite: fallback.name
    };
  }
  return {
    answer: best.para.slice(0,520) + (best.para.length>520?'…':''),
    cite: best.source.name
  };
}
function clearKbAnswer(){
  const el = document.getElementById('kb-answer');
  if(el) el.innerHTML = '<div class="kb-answer-empty">Answers from your website content will appear here.</div>';
}
async function addKnowledgeUrl(){
  const agentId = document.getElementById('kb-agent').value;
  const a = agents.find(x=>x.id===agentId);
  if(!a){ showToast('Select an agent first'); return; }
  const url = normalizeUrl(document.getElementById('kb-url').value);
  if(!url){ showToast('Enter a valid website URL'); return; }
  const btn = document.getElementById('kb-url-btn');
  btn.disabled = true; btn.textContent = 'Extracting…';
  const source = { type:'url', name:url, status:'extracting', content:'', wordCount:0 };
  a.sources.push(source);
  renderKnowledge();
  try{
    const data = await extractWebsiteContent(url);
    Object.assign(source, data);
    document.getElementById('kb-url').value = '';
    showToast('Website content extracted');
  }catch(err){
    source.status = 'error';
    source.error = err.message || 'Extraction failed';
    showToast(source.error);
  }
  btn.disabled = false; btn.textContent = 'Extract';
  renderKnowledge();
  if(activeDetailId===agentId) renderDetailSources();
  persistAgents();
}
function askKnowledge(){
  const agentId = document.getElementById('kb-ask-agent').value;
  const a = agents.find(x=>x.id===agentId);
  const q = document.getElementById('kb-ask').value;
  const box = document.getElementById('kb-answer');
  if(!a){ box.innerHTML = '<div class="kb-answer-empty">Select an agent.</div>'; return; }
  const result = answerFromSources(q, a.sources);
  box.innerHTML = `<div class="title">${escapeHtml(a.name)}</div><div>${escapeHtml(result.answer).replace(/\n/g,'<br>')}</div>${result.cite?`<div class="cite">Source: ${escapeHtml(result.cite)}</div>`:''}`;
}

async function addDetailUrl(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  const url = normalizeUrl(document.getElementById('detail-url').value);
  if(!url){ showToast('Enter a valid website URL'); return; }
  const btn = document.getElementById('detail-url-btn');
  btn.disabled = true; btn.textContent = 'Extracting…';
  const source = { type:'url', name:url, status:'extracting', content:'', wordCount:0 };
  a.sources.push(source);
  renderDetailSources(); renderKnowledge();
  try{
    const data = await extractWebsiteContent(url);
    Object.assign(source, data);
    document.getElementById('detail-url').value = '';
    showToast('Website content extracted');
  }catch(err){
    source.status = 'error';
    source.error = err.message || 'Extraction failed';
    showToast(source.error);
  }
  btn.disabled = false; btn.textContent = 'Extract';
  renderDetailSources(); renderKnowledge();
  persistAgents();
}
function askDetailKnowledge(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  const q = document.getElementById('detail-ask').value;
  const box = document.getElementById('detail-kb-answer');
  const result = answerFromSources(q, a.sources);
  box.style.display = 'block';
  box.innerHTML = `<div>${escapeHtml(result.answer).replace(/\n/g,'<br>')}</div>${result.cite?`<div class="cite">Source: ${escapeHtml(result.cite)}</div>`:''}`;
}

async function addWizardUrl(){
  const url = normalizeUrl(document.getElementById('w-url').value);
  if(!url){ showToast('Enter a valid website URL'); return; }
  const btn = document.getElementById('w-url-btn');
  btn.disabled = true; btn.textContent = 'Extracting…';
  const source = { type:'url', name:url, status:'extracting', content:'', wordCount:0 };
  sources.push(source);
  renderSourceList();
  try{
    const data = await extractWebsiteContent(url);
    Object.assign(source, data);
    document.getElementById('w-url').value = '';
    showToast('Website content extracted');
  }catch(err){
    source.status = 'error';
    source.error = err.message || 'Extraction failed';
    showToast(source.error);
  }
  btn.disabled = false; btn.textContent = 'Extract';
  renderSourceList();
}

/* ---------------- AGENTS GRID ---------------- */
function renderAgentsGrid(){
  const grid = document.getElementById('agents-grid');
  grid.innerHTML = agents.map(a=>`
    <div class="agent-card" onclick="openAgentDetail('${a.id}')">
      <div class="top">
        <div class="agent-icon">${a.name.charAt(0)}</div>
        <div><h4>${a.name}</h4><div class="role">${a.role} · ${a.industry}</div></div>
        <div class="status">${a.status}</div>
      </div>
      <div class="chips">${a.channels.map(c=>`<span class="chip">${c}</span>`).join('')}</div>
      <div class="foot">
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openAgentDetail('${a.id}')">Manage</button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteAgent('${a.id}')">Delete</button>
      </div>
    </div>`).join('') + `
    <div class="create-card" onclick="openWizard()"><div class="plus">+</div><b>Create New Agent</b></div>`;
}

/* ---------------- INTEGRATIONS ---------------- */
function renderIntegrations(){
  const grid = document.getElementById('integrations-agents-grid');
  if(!agents.length){
    grid.innerHTML = '<div class="placeholder-card"><b>No agents yet</b>Create an agent to manage its integrations.</div>';
    return;
  }
  grid.innerHTML = agents.map(a=>`
    <div class="agent-card" onclick="openAgentDetail('${a.id}')">
      <div class="top">
        <div class="agent-icon">${a.name.charAt(0)}</div>
        <div><h4>${a.name}</h4><div class="role">${a.role} · ${a.industry}</div></div>
        <div class="status">${a.status}</div>
      </div>
      <div class="chips">${a.channels.map(c=>`<span class="chip">${c}</span>`).join('')}</div>
      <div class="foot">
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openAgentDetail('${a.id}'); detailTab('channels')">Manage channels</button>
      </div>
    </div>`).join('');
}

/* ---------------- AGENT DETAIL PAGE ---------------- */
function openAgentDetail(id){
  const a = agents.find(x=>x.id===id); if(!a) return;
  activeDetailId = id;
  document.getElementById('detail-avatar').textContent = a.name.charAt(0);
  document.getElementById('detail-name').textContent = a.name;
  document.getElementById('detail-sub').textContent = a.role + ' · ' + a.industry;
  document.getElementById('e-name').value = a.name;
  document.getElementById('e-role').value = a.role;
  document.getElementById('e-industry').value = a.industry;
  document.getElementById('e-lang').value = a.language;
  const voiceEl = document.getElementById('e-voice');
  voiceEl.value = a.voice || '';
  if(!voiceEl.value) voiceEl.selectedIndex = 0;
  editPreviewUpdate();
  renderDetailSources();
  document.getElementById('an-conv').textContent = a.resolved;
  document.getElementById('an-rate').textContent = a.rate;
  detailTab('edit');
  goPage('agent-detail');
}
function deleteAgent(id){
  if(!id) id = activeDetailId;
  const a = agents.find(x=>x.id===id);
  if(!a){ showToast('Agent not found'); return; }
  const ok = confirm(`Delete "${a.name}"?\n\nThis removes the agent, its knowledge links in this workspace, and related inbox threads. This cannot be undone.`);
  if(!ok) return;
  agents = agents.filter(x=>x.id!==id);
  inbox = inbox.filter(t=>t.agentId!==id);
  if(activeThreadId && !inbox.some(t=>t.id===activeThreadId)) activeThreadId = null;
  if(activeDetailId===id) activeDetailId = null;
  persistAgents();
  persistInbox();
  renderAgentsGrid();
  renderOverview();
  renderKnowledge();
  renderIntegrations();
  renderConversations();
  showToast('Agent deleted');
  goPage('agents');
}
function detailTab(t){
  document.querySelectorAll('.detail-tab').forEach(el=>el.classList.toggle('active', el.dataset.tab===t));
  document.querySelectorAll('.detail-tab-panel').forEach(el=>el.classList.remove('active'));
  document.getElementById('tab-'+t).classList.add('active');
  if(t==='channels'){ renderEmbedPanel(); renderWhatsAppPanel(); }
}
function editPreviewUpdate(){
  const role = document.getElementById('e-role').value;
  const voice = document.getElementById('e-voice').value;
  const lang = document.getElementById('e-lang').value;
  document.getElementById('e-preview-voice').textContent = voice.split(' ')[0];
  document.getElementById('e-preview-lang').textContent = lang;
  const demo = roleDemo[role];
  const a = agents.find(x=>x.id===activeDetailId);
  const kb = a ? answerFromSources(demo.q, a.sources) : null;
  const botA = (kb && kb.cite) ? kb.answer : demo.a;
  document.getElementById('e-preview-body').innerHTML = `
    <div class="bubble bot">${roleIntro[role]}</div>
    <div class="bubble user">${escapeHtml(demo.q)}</div>
    <div class="bubble bot">${escapeHtml(botA)}</div>`;
}
function saveEdit(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  a.name = document.getElementById('e-name').value || a.name;
  a.role = document.getElementById('e-role').value;
  a.industry = document.getElementById('e-industry').value;
  a.language = document.getElementById('e-lang').value;
  a.voice = document.getElementById('e-voice').value;
  document.getElementById('detail-name').textContent = a.name;
  document.getElementById('detail-sub').textContent = a.role + ' · ' + a.industry;
  document.getElementById('detail-avatar').textContent = a.name.charAt(0);
  renderAgentsGrid(); renderOverview(); renderIntegrations();
  persistAgents();
  showToast('Changes saved');
}
function renderDetailSources(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  document.getElementById('detail-source-list').innerHTML = a.sources.length ? a.sources.map((s,i)=>{
    const cls = s.status==='extracting' ? 'extracting' : (s.status==='error' ? 'error' : 'uploaded');
    const snip = s.content ? `<span class="preview-snip">${escapeHtml(s.content.slice(0,120))}…</span>` : '';
    return `<div class="source-item ${cls}"><div class="ic">${s.type==='url'?'🌐':'📄'}</div>
      <div><div class="name">${escapeHtml(s.name)}</div><div class="sub">${sourceStatusLabel(s)}</div>${snip}</div>
      <button class="rm" onclick="removeDetailSource(${i})">✕</button></div>`;
  }).join('')
    : '<p style="font-size:12.5px; color:var(--muted);">No knowledge sources yet. Add a website URL below.</p>';
}
function addDetailFile(e){
  const f = e.target.files[0]; if(!f) return;
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  a.sources.push({type:'file', name:f.name});
  renderDetailSources(); renderKnowledge();
  persistAgents();
  showToast('File uploaded successfully');
}
function removeDetailSource(i){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  a.sources.splice(i,1); renderDetailSources(); renderKnowledge();
  persistAgents();
}

/* ---------------- WIZARD ---------------- */
function openWizard(){
  currentStep=1; sources=[]; selectedRole=null;
  document.querySelectorAll('.role-opt').forEach(el=>el.classList.remove('selected'));
  document.getElementById('source-list').innerHTML='';
  document.getElementById('w-name').value='';
  document.getElementById('w-url').value='';
  document.getElementById('w-industry').selectedIndex=0;
  document.getElementById('w-lang').selectedIndex=0;
  document.getElementById('w-voice').selectedIndex=0;
  livePreviewUpdate();
  goStep(1);
  document.getElementById('wizard-overlay').classList.remove('hidden');
}
function closeWizard(){ document.getElementById('wizard-overlay').classList.add('hidden'); }

document.getElementById('role-grid').addEventListener('click', e=>{
  const opt = e.target.closest('.role-opt'); if(!opt) return;
  document.querySelectorAll('.role-opt').forEach(el=>el.classList.remove('selected'));
  opt.classList.add('selected'); selectedRole = opt.dataset.role;
  livePreviewUpdate();
});

function addFileSource(e){
  const f = e.target.files[0]; if(!f) return;
  sources.push({type:'file', name:f.name});
  renderSourceList();
  showToast('File uploaded successfully');
}
function renderSourceList(){
  document.getElementById('source-list').innerHTML = sources.map((s,i)=>{
    const cls = s.status==='extracting' ? 'extracting' : (s.status==='error' ? 'error' : 'uploaded');
    const icon = s.type==='url' ? '🌐' : '📄';
    const snip = s.content ? `<span class="preview-snip">${escapeHtml(s.content.slice(0,120))}…</span>` : '';
    return `<div class="source-item ${cls}"><div class="ic">${icon}</div>
      <div><div class="name">${escapeHtml(s.name)}</div><div class="sub">${sourceStatusLabel(s)}</div>${snip}</div>
      <button class="rm" onclick="removeSource(${i})">✕</button></div>`;
  }).join('');
}
function removeSource(i){ sources.splice(i,1); renderSourceList(); }

/* Live preview — updates on every field change across all steps */
function livePreviewUpdate(){
  const role = selectedRole;
  const voice = document.getElementById('w-voice').value;
  const lang = document.getElementById('w-lang').value;
  const industry = document.getElementById('w-industry').value;
  document.getElementById('pv-voice').textContent = voice.split(' ')[0];
  document.getElementById('pv-lang').textContent = lang;
  document.getElementById('pv-role-chip').textContent = 'Role: ' + (role || '—');
  document.getElementById('pv-industry-chip').textContent = 'Industry: ' + industry;
  const body = document.getElementById('pv-body');
  if(!role){
    body.innerHTML = `<div class="bubble bot">Choose a role on the left to see how your agent will greet customers.</div>`;
  } else {
    body.innerHTML = `<div class="bubble bot">${roleIntro[role]}</div>`;
  }
}

function goStep(n){
  currentStep = n;
  document.querySelectorAll('.wiz-panel').forEach(el=>el.classList.remove('active'));
  document.getElementById('wiz-'+n).classList.add('active');
  document.querySelectorAll('.step').forEach(el=>{
    const s = parseInt(el.dataset.step);
    el.classList.toggle('active', s===n); el.classList.toggle('done', s<n);
  });
  document.getElementById('wiz-back').style.visibility = n===1 ? 'hidden' : 'visible';
  const rightBtns = document.getElementById('wiz-right-btns');
  if(n===3){
    rightBtns.innerHTML = `
      <button class="btn btn-outline" onclick="openDemoModal()">Try Demo</button>
      <button class="btn btn-primary" style="width:auto; padding:11px 24px;" onclick="createAgent()">Create Agent</button>`;
  } else {
    rightBtns.innerHTML = `<button class="btn btn-primary" id="wiz-next" style="width:auto; padding:11px 24px;" onclick="wizNext()">Continue</button>`;
  }
}
function wizBack(){ if(currentStep>1) goStep(currentStep-1); }
function wizNext(){
  if(currentStep===1 && !selectedRole){ showToast('Choose a role to continue'); return; }
  goStep(currentStep+1);
}

/* Try Demo modal */
function openDemoModal(){
  const role = selectedRole || 'Customer Service';
  const industry = document.getElementById('w-industry').value;
  document.getElementById('demo-sub').textContent = role + ' · ' + industry;
  const demo = roleDemo[role];
  const body = document.getElementById('demo-body');
  body.innerHTML = `<div class="bubble bot">${roleIntro[role]}</div>`;
  document.getElementById('demo-overlay').classList.remove('hidden');

  const kb = answerFromSources(demo.q, sources);
  const hasKb = sources.some(s=>s.type==='url' && s.content);
  const userQ = hasKb ? (document.getElementById('w-url')?.dataset.lastQ || demo.q) : demo.q;
  const botA = hasKb && kb.cite ? kb.answer : demo.a;

  setTimeout(()=>{
    body.innerHTML += `<div class="bubble user">${escapeHtml(userQ)}</div><div class="demo-typing"><span></span><span></span><span></span></div>`;
  }, 500);
  setTimeout(()=>{
    const typing = body.querySelector('.demo-typing'); if(typing) typing.remove();
    body.innerHTML += `<div class="bubble bot">${escapeHtml(botA)}</div>`;
  }, 1500);
}
function closeDemoModal(){ document.getElementById('demo-overlay').classList.add('hidden'); }

/* Create agent */
function createAgent(){
  const id = genAgentId();
  const name = document.getElementById('w-name').value || (selectedRole + ' Agent');
  const newAgent = {
    id:id, name:name, role:selectedRole || 'Customer Service',
    industry: document.getElementById('w-industry').value,
    language: document.getElementById('w-lang').value,
    voice: document.getElementById('w-voice').value,
    status:'Active', channels:['Web Chat'], resolved:'0', rate:'—',
    sources: sources.slice(),
    whatsapp:{connected:false, phone:'', autoReply:true, demo:true}
  };
  agents.unshift(newAgent);
  persistAgents();
  closeWizard();
  renderAgentsGrid(); renderOverview(); renderKnowledge(); renderIntegrations();
  showToast('Agent created — copy your embed code');
  openAgentDetail(id);
  detailTab('channels');
}

/* ---------------- EMBED CODE + PREVIEW ---------------- */
function getWidgetScriptUrl(){
  if(location.protocol === 'http:' || location.protocol === 'https:'){
    const path = location.pathname.replace(/[^/]*$/, '');
    return location.origin + path + 'js/widget.js';
  }
  return 'js/widget.js';
}
function getEmbedCode(agentId){
  const src = getWidgetScriptUrl();
  return `<script src="${src}" data-agent-id="${agentId}" defer><\/script>`;
}
function renderEmbedPanel(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  const code = getEmbedCode(a.id);
  const ta = document.getElementById('embed-code');
  if(ta) ta.value = code;
  const link = document.getElementById('embed-preview-link');
  if(link) link.href = 'widget-demo.html?agent=' + encodeURIComponent(a.id);
  const meta = document.getElementById('embed-meta');
  if(meta){
    const wa = a.whatsapp?.connected ? ' · WhatsApp demo connected' : '';
    meta.innerHTML = `Agent ID: <code>${escapeHtml(a.id)}</code><br>Channels: ${a.channels.map(c=>escapeHtml(c)).join(' · ')} · Web Chat widget enabled${wa}`;
  }
  document.getElementById('wp-chat-title').textContent = a.name;
  document.getElementById('wp-chat-sub').textContent = a.role + ' · Online';
  const body = document.getElementById('wp-chat-body');
  body.innerHTML = `<div class="bubble bot">${escapeHtml(roleIntro[a.role] || 'Hi! How can I help you today?')}</div>`;
  toggleWidgetPreview(false);
}

function renderWhatsAppPanel(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  normalizeAgent(a);
  const pill = document.getElementById('wa-status-pill');
  const btn = document.getElementById('wa-connect-btn');
  const phone = document.getElementById('wa-phone');
  const ar = document.getElementById('wa-autoreply');
  if(phone && !phone.dataset.touched) phone.value = a.whatsapp.phone || '+1 555 010 2001';
  if(ar) ar.value = a.whatsapp.autoReply === false ? 'off' : 'on';
  if(a.whatsapp.connected){
    pill.textContent = 'Connected (demo)';
    pill.classList.add('on');
    btn.textContent = 'Disconnect';
  } else {
    pill.textContent = 'Disconnected';
    pill.classList.remove('on');
    btn.textContent = 'Connect WhatsApp';
  }
}
function toggleWhatsAppDemo(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  normalizeAgent(a);
  const phoneEl = document.getElementById('wa-phone');
  const ar = document.getElementById('wa-autoreply');
  if(a.whatsapp.connected){
    a.whatsapp.connected = false;
    a.channels = (a.channels||[]).filter(c=>c!=='WhatsApp');
    showToast('WhatsApp disconnected (demo)');
  } else {
    a.whatsapp.connected = true;
    a.whatsapp.demo = true;
    a.whatsapp.phone = (phoneEl?.value || '').trim() || '+1 555 010 2001';
    a.whatsapp.autoReply = ar?.value !== 'off';
    if(!(a.channels||[]).includes('WhatsApp')) a.channels.push('WhatsApp');
    showToast('WhatsApp connected (demo)');
  }
  persistAgents();
  renderWhatsAppPanel();
  renderEmbedPanel();
  renderAgentsGrid();
  renderIntegrations();
}
function simulateWhatsAppIncoming(fromInbox){
  let a = agents.find(x=>x.id===activeDetailId);
  if(!a || !a.whatsapp?.connected){
    a = agents.find(x=>x.whatsapp?.connected) || agents[0];
  }
  if(!a){ showToast('Create an agent first'); return; }
  if(!a.whatsapp?.connected){
    normalizeAgent(a);
    a.whatsapp.connected = true;
    a.whatsapp.phone = a.whatsapp.phone || '+1 555 010 2001';
    if(!(a.channels||[]).includes('WhatsApp')) a.channels.push('WhatsApp');
    persistAgents();
  }
  const samples = [
    'Hi! What are your opening hours?',
    'Can you help me track my order?',
    'Do you deliver on weekends?',
    'I want to speak with support.',
    'Is there any discount available?'
  ];
  const text = samples[Math.floor(Math.random()*samples.length)];
  const names = ['Tom H.','Chris P.','Mark W.','Alex R.','Peter K.'];
  const customer = names[Math.floor(Math.random()*names.length)];
  const thread = {
    id: 'th_wa_' + Math.random().toString(36).slice(2,8),
    channel: 'WhatsApp',
    customer,
    phone: '+1 555 01' + Math.floor(10000+Math.random()*89999),
    agentId: a.id,
    updatedAt: Date.now(),
    messages: [{from:'customer', text, at:Date.now()}]
  };
  if(a.whatsapp.autoReply !== false){
    const kb = answerFromSources(text, a.sources);
    const answer = kb.cite ? kb.answer : (roleDemo[a.role]?.a || roleIntro[a.role] || 'Thanks for messaging us on WhatsApp!');
    thread.messages.push({from:'agent', text:answer, at:Date.now()+1});
  }
  inbox.unshift(thread);
  persistInbox();
  activeThreadId = thread.id;
  omniFilter = fromInbox ? omniFilter : 'WhatsApp';
  if(!fromInbox) setOmniFilter('WhatsApp');
  else renderConversations();
  goPage('conversations');
  openOmniThread(thread.id);
  showToast('Incoming WhatsApp message (demo)');
}

function copyEmbedCode(){
  const ta = document.getElementById('embed-code');
  if(!ta || !ta.value) return;
  navigator.clipboard.writeText(ta.value).then(()=>{
    showToast('Embed code copied');
  }).catch(()=>{
    ta.select();
    document.execCommand('copy');
    showToast('Embed code copied');
  });
}
function toggleWidgetPreview(open){
  const chat = document.getElementById('wp-chat');
  if(!chat) return;
  if(typeof open === 'boolean') chat.classList.toggle('hidden', !open);
  else chat.classList.toggle('hidden');
}
function sendWidgetPreview(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  const input = document.getElementById('wp-chat-input');
  const q = (input.value || '').trim();
  if(!q) return;
  const body = document.getElementById('wp-chat-body');
  body.innerHTML += `<div class="bubble user">${escapeHtml(q)}</div>`;
  input.value = '';
  body.innerHTML += `<div class="demo-typing" id="wp-typing"><span></span><span></span><span></span></div>`;
  body.scrollTop = body.scrollHeight;
  setTimeout(()=>{
    const typing = document.getElementById('wp-typing'); if(typing) typing.remove();
    const kb = answerFromSources(q, a.sources);
    const demo = roleDemo[a.role];
    const answer = kb.cite ? kb.answer : (demo ? demo.a : "Thanks for your message — I'll help you with that.");
    body.innerHTML += `<div class="bubble bot">${escapeHtml(answer)}</div>`;
    body.scrollTop = body.scrollHeight;
  }, 700);
}

/* ---------------- TOAST ---------------- */
let toastTimer;
function showToast(msg){
  const t = document.getElementById('toast');
  document.getElementById('toast-text').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2600);
}
