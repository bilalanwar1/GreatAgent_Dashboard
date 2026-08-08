/* ---------------- MOCK CONTENT MAPS ---------------- */
const roleIntro = {
  "Customer Service": "Hi! I'm your Customer Service assistant. How can I help you today?",
  "Sales": "Hi there! Ask me about our products, pricing or current offers.",
  "Receptionist": "Hello, thanks for calling! How can I direct you today?",
  "Virtual Receptionist": "Hello! I'm your Virtual Receptionist. How can I help you today?",
  "Inbound Call Agent": "Thank you for calling. I'm your AI inbound agent — how can I help you today?",
  "Outbound Call Agent": "Hello, this is your AI outbound agent calling. Do you have a moment to talk?",
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
  "Inbound Call Agent": {q:"I need help with my appointment.", a:"Of course — I can look that up. May I have your name and preferred date?"},
  "Outbound Call Agent": {q:"Who is calling?", a:"This is your GreatAgen outbound agent with a short update. Is now a good time?"},
  "HR": {q:"How many leaves do I have left?", a:"You have 6 annual leaves remaining this year."},
  "Appointment Booking": {q:"Can I book a slot for tomorrow at 5 PM?", a:"Yes, 5 PM tomorrow is available — I've booked it for you."},
  "Support": {q:"My order hasn't arrived yet.", a:"I'm sorry about that — let me check your order status right now."},
  "Task Manager": {q:"Can you create a follow-up task for tomorrow?", a:"Done — I've created a follow-up task for tomorrow and set a reminder."}
};
function isCallAgentRole(role){
  return role === 'Inbound Call Agent' || role === 'Outbound Call Agent';
}

/* ---------------- STATE ---------------- */
let currentStep = 1;
let selectedRole = null;
let sources = [];
function genAgentId(){ return 'agt_' + Math.random().toString(36).slice(2,10); }

const AGENTS_KEY_PREFIX = 'greatagen_agents_';
const INBOX_KEY_PREFIX = 'greatagen_inbox_';
const WORKFLOWS_KEY_PREFIX = 'greatagen_workflows_';
const WORKFLOW_LOG_KEY_PREFIX = 'greatagen_workflow_log_';

function currentUserId(){
  if(typeof Auth === 'undefined') return null;
  return Auth.getCurrentUser()?.id || null;
}
function agentsStorageKey(uid){
  return AGENTS_KEY_PREFIX + (uid || 'guest');
}
function inboxStorageKey(uid){
  return INBOX_KEY_PREFIX + (uid || 'guest');
}
function workflowsStorageKey(uid){
  return WORKFLOWS_KEY_PREFIX + (uid || 'guest');
}
function workflowLogStorageKey(uid){
  return WORKFLOW_LOG_KEY_PREFIX + (uid || 'guest');
}

function normalizeAgent(a){
  if(!a.whatsapp) a.whatsapp = {connected: (a.channels||[]).includes('WhatsApp'), phone: a.whatsapp?.phone || '', autoReply:true, demo:true};
  if(a.whatsapp.connected && !(a.channels||[]).includes('WhatsApp')) a.channels = [...(a.channels||[]), 'WhatsApp'];
  const voiceMap = {'Ethan (Natural)':'Emma (Natural)', 'Oliver (Friendly)':'Sofia (Friendly)'};
  if(voiceMap[a.voice]) a.voice = voiceMap[a.voice];
  if(!a.voice) a.voice = 'Emma (Natural)';
  if(!a.voiceCalling){
    const hasVoice = (a.channels||[]).includes('Voice') || (a.channels||[]).includes('Phone');
    a.voiceCalling = {
      inbound: !!hasVoice,
      outbound: !!hasVoice,
      demo: true,
      campaign: { name:'Renewal Campaign', audience:'Expiring in 30 days', total:0, completed:0, successful:0, running:false }
    };
  }
  if(!a.voiceCalling.campaign){
    a.voiceCalling.campaign = { name:'Renewal Campaign', audience:'Expiring in 30 days', total:0, completed:0, successful:0, running:false };
  }
  sanitizeCampaign(a.voiceCalling.campaign);
  if(!a.voiceNotes){
    a.voiceNotes = { enabled:false, maxSeconds:60, transcribe:true, widgetMic:true };
  }
  a.voiceNotes.enabled = !!a.voiceNotes.enabled;
  a.voiceNotes.transcribe = a.voiceNotes.transcribe !== false;
  a.voiceNotes.widgetMic = a.voiceNotes.widgetMic !== false;
  const maxSec = Number(a.voiceNotes.maxSeconds);
  a.voiceNotes.maxSeconds = [15,30,60,90,120].includes(maxSec) ? maxSec : 60;
  if(a.resolved == null) a.resolved = '0';
  if(a.rate == null) a.rate = '—';
  if(!Array.isArray(a.sources)) a.sources = [];
  if(!Array.isArray(a.channels)) a.channels = [];
  return a;
}
function sanitizeCampaign(c){
  if(!c) return c;
  // Strip legacy shared demo totals so each user starts clean
  if(Number(c.total) === 1250 && Number(c.completed) === 1024 && !c.running){
    c.total = 0;
    c.completed = 0;
    c.successful = 0;
  }
  c.total = Math.max(0, Number(c.total) || 0);
  c.completed = Math.max(0, Number(c.completed) || 0);
  c.successful = Math.max(0, Number(c.successful) || 0);
  if(c.completed > c.total) c.completed = c.total;
  if(c.successful > c.completed) c.successful = c.completed;
  c.running = !!c.running;
  if(!c.name) c.name = 'Renewal Campaign';
  if(!c.audience) c.audience = 'Selected audience';
  return c;
}
function loadAgents(){
  const uid = currentUserId();
  if(!uid) return [];
  try{
    const key = agentsStorageKey(uid);
    const raw = localStorage.getItem(key);
    if(raw !== null){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)) return parsed.map(normalizeAgent);
    }
  }catch(e){}
  return [];
}
function persistAgents(){
  const uid = currentUserId();
  if(!uid) return;
  try{ localStorage.setItem(agentsStorageKey(uid), JSON.stringify(agents)); }catch(e){}
}
let agents = [];

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
  return [];
}
function loadInbox(){
  const uid = currentUserId();
  if(!uid) return [];
  try{
    const raw = localStorage.getItem(inboxStorageKey(uid));
    if(raw !== null){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)) return parsed;
    }
  }catch(e){}
  return [];
}
function persistInbox(){
  const uid = currentUserId();
  if(!uid) return;
  try{ localStorage.setItem(inboxStorageKey(uid), JSON.stringify(inbox)); }catch(e){}
  syncAgentStatsFromInbox();
  persistAgents();
}
let inbox = [];
let omniFilter = 'all';
let activeThreadId = null;
let pendingCall = null;
let callTimer = null;
let callSeconds = 0;
let campaignTimer = null;
let activeDetailId = null;
let workflows = [];
let workflowLog = [];
let vnDemoRecorder = null;
let vnDemoChunks = [];
let vnDemoStream = null;
let vnDemoUrl = null;
let vnDemoTimer = null;
let vnDemoSeconds = 0;
let vnDemoRecognition = null;
let vnDemoTranscript = '';
let vnDemoLastNote = null;
let wpMicRecorder = null;
let wpMicChunks = [];
let wpMicStream = null;
let wpMicTimer = null;
let wpMicSeconds = 0;
let wpMicRecognition = null;
let wpMicTranscript = '';
let wpMicRecording = false;

const WF_TRIGGERS = {
  after_reply: 'Agent sends a reply',
  unknown_answer: 'Knowledge cannot answer',
  new_conversation: 'New conversation starts',
  call_ended: 'Call ends'
};
const WF_ACTIONS = {
  notify_team: 'Notify team',
  escalate: 'Escalate to human',
  tag_thread: 'Tag conversation',
  crm_log: 'Log to CRM',
  follow_up: 'Queue follow-up'
};

function defaultWorkflows(){
  return [
    {
      id: 'wf_default_unknown',
      name: 'Escalate when unknown',
      enabled: true,
      agentId: 'all',
      trigger: 'unknown_answer',
      action: 'escalate',
      runs: 0,
      createdAt: Date.now()
    },
    {
      id: 'wf_default_notify',
      name: 'Notify team on reply',
      enabled: false,
      agentId: 'all',
      trigger: 'after_reply',
      action: 'notify_team',
      runs: 0,
      createdAt: Date.now()
    }
  ];
}
function loadWorkflows(){
  const uid = currentUserId();
  if(!uid) return defaultWorkflows();
  try{
    const raw = localStorage.getItem(workflowsStorageKey(uid));
    if(raw !== null){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)) return parsed;
    }
  }catch(e){}
  return defaultWorkflows();
}
function persistWorkflows(){
  const uid = currentUserId();
  if(!uid) return;
  try{ localStorage.setItem(workflowsStorageKey(uid), JSON.stringify(workflows)); }catch(e){}
}
function loadWorkflowLog(){
  const uid = currentUserId();
  if(!uid) return [];
  try{
    const raw = localStorage.getItem(workflowLogStorageKey(uid));
    if(raw !== null){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)) return parsed;
    }
  }catch(e){}
  return [];
}
function persistWorkflowLog(){
  const uid = currentUserId();
  if(!uid) return;
  try{ localStorage.setItem(workflowLogStorageKey(uid), JSON.stringify(workflowLog.slice(0,40))); }catch(e){}
}

function syncAgentStatsFromInbox(){
  agents.forEach(a=>{
    const threads = inbox.filter(t=>t.agentId===a.id);
    a.resolved = String(threads.length);
    if(!threads.length){
      a.rate = '—';
      return;
    }
    const withReply = threads.filter(t=>(t.messages||[]).some(m=>m.from==='agent')).length;
    a.rate = Math.round((withReply / threads.length) * 100) + '%';
  });
}
function workspaceStats(){
  const totalConv = inbox.length;
  const resolved = inbox.filter(t=>(t.messages||[]).some(m=>m.from==='agent')).length;
  const rate = totalConv ? Math.round((resolved / totalConv) * 100) : null;
  const activeAgents = agents.filter(a=>a.status==='Active').length;
  return {
    totalConv,
    resolved,
    rate,
    rateLabel: rate == null ? '—' : (rate + '%'),
    activeAgents,
    agentCount: agents.length,
    avgResponse: totalConv ? '1.2s' : '—',
    csat: totalConv ? '4.8/5' : '—'
  };
}
function reloadWorkspace(){
  agents = loadAgents();
  inbox = loadInbox();
  workflows = loadWorkflows();
  workflowLog = loadWorkflowLog();
  activeDetailId = null;
  activeThreadId = null;
  omniFilter = 'all';
  syncAgentStatsFromInbox();
  agents.forEach(reindexAgent);
  // Initialize empty stores for brand-new accounts
  persistAgents();
  persistInbox();
  persistWorkflows();
  persistWorkflowLog();
}

/* ---------------- INIT ---------------- */
window.onload = function(){
  applyAuthUI();
  reloadWorkspace();
  renderOverview(); renderAgentsGrid(); renderConversations(); renderKnowledge(); renderWorkflows(); renderIntegrations(); renderAnalytics();
  const bubble = document.getElementById('wp-bubble');
  if(bubble) bubble.addEventListener('click', ()=>toggleWidgetPreview(true));
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape') closeMobileNav();
  });
  window.addEventListener('resize', ()=>{ if(window.innerWidth > 900) closeMobileNav(); });
};

function applyAuthUI(){
  if(typeof Auth === 'undefined') return;
  const user = Auth.getCurrentUser();
  if(!user) return;
  const nameEl = document.getElementById('user-name');
  const emailEl = document.getElementById('user-email');
  const avatarEl = document.getElementById('user-avatar');
  const welcomeEl = document.getElementById('overview-welcome');
  if(nameEl) nameEl.textContent = user.name || 'User';
  if(emailEl) emailEl.textContent = user.email || '';
  setAvatarElement(avatarEl, user);
  if(welcomeEl) welcomeEl.textContent = 'Welcome back, ' + Auth.firstName(user.name) + ' 👋';
}
function setAvatarElement(el, user){
  if(!el) return;
  if(user.avatar){
    el.classList.add('has-photo');
    el.style.backgroundImage = 'url(' + user.avatar + ')';
    el.textContent = '';
  } else {
    el.classList.remove('has-photo');
    el.style.backgroundImage = '';
    el.textContent = Auth.initials(user.name);
  }
}
function openProfilePage(){
  closeMobileNav();
  goPage('profile');
  fillProfileForm();
}
function fillProfileForm(){
  if(typeof Auth === 'undefined') return;
  const user = Auth.getCurrentUser();
  if(!user) return;
  const name = document.getElementById('profile-name');
  const email = document.getElementById('profile-email');
  const company = document.getElementById('profile-company');
  const preview = document.getElementById('profile-avatar-preview');
  const metaEmail = document.getElementById('profile-meta-email');
  const metaCreated = document.getElementById('profile-meta-created');
  if(name) name.value = user.name || '';
  if(email) email.value = user.email || '';
  if(company) company.value = user.company || '';
  setAvatarElement(preview, user);
  if(metaEmail) metaEmail.textContent = user.email || '—';
  if(metaCreated){
    metaCreated.textContent = user.createdAt
      ? 'Member since ' + new Date(user.createdAt).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' })
      : 'Member since —';
  }
  ['profile-details-error','profile-password-error','profile-avatar-error'].forEach(id=>{
    const el = document.getElementById(id);
    if(el){ el.classList.add('hidden'); el.textContent = ''; }
  });
  const pw = document.getElementById('profile-password-form');
  if(pw) pw.reset();
}
function saveProfileDetails(e){
  e.preventDefault();
  const err = document.getElementById('profile-details-error');
  const btn = document.getElementById('profile-details-btn');
  err.classList.add('hidden');
  btn.disabled = true;
  const result = Auth.updateProfile({
    name: document.getElementById('profile-name').value,
    email: document.getElementById('profile-email').value,
    company: document.getElementById('profile-company').value
  });
  btn.disabled = false;
  if(!result.ok){
    err.textContent = result.error;
    err.classList.remove('hidden');
    return;
  }
  applyAuthUI();
  fillProfileForm();
  showToast('Profile updated');
}
function saveProfilePassword(e){
  e.preventDefault();
  const err = document.getElementById('profile-password-error');
  const btn = document.getElementById('profile-password-btn');
  err.classList.add('hidden');
  btn.disabled = true;
  const result = Auth.changePassword({
    currentPassword: document.getElementById('profile-current-password').value,
    newPassword: document.getElementById('profile-new-password').value,
    confirmPassword: document.getElementById('profile-confirm-password').value
  });
  btn.disabled = false;
  if(!result.ok){
    err.textContent = result.error;
    err.classList.remove('hidden');
    return;
  }
  document.getElementById('profile-password-form').reset();
  showToast('Password updated');
}
function onProfileAvatarSelected(e){
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  const err = document.getElementById('profile-avatar-error');
  if(err){ err.classList.add('hidden'); err.textContent = ''; }
  if(!file) return;
  if(!file.type.startsWith('image/')){
    if(err){ err.textContent = 'Choose an image file'; err.classList.remove('hidden'); }
    return;
  }
  const reader = new FileReader();
  reader.onload = function(){
    resizeImageDataUrl(reader.result, 256).then(dataUrl=>{
      const result = Auth.updateAvatar(dataUrl);
      if(!result.ok){
        if(err){ err.textContent = result.error; err.classList.remove('hidden'); }
        return;
      }
      applyAuthUI();
      fillProfileForm();
      showToast('Profile picture updated');
    }).catch(()=>{
      if(err){ err.textContent = 'Could not process image'; err.classList.remove('hidden'); }
    });
  };
  reader.onerror = function(){
    if(err){ err.textContent = 'Could not read image'; err.classList.remove('hidden'); }
  };
  reader.readAsDataURL(file);
}
function removeProfileAvatar(){
  const result = Auth.updateAvatar('');
  if(!result.ok){
    showToast(result.error || 'Could not remove photo');
    return;
  }
  applyAuthUI();
  fillProfileForm();
  showToast('Profile picture removed');
}
function resizeImageDataUrl(dataUrl, maxSize){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = function(){
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
function handleLogout(){
  if(typeof Auth === 'undefined') return;
  Auth.logout();
  location.replace(Auth.PATHS.login);
}

/* ---------------- NAV ---------------- */
const pageTitles = {overview:"Overview", agents:"AI Agents", "agent-detail":"Agent Details", conversations:"Omni Inbox", voice:"AI Voice", workflows:"Workflows", knowledge:"Knowledge", integrations:"Integrations", analytics:"Analytics", settings:"Settings", profile:"Profile"};
function goPage(p){
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active', el.dataset.page===p));
  document.querySelectorAll('.page').forEach(el=>el.classList.add('hidden'));
  document.getElementById('page-'+p).classList.remove('hidden');
  document.getElementById('topbar-title').textContent = pageTitles[p];
  closeMobileNav();
  if(p==='knowledge') renderKnowledge();
  if(p==='workflows') renderWorkflows();
  if(p==='conversations'){
    document.getElementById('omni-shell')?.classList.remove('thread-open');
    renderConversations();
  }
  if(p==='voice') renderAIVoicePage();
  if(p==='profile') fillProfileForm();
  if(p==='analytics') renderAnalytics();
  if(p==='overview') renderOverview();
}
function toggleMobileNav(){
  document.body.classList.toggle('nav-open');
}
function closeMobileNav(){
  document.body.classList.remove('nav-open');
}
function closeOmniThreadMobile(){
  activeThreadId = null;
  document.getElementById('omni-shell')?.classList.remove('thread-open');
  showOmniEmpty();
  document.querySelectorAll('.omni-thread').forEach(el=>el.classList.remove('active'));
}

/* ---------------- OVERVIEW ---------------- */
function renderOverview(){
  syncAgentStatsFromInbox();
  const stats = workspaceStats();
  const el = document.getElementById('kpi-conv');
  if(el) el.textContent = stats.totalConv.toLocaleString();
  const kpiResolved = document.getElementById('kpi-resolved');
  if(kpiResolved) kpiResolved.textContent = stats.rateLabel;
  const kpiAvg = document.getElementById('kpi-avg');
  if(kpiAvg) kpiAvg.textContent = stats.avgResponse;
  const kpiCsat = document.getElementById('kpi-csat');
  if(kpiCsat) kpiCsat.textContent = stats.csat;
  const kpiConvDelta = document.getElementById('kpi-conv-delta');
  if(kpiConvDelta){
    kpiConvDelta.textContent = stats.totalConv
      ? (stats.agentCount + ' agent' + (stats.agentCount===1?'':'s') + ' · live workspace')
      : 'No conversations yet — create an agent to get started';
    kpiConvDelta.classList.toggle('up', stats.totalConv > 0);
  }
  const kpiResDelta = document.getElementById('kpi-resolved-delta');
  if(kpiResDelta) kpiResDelta.textContent = stats.totalConv ? 'resolution rate' : 'waiting for activity';
  const kpiAvgDelta = document.getElementById('kpi-avg-delta');
  if(kpiAvgDelta) kpiAvgDelta.textContent = stats.totalConv ? 'avg reply time (demo)' : '—';
  const kpiCsatDelta = document.getElementById('kpi-csat-delta');
  if(kpiCsatDelta) kpiCsatDelta.textContent = stats.totalConv ? 'from resolved chats' : '—';

  const topList = document.getElementById('top-agents-list');
  if(topList){
    if(!agents.length){
      topList.innerHTML = '<p style="font-size:12.5px;color:var(--muted);margin:0;">No agents yet. Create your first agent to see performance here.</p>';
    } else {
      topList.innerHTML = agents.slice(0,5).map(a=>`
        <div class="agent-row" onclick="openAgentDetail('${a.id}')">
          <div class="agent-icon">${a.name.charAt(0)}</div>
          <div><div class="name">${escapeHtml(a.name)}</div><div class="meta">${escapeHtml(a.role)}</div></div>
          <div class="stat"><b>${escapeHtml(a.resolved)}</b><span>${escapeHtml(a.rate)} resolved</span></div>
        </div>`).join('');
    }
  }

  renderChannelDistribution();

  const recent = document.getElementById('recent-conv-list');
  if(recent){
    const threads = [...inbox].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,5);
    if(!threads.length){
      recent.innerHTML = '<p style="font-size:12.5px;color:var(--muted);margin:0;">No conversations yet. Simulate WhatsApp/calls or wait for widget messages.</p>';
    } else {
      recent.innerHTML = threads.map(t=>{
        const meta = channelMeta[t.channel] || {icon:'💬'};
        const last = t.messages[t.messages.length-1];
        const resolved = (t.messages||[]).some(m=>m.from==='agent');
        return `<div class="conv-row"><div class="ch-badge">${meta.icon}</div>
          <div><div class="name">${escapeHtml(t.channel)} — ${escapeHtml(t.customer)}</div><div class="msg">${escapeHtml(last?last.text:'')}</div></div>
          <div class="time">${relTime(t.updatedAt)}${resolved?'<div class="tag">Resolved</div>':''}</div></div>`;
      }).join('');
    }
  }
}
function renderChannelDistribution(){
  const host = document.getElementById('channel-distribution');
  if(!host) return;
  const groups = {
    Chat: ['Web Chat'],
    WhatsApp: ['WhatsApp'],
    Phone: ['Phone', 'Voice'],
    Email: ['Email'],
    Others: ['Instagram', 'SMS']
  };
  const total = inbox.length || 1;
  const rows = Object.keys(groups).map(label=>{
    const count = inbox.filter(t=>groups[label].includes(t.channel)).length;
    const pct = inbox.length ? Math.round((count / inbox.length) * 100) : 0;
    return { label, count, pct };
  });
  host.innerHTML = rows.map(r=>`
    <div class="bar-row"><span class="bar-label">${r.label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${r.pct}%"></div></div>
      <span class="bar-pct">${r.pct}%</span></div>`).join('');
}
function renderAnalytics(){
  syncAgentStatsFromInbox();
  const stats = workspaceStats();
  const set = (id, val)=>{ const el=document.getElementById(id); if(el) el.textContent = val; };
  set('an-page-conv', stats.totalConv.toLocaleString());
  set('an-page-resolved', stats.rateLabel);
  set('an-page-conversion', stats.agentCount ? Math.min(100, Math.round((stats.totalConv / Math.max(stats.agentCount,1)) * 10)) + '%' : '—');
  set('an-page-csat', stats.csat);
  const tips = document.getElementById('an-page-tips');
  if(tips){
    if(!agents.length){
      tips.innerHTML = '• Create your first AI agent<br>• Add a website URL under Knowledge<br>• Connect WhatsApp or Voice to start conversations';
    } else if(!inbox.length){
      tips.innerHTML = '• Test your agent with Simulate WhatsApp or an incoming call<br>• Share your web chat embed on your site<br>• Upload more knowledge for better answers';
    } else {
      tips.innerHTML = '• Review unresolved threads in Omni inbox<br>• Improve knowledge for common questions<br>• Enable Voice or WhatsApp on more agents';
    }
  }
}
function threadListPreview(t){
  const voiceMsg = (t.messages || []).find(m => m.type === 'voice' && m.from === 'customer');
  if(voiceMsg || t.tag === 'Voice note'){
    const tx = (voiceMsg && voiceMsg.transcript) ? String(voiceMsg.transcript).trim() : '';
    const dur = voiceMsg ? formatVnTime(voiceMsg.duration || 0) : '';
    if(tx) return '🎤 Voice note · ' + tx;
    return '🎤 Voice note' + (dur ? ' · ' + dur : '');
  }
  const last = t.messages && t.messages[t.messages.length - 1];
  if(!last) return '';
  if(last.type === 'voice'){
    return '🎤 Voice note' + (last.transcript ? ' · ' + last.transcript : '');
  }
  return last.text || '';
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
      const agent = agents.find(a=>a.id===t.agentId);
      const tagCls = t.channel==='WhatsApp'?'wa':(t.channel==='Web Chat'?'web':(t.channel==='Phone'?'phone':''));
      const hasVoice = (t.messages||[]).some(m=>m.type==='voice') || t.tag === 'Voice note';
      const badge = hasVoice ? '🎤' : meta.icon;
      const preview = threadListPreview(t);
      return `<div class="omni-thread ${t.channel==='WhatsApp'?'wa':''} ${t.channel==='Phone'?'phone':''} ${hasVoice?'voice-note':''} ${t.id===activeThreadId?'active':''}" onclick="openOmniThread('${t.id}')">
        <div class="ch-badge">${badge}</div>
        <div style="min-width:0;">
          <div class="name">${escapeHtml(t.customer)}${hasVoice?' <span class="vn-thread-pill">Voice note</span>':''}</div>
          <div class="msg">${escapeHtml(preview)}</div>
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
  document.getElementById('omni-shell')?.classList.remove('thread-open');
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
  document.getElementById('omni-shell')?.classList.add('thread-open');
  const meta = channelMeta[t.channel] || {icon:'💬'};
  const hasVoice = (t.messages||[]).some(m=>m.type==='voice') || t.tag === 'Voice note';
  document.getElementById('omni-chat-head').innerHTML = `
    <button type="button" class="omni-back" onclick="closeOmniThreadMobile()" aria-label="Back to threads">←</button>
    <div class="ch-badge">${hasVoice ? '🎤' : meta.icon}</div>
    <div style="min-width:0;">
      <div class="title">${escapeHtml(t.customer)}${hasVoice?' <span class="vn-thread-pill">Voice note</span>':''}</div>
      <div class="sub">${escapeHtml(t.channel)}${t.phone?' · '+escapeHtml(t.phone):''}${hasVoice?' · started with voice note':''}</div>
    </div>
    <span class="omni-agent-chip">${escapeHtml(agent?agent.name:'Unassigned')}</span>`;
  const body = document.getElementById('omni-chat-body');
  body.classList.toggle('wa-theme', t.channel==='WhatsApp');
  body.innerHTML = t.messages.map(m=>{
    if(m.type === 'voice'){
      const dur = formatVnTime(m.duration || 0);
      const tx = (m.transcript || '').trim();
      const label = tx
        ? escapeHtml(tx)
        : ('Voice note · ' + dur + ' · no transcript');
      const audio = m.audioUrl
        ? `<audio class="omni-voice-audio" src="${escapeHtml(m.audioUrl)}" controls preload="metadata"></audio>`
        : '<span class="omni-voice-missing">Audio unavailable</span>';
      return `<div class="omni-bubble ${m.from==='customer'?'customer':'agent'}">
        <div class="omni-voice-msg">
          <div class="omni-voice-title">🎤 Customer voice note · ${escapeHtml(dur)}</div>
          <div class="omni-voice-tx">${label}</div>
          ${audio}
        </div>
      </div>`;
    }
    return `<div class="omni-bubble ${m.from==='customer'?'customer':'agent'}">${escapeHtml(m.text)}</div>`;
  }).join('');
  body.scrollTop = body.scrollHeight;
  const input = document.getElementById('omni-reply');
  if(input) input.placeholder = t.channel==='WhatsApp' ? 'Reply on WhatsApp (demo)…' : 'Reply as the AI agent…';
}
function sendOmniReply(){
  const t = inbox.find(x=>x.id===activeThreadId); if(!t) return;
  const input = document.getElementById('omni-reply');
  let text = (input.value||'').trim();
  const agent = agents.find(a=>a.id===t.agentId);
  let kb = null;
  if(!text && agent){
    const lastCustomer = [...t.messages].reverse().find(m=>m.from==='customer');
    if(lastCustomer){
      const q = lastCustomer.type === 'voice'
        ? ((lastCustomer.transcript || '').trim() || lastCustomer.text || '')
        : lastCustomer.text;
      kb = answerFromSources(q, agent);
      text = kb.answer;
    }
  }
  if(!text){ showToast('Type a reply first'); return; }
  t.messages.push({from:'agent', text, at:Date.now()});
  t.updatedAt = Date.now();
  input.value = '';
  persistInbox();
  if(agent){
    const ctx = { agentId: agent.id, agentName: agent.name, channel: t.channel, thread: t, found: kb ? kb.found : true };
    fireWorkflows('after_reply', ctx);
    if(kb && kb.found === false) fireWorkflows('unknown_answer', ctx);
  }
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
  if(s.status==='extracting') return 'Extracting content…';
  if(s.status==='error') return s.error || 'Extraction failed';
  if(s.content) return `${(s.wordCount||0).toLocaleString()} words · searchable`;
  if(s.type==='file') return 'File uploaded (no text extracted)';
  return 'Ready';
}
function escapeHtml(str){
  return String(str||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function removeKnowledgeSource(agentId, index){
  const a = agents.find(x=>x.id===agentId); if(!a) return;
  a.sources.splice(index,1);
  reindexAgent(a);
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
  // Jina / plain text responses are already readable
  const trimmed = (html||'').trim();
  if(trimmed && !/^<!DOCTYPE|^<html[\s>]/i.test(trimmed) && !trimmed.includes('<body')){
    const lines = trimmed.split(/\n/).map(l=>l.trim()).filter(Boolean);
    const title = (lines[0]||'Website').replace(/^#+\s*/,'').slice(0,120);
    const content = trimmed.replace(/\n{3,}/g,'\n\n').slice(0, 50000);
    return { title, content };
  }
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
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
function getExtractCache(url){
  try{
    const raw = sessionStorage.getItem('greatagen_extract_' + url);
    if(!raw) return null;
    const data = JSON.parse(raw);
    if(data && data.content && data.content.length > 40) return data;
  }catch(e){}
  return null;
}
function setExtractCache(url, data){
  try{ sessionStorage.setItem('greatagen_extract_' + url, JSON.stringify(data)); }catch(e){}
}
async function fetchViaProxy(buildUrl, url){
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), 22000);
  try{
    const res = await fetch(buildUrl(url), {
      signal: ctrl.signal,
      headers: { 'Accept': 'text/html,text/plain,application/json,*/*' }
    });
    clearTimeout(timer);
    if(res.status === 429){
      const err = new Error('Rate limited (429)');
      err.status = 429;
      throw err;
    }
    if(!res.ok){
      const err = new Error('Website returned ' + res.status);
      err.status = res.status;
      throw err;
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if(ct.includes('application/json')){
      const json = await res.json();
      const html = json.contents || json.content || json.data || json.body || '';
      if(typeof html === 'string') return html;
      throw new Error('No readable content found');
    }
    return await res.text();
  }catch(e){
    clearTimeout(timer);
    throw e;
  }
}
async function extractWebsiteContent(url){
  const cached = getExtractCache(url);
  if(cached) return { ...cached, status: 'ready' };

  // Multiple free readers/proxies — try until one works (429 = skip / retry later)
  const proxies = [
    (u)=>`https://r.jina.ai/${u}`,
    (u)=>`https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    (u)=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u)=>`https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    (u)=>`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    (u)=>`https://thingproxy.freeboard.io/fetch/${u}`
  ];

  let lastErr = 'Could not reach website';
  let hit429 = false;

  for(let i = 0; i < proxies.length; i++){
    try{
      const html = await fetchViaProxy(proxies[i], url);
      if(!html || html.length < 40){ lastErr = 'No readable content found'; continue; }
      const parsed = parseHtmlToText(html);
      if(!parsed.content || parsed.content.length < 40){ lastErr = 'No readable content found'; continue; }
      const wordCount = parsed.content.split(/\s+/).filter(Boolean).length;
      const data = { title: parsed.title, content: parsed.content, wordCount, status: 'ready' };
      setExtractCache(url, data);
      return data;
    }catch(e){
      if(e.status === 429 || /429|rate limit/i.test(e.message||'')){
        hit429 = true;
        lastErr = 'Rate limited — trying another source…';
        await sleep(400 + i * 200); // brief backoff before next proxy
        continue;
      }
      lastErr = e.name === 'AbortError' ? 'Request timed out' : (e.message || 'Extraction failed');
    }
  }

  if(hit429){
    // One delayed retry pass — public proxies often recover after a short wait
    await sleep(1600);
    for(let i = 0; i < proxies.length; i++){
      try{
        const html = await fetchViaProxy(proxies[i], url);
        if(!html || html.length < 40) continue;
        const parsed = parseHtmlToText(html);
        if(!parsed.content || parsed.content.length < 40) continue;
        const wordCount = parsed.content.split(/\s+/).filter(Boolean).length;
        const data = { title: parsed.title, content: parsed.content, wordCount, status: 'ready' };
        setExtractCache(url, data);
        return data;
      }catch(e){ /* keep trying */ }
    }
    throw new Error('Website extract is temporarily rate-limited (429). Wait a few seconds and try again, or upload a file instead.');
  }
  throw new Error(lastErr);
}
function answerFromSources(question, agentOrSources){
  if(typeof Knowledge !== 'undefined' && Knowledge.answerFromKnowledge){
    return Knowledge.answerFromKnowledge(question, agentOrSources);
  }
  // Minimal fallback if knowledge.js failed to load
  return {
    answer: 'Knowledge engine unavailable. Refresh the page and try again.',
    cite: null,
    found: false
  };
}
function reindexAgent(a){
  if(!a) return;
  if(typeof Knowledge !== 'undefined') Knowledge.rebuildAgentIndex(a);
}
function groundedAnswer(question, agentOrSources){
  return answerFromSources(question, agentOrSources).answer;
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
    reindexAgent(a);
    document.getElementById('kb-url').value = '';
    showToast('Website content extracted');
    refreshWorkflowCanvasIfVisible();
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
  const result = answerFromSources(q, a);
  persistAgents();
  if(result.found === false){
    fireWorkflows('unknown_answer', { agentId: a.id, agentName: a.name, channel: 'Knowledge', found: false });
  }
  box.innerHTML = `<div class="title">${escapeHtml(a.name)}</div><div>${escapeHtml(result.answer).replace(/\n/g,'<br>')}</div>${result.cite?`<div class="cite">Source: ${escapeHtml(result.cite)}</div>`:''}${!result.found?'<div class="cite">Not found in knowledge</div>':''}`;
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
    reindexAgent(a);
    document.getElementById('detail-url').value = '';
    showToast('Website content extracted');
    refreshWorkflowCanvasIfVisible();
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
  const result = answerFromSources(q, a);
  persistAgents();
  box.style.display = 'block';
  box.innerHTML = `<div>${escapeHtml(result.answer).replace(/\n/g,'<br>')}</div>${result.cite?`<div class="cite">Source: ${escapeHtml(result.cite)}</div>`:''}${!result.found?'<div class="cite">Not found in knowledge</div>':''}`;
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
  syncAgentStatsFromInbox();
  const grid = document.getElementById('agents-grid');
  if(!agents.length){
    grid.innerHTML = `
      <div class="create-card" onclick="openWizard()" style="grid-column:1/-1; min-height:220px;">
        <div class="plus">+</div>
        <b>Create your first agent</b>
        <span style="font-size:12.5px;margin-top:6px;">Your workspace is empty — agents you create will appear here with live stats.</span>
      </div>`;
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
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openAgentDetail('${a.id}')">Manage</button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteAgent('${a.id}')">Delete</button>
      </div>
    </div>`).join('') + `
    <div class="create-card" onclick="openWizard()"><div class="plus">+</div><b>Create New Agent</b></div>`;
}

/* ---------------- WORKFLOWS ---------------- */
function fillWorkflowAgentSelect(){
  const sel = document.getElementById('wf-agent');
  if(!sel) return;
  const v = sel.value;
  sel.innerHTML = '<option value="all">All agents</option>' +
    agents.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  if(v) sel.value = v;
}
function fillWorkflowCanvasAgentSelect(){
  const sel = document.getElementById('wf-canvas-agent');
  if(!sel) return;
  const prev = sel.value || activeDetailId || agents[0]?.id || '';
  sel.innerHTML = agents.map(a=>`<option value="${a.id}">${escapeHtml(a.name)} · ${escapeHtml(a.role)}</option>`).join('')
    || '<option value="">No agents yet</option>';
  if(prev && agents.some(a=>a.id===prev)) sel.value = prev;
  else if(agents[0]) sel.value = agents[0].id;
}
function agentAutomations(agentId){
  return workflows.filter(w=>w.enabled && (w.agentId==='all' || w.agentId===agentId));
}
function buildAgentFlowGraph(a){
  normalizeAgent(a);
  const nodes = [];
  const edges = [];
  const NW = 150, NH = 58, OW = 178, OH = 74;
  const COL = [40, 230, 420, 610, 800, 1000, 1200];
  const isCall = isCallAgentRole(a.role);
  const channels = a.channels || [];
  const hasWeb = channels.includes('Web Chat');
  const hasWa = channels.includes('WhatsApp');
  const hasPhone = channels.includes('Voice') || channels.includes('Phone');
  const inboundOn = !!(a.voiceCalling && a.voiceCalling.inbound);
  const outboundOn = !!(a.voiceCalling && a.voiceCalling.outbound);
  const readySources = (a.sources || []).filter(s=>s.content && s.status!=='error' && String(s.content).trim().length > 20);
  const hasKb = readySources.length > 0;
  const kbLabel = hasKb
    ? (readySources.length + ' source' + (readySources.length===1?'':'s'))
    : 'Add URL or file';
  const autos = agentAutomations(a.id);
  const afterReply = autos.filter(w=>w.trigger==='after_reply');
  const onUnknown = autos.filter(w=>w.trigger==='unknown_answer');
  const onNew = autos.filter(w=>w.trigger==='new_conversation');
  const onCallEnd = autos.filter(w=>w.trigger==='call_ended');

  function addNode(id, type, label, sub, x, y, w, h){
    nodes.push({ id, type, label, sub: sub || '', x, y, w: w || NW, h: h || NH });
  }
  function addEdge(from, to, label){
    if(!from || !to) return;
    if(edges.some(e=>e.from===from && e.to===to && e.label===(label||''))) return;
    edges.push({ from, to, label: label || '' });
  }

  const triggerIds = [];
  let ty = 36;
  if(isCall){
    if(a.role === 'Inbound Call Agent' || inboundOn){
      addNode('t_in', 'trigger', 'Incoming call', 'Phone line', COL[0], ty);
      triggerIds.push('t_in');
      ty += 88;
    }
    if(a.role === 'Outbound Call Agent' || outboundOn){
      addNode('t_out', 'trigger', 'Outbound dial', a.voiceCalling?.campaign?.name || 'Campaign', COL[0], ty);
      triggerIds.push('t_out');
      ty += 88;
    }
    if(!triggerIds.length){
      addNode('t_call', 'trigger', 'Voice call', a.role, COL[0], ty);
      triggerIds.push('t_call');
      ty += 88;
    }
  } else {
    if(hasWeb){
      addNode('t_web', 'trigger', 'Website chat', 'Widget embed', COL[0], ty);
      triggerIds.push('t_web');
      ty += 88;
    }
    if(hasWa){
      addNode('t_wa', 'trigger', 'WhatsApp', a.whatsapp?.connected ? 'Connected' : 'Channel', COL[0], ty);
      triggerIds.push('t_wa');
      ty += 88;
    }
    if(hasPhone || inboundOn || outboundOn){
      addNode('t_voice', 'trigger', 'Voice / Phone', inboundOn || outboundOn ? 'Calling on' : 'Enabled', COL[0], ty);
      triggerIds.push('t_voice');
      ty += 88;
    }
    if(a.voiceNotes?.enabled){
      addNode('t_vn', 'trigger', 'Voice note', 'Mic · ' + (a.voiceNotes.maxSeconds||60) + 's', COL[0], ty);
      triggerIds.push('t_vn');
      ty += 88;
    }
    if(!triggerIds.length){
      addNode('t_web', 'trigger', 'Customer message', a.role || 'Agent', COL[0], ty);
      triggerIds.push('t_web');
    }
  }

  const midY = triggerIds.length === 1
    ? (nodes.find(n=>n.id===triggerIds[0]).y)
    : Math.round((nodes.filter(n=>triggerIds.includes(n.id)).reduce((s,n)=>s+n.y,0) / triggerIds.length));

  const recvId = isCall ? 'greet' : 'recv';
  addNode(recvId, 'action', isCall ? 'Greet caller' : 'Receive message', isCall ? (a.voice || 'AI voice') : a.role, COL[1], midY);
  triggerIds.forEach(t=>addEdge(t, recvId));

  onNew.forEach((w,i)=>{
    const id = 'nw_' + i;
    addNode(id, 'action', WF_ACTIONS[w.action] || w.action, 'New conversation', COL[1], midY + 96 + i * 72);
    addEdge(recvId, id);
  });

  addNode('kb', 'knowledge', 'Search knowledge', kbLabel, COL[2], midY);
  addEdge(recvId, 'kb');

  addNode('decide', 'decide', 'Found answer?', hasKb ? 'Retrieve + score' : 'Needs knowledge', COL[3], midY);
  addEdge('kb', 'decide');

  const yesId = isCall ? 'speak' : 'reply';
  const noId = 'refuse';
  addNode(yesId, 'action', isCall ? 'Speak reply' : 'Reply from knowledge', isCall ? 'Voice response' : 'Grounded answer', COL[4], midY - 78);
  addNode(noId, 'action', isCall ? 'Refuse / transfer' : 'Refuse unknown', 'No hallucination', COL[4], midY + 78);
  addEdge('decide', yesId, 'yes');
  addEdge('decide', noId, 'no');

  let yesTail = yesId;
  let noTail = noId;
  afterReply.forEach((w,i)=>{
    const id = 'ar_' + i;
    addNode(id, 'action', WF_ACTIONS[w.action] || w.action, w.name, COL[5], midY - 110 + i * 72);
    addEdge(yesTail, id);
    yesTail = id;
  });
  onUnknown.forEach((w,i)=>{
    const id = 'uk_' + i;
    addNode(id, 'action', WF_ACTIONS[w.action] || w.action, w.name, COL[5], midY + 50 + i * 72);
    addEdge(noTail, id);
    noTail = id;
  });

  addNode('out', 'output', isCall ? 'Log call · Inbox' : 'Deliver reply', isCall ? 'Omni Phone thread' : 'Widget · Inbox', COL[6], midY - 8, OW, OH);
  addEdge(yesTail, 'out');
  addEdge(noTail, 'out');

  onCallEnd.forEach((w,i)=>{
    const id = 'ce_' + i;
    addNode(id, 'action', WF_ACTIONS[w.action] || w.action, 'Call ended', COL[6], midY + 100 + i * 72);
    addEdge('out', id);
  });

  const minX = Math.min(...nodes.map(n=>n.x));
  const minY = Math.min(...nodes.map(n=>n.y));
  const padX = 36 - minX;
  const padY = 36 - minY;
  if(padX || padY){
    nodes.forEach(n=>{ n.x += padX; n.y += padY; });
  }

  const maxX = Math.max(...nodes.map(n=>n.x + n.w), 800);
  const maxY = Math.max(...nodes.map(n=>n.y + n.h), 280);
  return {
    nodes,
    edges,
    width: maxX + 56,
    height: maxY + 56,
    agentId: a.id,
    happyPath: buildHappyPath(nodes, edges, triggerIds[0], yesId)
  };
}
function buildHappyPath(nodes, edges, startId, preferYesId){
  const ids = new Set(nodes.map(n=>n.id));
  if(!ids.has(startId)) return [];
  const path = [startId];
  let cur = startId;
  const used = new Set([startId]);
  for(let guard = 0; guard < 24; guard++){
    const outs = edges.filter(e=>e.from===cur && !used.has(e.to));
    if(!outs.length) break;
    let next = outs.find(e=>e.to === preferYesId)
      || outs.find(e=>e.label==='yes')
      || outs.find(e=>e.to==='out')
      || outs.find(e=>e.to.startsWith('ar_'))
      || outs.find(e=>!e.label || e.label==='transcribe')
      || outs[0];
    if(!next) break;
    path.push(next.to);
    used.add(next.to);
    cur = next.to;
    if(cur === 'out') break;
  }
  if(!path.includes('out') && ids.has('out')) path.push('out');
  return path;
}

let wfCanvasGraph = null;
let wfSimTimer = null;

function edgePath(a, b){
  const x1 = a.x + a.w;
  const y1 = a.y + a.h / 2;
  const x2 = b.x;
  const y2 = b.y + b.h / 2;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}
function renderWorkflowCanvas(){
  const svg = document.getElementById('wf-canvas-svg');
  const empty = document.getElementById('wf-canvas-empty');
  const hint = document.getElementById('wf-canvas-hint');
  fillWorkflowCanvasAgentSelect();
  const agentId = document.getElementById('wf-canvas-agent')?.value;
  const a = agents.find(x=>x.id===agentId);
  if(!svg) return;
  if(wfSimTimer){ clearTimeout(wfSimTimer); wfSimTimer = null; }
  if(!a){
    wfCanvasGraph = null;
    svg.innerHTML = '';
    if(empty){ empty.classList.remove('hidden'); empty.textContent = 'Create an agent to preview its workflow map.'; }
    if(hint) hint.textContent = 'Auto-built from this agent’s role, channels, knowledge, and enabled automations.';
    return;
  }
  if(empty) empty.classList.add('hidden');
  let graph;
  try{
    graph = buildAgentFlowGraph(a);
  }catch(err){
    console.error(err);
    wfCanvasGraph = null;
    svg.innerHTML = '';
    if(empty){ empty.classList.remove('hidden'); empty.textContent = 'Could not build workflow for this agent.'; }
    return;
  }
  wfCanvasGraph = graph;
  if(hint){
    const ch = (a.channels||[]).join(', ') || 'no channels';
    const src = (a.sources||[]).filter(s=>s.content && s.status!=='error').length;
    const nAuto = agentAutomations(a.id).length;
    hint.textContent = `${a.name} · ${a.role} · ${ch} · ${src} knowledge source${src===1?'':'s'} · ${nAuto} automation${nAuto===1?'':'s'} · ${graph.nodes.length} steps`;
  }

  const markerId = 'wfArrow';
  let html = `<defs>
    <marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path class="wf-arrow" d="M 0 0 L 10 5 L 0 10 z"/>
    </marker>
    <marker id="${markerId}Active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path class="wf-arrow active" d="M 0 0 L 10 5 L 0 10 z"/>
    </marker>
  </defs>`;
  svg.setAttribute('viewBox', `0 0 ${graph.width} ${graph.height}`);
  svg.setAttribute('width', graph.width);
  svg.setAttribute('height', Math.max(graph.height, 300));

  const byId = Object.fromEntries(graph.nodes.map(n=>[n.id, n]));
  graph.edges.forEach((e,i)=>{
    const aN = byId[e.from], bN = byId[e.to];
    if(!aN || !bN) return;
    const d = edgePath(aN, bN);
    const midX = (aN.x + aN.w + bN.x) / 2;
    const midY = (aN.y + aN.h / 2 + bN.y + bN.h / 2) / 2 - 8;
    html += `<path class="wf-edge" id="wf-edge-${i}" data-from="${e.from}" data-to="${e.to}" d="${d}" marker-end="url(#${markerId})"/>`;
    if(e.label){
      html += `<text class="wf-edge-label" x="${midX}" y="${midY}" text-anchor="middle">${escapeHtml(e.label)}</text>`;
    }
  });
  graph.nodes.forEach(n=>{
    const rx = n.type === 'output' ? 10 : 8;
    html += `<g class="wf-node" id="wf-node-${n.id}" data-id="${n.id}">
      <rect class="wf-node-rect ${n.type}" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${rx}" ry="${rx}"/>
      <text class="wf-node-label" x="${n.x + 12}" y="${n.y + (n.sub ? 24 : n.h/2 + 4)}">${escapeHtml(n.label)}</text>
      ${n.sub ? `<text class="wf-node-sub" x="${n.x + 12}" y="${n.y + 42}">${escapeHtml(n.sub)}</text>` : ''}
    </g>`;
  });
  svg.innerHTML = html;
  const wrap = document.getElementById('wf-canvas-wrap');
  if(wrap) wrap.scrollLeft = 0;
}
function onWorkflowCanvasAgentChange(){
  renderWorkflowCanvas();
}
function clearWorkflowCanvasHighlight(){
  document.querySelectorAll('#wf-canvas-svg .wf-node-rect.active').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('#wf-canvas-svg .wf-edge.active').forEach(el=>{
    el.classList.remove('active');
    el.setAttribute('marker-end', 'url(#wfArrow)');
  });
}
function simulateWorkflowCanvas(){
  if(!wfCanvasGraph || !wfCanvasGraph.nodes.length){
    showToast('Select an agent with a workflow map first');
    return;
  }
  if(wfSimTimer){ clearTimeout(wfSimTimer); wfSimTimer = null; }
  clearWorkflowCanvasHighlight();

  const path = (wfCanvasGraph.happyPath && wfCanvasGraph.happyPath.length)
    ? wfCanvasGraph.happyPath.slice()
    : [];

  if(!path.length){
    showToast('No runnable path for this agent');
    return;
  }

  let step = 0;
  const a = agents.find(x=>x.id===wfCanvasGraph.agentId);
  showToast('Simulating ' + (a?.name || 'agent') + ' workflow…');
  const tick = ()=>{
    if(step >= path.length){
      wfSimTimer = setTimeout(clearWorkflowCanvasHighlight, 1000);
      return;
    }
    const id = path[step];
    const el = document.querySelector('#wf-node-' + id + ' .wf-node-rect');
    if(el){
      el.classList.add('active');
      try{ el.scrollIntoView({ block:'nearest', inline:'nearest', behavior:'smooth' }); }catch(e){}
    }
    if(step > 0){
      const prev = path[step-1];
      wfCanvasGraph.edges.forEach((e,i)=>{
        if(e.from===prev && e.to===id){
          const edge = document.getElementById('wf-edge-'+i);
          if(edge){
            edge.classList.add('active');
            edge.setAttribute('marker-end', 'url(#wfArrowActive)');
          }
        }
      });
    }
    step++;
    wfSimTimer = setTimeout(tick, 520);
  };
  tick();
}
function refreshWorkflowCanvasIfVisible(){
  const page = document.getElementById('page-workflows');
  if(page && !page.classList.contains('hidden')) renderWorkflowCanvas();
}
function renderWorkflows(){
  fillWorkflowAgentSelect();
  fillWorkflowCanvasAgentSelect();
  renderWorkflowCanvas();
  const list = document.getElementById('workflows-list');
  const logEl = document.getElementById('workflows-log');
  if(!list) return;
  if(!workflows.length){
    list.innerHTML = '<p style="font-size:12.5px;color:var(--muted);margin:0;">No automations yet. Create one on the right — they show up on the canvas.</p>';
  } else {
    list.innerHTML = workflows.map(w=>{
      const agentName = w.agentId === 'all' ? 'All agents' : (agents.find(a=>a.id===w.agentId)?.name || 'Deleted agent');
      return `<div class="wf-item ${w.enabled?'':'off'}">
        <div class="wf-main">
          <div class="wf-title">${escapeHtml(w.name)}</div>
          <div class="wf-meta">When <b>${escapeHtml(WF_TRIGGERS[w.trigger]||w.trigger)}</b> → <b>${escapeHtml(WF_ACTIONS[w.action]||w.action)}</b></div>
          <div class="wf-meta">${escapeHtml(agentName)} · ${(w.runs||0)} run${(w.runs||0)===1?'':'s'}</div>
        </div>
        <label class="wf-switch" title="Enable">
          <input type="checkbox" ${w.enabled?'checked':''} onchange="toggleWorkflow('${w.id}', this.checked)">
          <span></span>
        </label>
        <button type="button" class="rm" onclick="deleteWorkflow('${w.id}')" title="Delete">✕</button>
      </div>`;
    }).join('');
  }
  if(logEl){
    if(!workflowLog.length){
      logEl.innerHTML = '<p style="font-size:12.5px;color:var(--muted);margin:0;">Runs will appear here when triggers fire.</p>';
    } else {
      logEl.innerHTML = workflowLog.slice(0,12).map(e=>`
        <div class="wf-log-row">
          <div class="wf-log-name">${escapeHtml(e.name)}</div>
          <div class="wf-log-msg">${escapeHtml(e.message)}</div>
          <div class="wf-log-time">${new Date(e.at).toLocaleString()}</div>
        </div>`).join('');
    }
  }
}
function createWorkflow(){
  const name = (document.getElementById('wf-name')?.value || '').trim();
  const agentId = document.getElementById('wf-agent')?.value || 'all';
  const trigger = document.getElementById('wf-trigger')?.value || 'after_reply';
  const action = document.getElementById('wf-action')?.value || 'notify_team';
  if(!name){ showToast('Enter a workflow name'); return; }
  workflows.unshift({
    id: 'wf_' + Math.random().toString(36).slice(2,10),
    name, agentId, trigger, action,
    enabled: true, runs: 0, createdAt: Date.now()
  });
  document.getElementById('wf-name').value = '';
  persistWorkflows();
  renderWorkflows();
  showToast('Workflow added');
}
function toggleWorkflow(id, on){
  const w = workflows.find(x=>x.id===id); if(!w) return;
  w.enabled = !!on;
  persistWorkflows();
  renderWorkflows();
}
function deleteWorkflow(id){
  workflows = workflows.filter(w=>w.id!==id);
  persistWorkflows();
  renderWorkflows();
  showToast('Workflow removed');
}
function clearWorkflowLog(){
  workflowLog = [];
  persistWorkflowLog();
  renderWorkflows();
}
function actionMessage(action, ctx){
  const agent = ctx.agentName || 'Agent';
  const channel = ctx.channel || 'chat';
  switch(action){
    case 'notify_team': return `Notified team about ${agent} reply on ${channel}`;
    case 'escalate': return `Escalated to human inbox (${agent}${ctx.found===false?' · unknown answer':''})`;
    case 'tag_thread': return `Tagged conversation for ${agent}`;
    case 'crm_log': return `Logged outcome to CRM for ${agent}`;
    case 'follow_up': return `Queued follow-up for ${agent}`;
    default: return `Ran action ${action}`;
  }
}
function applyWorkflowSideEffects(action, ctx){
  if(!ctx.thread) return;
  if(action === 'escalate'){
    ctx.thread.escalated = true;
    ctx.thread.tag = ctx.thread.tag || 'Escalated';
  }
  if(action === 'tag_thread'){
    ctx.thread.tag = ctx.tag || 'Workflow';
  }
}
function fireWorkflows(trigger, ctx){
  const agentId = ctx.agentId || null;
  const matches = workflows.filter(w=>
    w.enabled &&
    w.trigger === trigger &&
    (w.agentId === 'all' || w.agentId === agentId)
  );
  if(!matches.length) return;
  matches.forEach(w=>{
    w.runs = (w.runs || 0) + 1;
    applyWorkflowSideEffects(w.action, ctx);
    workflowLog.unshift({
      id: 'run_' + Math.random().toString(36).slice(2,8),
      workflowId: w.id,
      name: w.name,
      message: actionMessage(w.action, ctx),
      at: Date.now()
    });
  });
  persistWorkflows();
  persistWorkflowLog();
  if(ctx.thread) persistInbox();
  const page = document.getElementById('page-workflows');
  if(page && !page.classList.contains('hidden')) renderWorkflows();
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
  syncAgentStatsFromInbox();
  document.getElementById('an-conv').textContent = a.resolved;
  document.getElementById('an-rate').textContent = a.rate;
  const anAvg = document.getElementById('an-avg');
  const anCsat = document.getElementById('an-csat');
  const threads = inbox.filter(t=>t.agentId===a.id);
  if(anAvg) anAvg.textContent = threads.length ? '1.2s' : '—';
  if(anCsat) anCsat.textContent = threads.length ? '4.7/5' : '—';
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
  renderWorkflows();
  showToast('Agent deleted');
  goPage('agents');
}
function detailTab(t){
  document.querySelectorAll('.detail-tab').forEach(el=>el.classList.toggle('active', el.dataset.tab===t));
  document.querySelectorAll('.detail-tab-panel').forEach(el=>el.classList.remove('active'));
  document.getElementById('tab-'+t).classList.add('active');
  if(t==='channels') renderChannelsPanel();
  if(t==='voice') renderVoicePanel();
}
function editPreviewUpdate(){
  const role = document.getElementById('e-role').value;
  const voice = document.getElementById('e-voice').value;
  const lang = document.getElementById('e-lang').value;
  const voiceName = voice.split(' ')[0];
  document.getElementById('e-preview-voice').textContent = voiceName;
  document.getElementById('e-preview-lang').textContent = lang;
  const chat = document.getElementById('e-preview-chat');
  const call = document.getElementById('e-preview-call');
  const label = document.getElementById('e-preview-label');
  const isCall = isCallAgentRole(role);
  if(chat) chat.classList.toggle('hidden', isCall);
  if(call) call.classList.toggle('hidden', !isCall);
  if(label) label.textContent = isCall ? 'Call Live Preview' : 'Live Preview';
  if(isCall){
    const inbound = role === 'Inbound Call Agent';
    call.classList.toggle('inbound', inbound);
    call.classList.toggle('outbound', !inbound);
    document.getElementById('e-call-dir').textContent = inbound ? 'Incoming Call' : 'Outbound Call';
    document.getElementById('e-call-number').textContent = inbound ? '+1 (555) 010-2001' : '+1 (555) 010-8842';
    document.getElementById('e-call-agent').textContent = voiceName + ' · ' + lang;
    document.getElementById('e-call-status').textContent = inbound ? 'Ringing…' : 'Dialing…';
    document.getElementById('e-call-transcript').textContent = roleIntro[role] || '';
    const actions = document.getElementById('e-call-actions');
    if(actions){
      actions.innerHTML = inbound
        ? `<span class="pv-call-pill decline">Decline</span><span class="pv-call-pill accept">Accept</span>`
        : `<span class="pv-call-pill hangup">End call</span>`;
    }
    return;
  }
  const demo = roleDemo[role];
  const a = agents.find(x=>x.id===activeDetailId);
  const botA = a ? groundedAnswer(demo.q, a) : demo.a;
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
  normalizeAgent(a);
  if(isCallAgentRole(a.role)){
    ensureVoiceChannel(a);
    if(a.role === 'Inbound Call Agent'){ a.voiceCalling.inbound = true; }
    if(a.role === 'Outbound Call Agent'){ a.voiceCalling.outbound = true; }
  }
  document.getElementById('detail-name').textContent = a.name;
  document.getElementById('detail-sub').textContent = a.role + ' · ' + a.industry;
  document.getElementById('detail-avatar').textContent = a.name.charAt(0);
  renderAgentsGrid(); renderOverview(); renderIntegrations();
  persistAgents();
  refreshWorkflowCanvasIfVisible();
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
async function addDetailFile(e){
  const f = e.target.files[0]; if(!f) return;
  e.target.value = '';
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  if(typeof Knowledge === 'undefined' || !Knowledge.extractFileText){
    showToast('Knowledge engine unavailable — refresh the page');
    return;
  }
  const source = { type:'file', name:f.name, status:'extracting', content:'', wordCount:0 };
  a.sources.push(source);
  renderDetailSources(); renderKnowledge();
  try{
    const text = await Knowledge.extractFileText(f);
    source.content = text;
    source.wordCount = text.split(/\s+/).filter(Boolean).length;
    source.status = 'ready';
    reindexAgent(a);
    showToast('File extracted and indexed');
  }catch(err){
    source.status = 'error';
    source.error = err.message || 'Could not extract text';
    showToast(source.error);
  }
  renderDetailSources(); renderKnowledge();
  persistAgents();
  refreshWorkflowCanvasIfVisible();
}
function removeDetailSource(i){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  a.sources.splice(i,1);
  reindexAgent(a);
  renderDetailSources(); renderKnowledge();
  persistAgents();
  refreshWorkflowCanvasIfVisible();
}

/* ---------------- WIZARD ---------------- */
function openWizard(){
  closeMobileNav();
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
  const hint = document.getElementById('wiz-knowledge-hint');
  if(hint){
    hint.textContent = isCallAgentRole(selectedRole)
      ? 'Train your call agent — add a website URL or upload files. If Extract hits a rate limit, wait a few seconds and retry, or upload a file instead.'
      : 'Add a website URL or upload files so your agent can answer from your content. If Extract hits a rate limit, wait a few seconds and try again — or upload a PDF/DOC instead.';
  }
  livePreviewUpdate();
});

async function addFileSource(e){
  const f = e.target.files[0]; if(!f) return;
  e.target.value = '';
  if(typeof Knowledge === 'undefined' || !Knowledge.extractFileText){
    showToast('Knowledge engine unavailable — refresh the page');
    return;
  }
  const source = { type:'file', name:f.name, status:'extracting', content:'', wordCount:0 };
  sources.push(source);
  renderSourceList();
  try{
    const text = await Knowledge.extractFileText(f);
    source.content = text;
    source.wordCount = text.split(/\s+/).filter(Boolean).length;
    source.status = 'ready';
    showToast('File extracted and searchable');
  }catch(err){
    source.status = 'error';
    source.error = err.message || 'Could not extract text';
    showToast(source.error);
  }
  renderSourceList();
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
  const voiceName = voice.split(' ')[0];
  document.getElementById('pv-voice').textContent = voiceName;
  document.getElementById('pv-lang').textContent = lang;
  document.getElementById('pv-role-chip').textContent = 'Role: ' + (role || '—');
  document.getElementById('pv-industry-chip').textContent = 'Industry: ' + industry;

  const chat = document.getElementById('pv-chat');
  const call = document.getElementById('pv-call');
  const label = document.getElementById('pv-label');
  const isCall = isCallAgentRole(role);

  if(chat) chat.classList.toggle('hidden', isCall);
  if(call) call.classList.toggle('hidden', !isCall);
  if(label) label.textContent = isCall ? 'Call Live Preview' : 'Live Preview';

  if(isCall){
    const inbound = role === 'Inbound Call Agent';
    call.classList.toggle('inbound', inbound);
    call.classList.toggle('outbound', !inbound);
    document.getElementById('pv-call-dir').textContent = inbound ? 'Incoming Call' : 'Outbound Call';
    document.getElementById('pv-call-number').textContent = inbound ? '+1 (555) 010-2001' : '+1 (555) 010-8842';
    document.getElementById('pv-call-agent').textContent = voiceName + ' · ' + lang;
    document.getElementById('pv-call-status').textContent = inbound ? 'Ringing…' : 'Dialing…';
    document.getElementById('pv-call-transcript').textContent = roleIntro[role] || '';
    const actions = document.getElementById('pv-call-actions');
    if(actions){
      actions.innerHTML = inbound
        ? `<span class="pv-call-pill decline">Decline</span><span class="pv-call-pill accept">Accept</span>`
        : `<span class="pv-call-pill hangup">End call</span>`;
    }
    return;
  }

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
  const voice = document.getElementById('w-voice').value.split(' ')[0];
  const lang = document.getElementById('w-lang').value;
  document.getElementById('demo-title').textContent = isCallAgentRole(role) ? 'Call Demo' : 'Try Demo';
  document.getElementById('demo-sub').textContent = role + ' · ' + industry;
  const demo = roleDemo[role];
  const body = document.getElementById('demo-body');
  document.getElementById('demo-overlay').classList.remove('hidden');

  if(isCallAgentRole(role)){
    const inbound = role === 'Inbound Call Agent';
    const number = inbound ? '+1 (555) 010-2001' : '+1 (555) 010-8842';
    body.innerHTML = `
      <div class="demo-call-preview ${inbound ? 'inbound' : 'outbound'}">
        <div class="pv-call-pulse"></div>
        <div class="pv-call-dir">${inbound ? 'Incoming Call' : 'Outbound Call'}</div>
        <div class="pv-call-number">${number}</div>
        <div class="pv-call-agent">${escapeHtml(voice)} · ${escapeHtml(lang)}</div>
        <div class="pv-call-status" id="demo-call-status">${inbound ? 'Connected' : 'Connected'}</div>
        <div class="pv-call-transcript" id="demo-call-tx">${escapeHtml(roleIntro[role] || '')}</div>
      </div>`;
    setTimeout(()=>{
      const tx = document.getElementById('demo-call-tx');
      if(tx){
        const agentReply = groundedAnswer(demo?.q || '', { sources: sources });
        tx.textContent = (roleIntro[role] || '') + '\n\nCaller: ' + (demo?.q || '') + '\n\nAgent: ' + agentReply;
      }
    }, 900);
    return;
  }

  body.innerHTML = `<div class="bubble bot">${roleIntro[role]}</div>`;
  const userQ = demo.q;
  const botA = groundedAnswer(userQ, { sources: sources });

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
  const role = selectedRole || 'Customer Service';
  const name = document.getElementById('w-name').value || (role + (isCallAgentRole(role) ? '' : ' Agent'));
  const isInbound = role === 'Inbound Call Agent';
  const isOutbound = role === 'Outbound Call Agent';
  const isCall = isInbound || isOutbound;
  const channels = isCall ? ['Voice', 'Phone'] : ['Web Chat'];
  const newAgent = {
    id:id, name:name, role:role,
    industry: document.getElementById('w-industry').value,
    language: document.getElementById('w-lang').value,
    voice: document.getElementById('w-voice').value,
    status:'Active', channels:channels, resolved:'0', rate:'—',
    sources: sources.slice(),
    whatsapp:{connected:false, phone:'', autoReply:true, demo:true},
    voiceCalling:{
      inbound: isInbound || false,
      outbound: isOutbound || false,
      demo:true,
      campaign:{ name: isOutbound ? 'Lead Follow-up' : 'Renewal Campaign', audience: isOutbound ? 'New leads this week' : 'Expiring in 30 days', total:0, completed:0, successful:0, running:false }
    }
  };
  // Inbound call agents can also do light outbound campaigns if needed later — keep outbound false by default
  if(isInbound){ newAgent.voiceCalling.inbound = true; newAgent.voiceCalling.outbound = false; }
  if(isOutbound){ newAgent.voiceCalling.inbound = false; newAgent.voiceCalling.outbound = true; }
  agents.unshift(newAgent);
  reindexAgent(newAgent);
  persistAgents();
  closeWizard();
  renderAgentsGrid(); renderOverview(); renderKnowledge(); renderIntegrations(); renderWorkflows();
  const canvasSel = document.getElementById('wf-canvas-agent');
  if(canvasSel) canvasSel.value = id;
  showToast(isCall ? 'Call agent created — upload knowledge & test on Voice' : 'Agent created — copy your embed code');
  openAgentDetail(id);
  detailTab(isCall ? 'voice' : 'channels');
}

/* ---------------- EMBED CODE + PREVIEW ---------------- */
function getWidgetScriptUrl(){
  if(location.protocol === 'http:' || location.protocol === 'https:'){
    const path = location.pathname.replace(/[^/]*$/, '');
    return location.origin + path + 'js/widget.js';
  }
  return 'js/widget.js';
}
function getKnowledgeScriptUrl(){
  if(location.protocol === 'http:' || location.protocol === 'https:'){
    const path = location.pathname.replace(/[^/]*$/, '');
    return location.origin + path + 'js/knowledge.js';
  }
  return 'js/knowledge.js';
}
function getEmbedCode(agentId){
  const kb = getKnowledgeScriptUrl();
  const src = getWidgetScriptUrl();
  return `<script src="${kb}"><\/script>\n<script src="${src}" data-agent-id="${agentId}" defer><\/script>`;
}
function renderChannelsPanel(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  const isCall = isCallAgentRole(a.role);
  const messaging = document.getElementById('channels-messaging');
  const voiceConnect = document.getElementById('channels-voice-connect');
  const banner = document.getElementById('channels-demo-banner');
  if(messaging) messaging.classList.toggle('hidden', isCall);
  if(voiceConnect) voiceConnect.classList.toggle('hidden', !isCall);
  if(banner){
    banner.textContent = isCall
      ? 'Demo mode — Voice / Phone connect is simulated for client demos. Production needs a telephony provider (e.g. Twilio).'
      : 'Demo mode — WhatsApp send/receive is simulated for client demos. Production needs Meta Cloud API.';
  }
  if(isCall) renderChannelsVoiceConnect();
  else { renderEmbedPanel(); renderWhatsAppPanel(); }
}
function renderChannelsVoiceConnect(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  normalizeAgent(a);
  const vc = a.voiceCalling;
  const lead = document.getElementById('ch-voice-lead');
  if(lead){
    lead.textContent = a.role === 'Outbound Call Agent'
      ? 'This outbound call agent focuses on dialing campaigns and follow-ups — no website chat embed.'
      : 'This inbound call agent answers your phone line — no website chat embed.';
  }
  const inEl = document.getElementById('ch-voice-inbound');
  const outEl = document.getElementById('ch-voice-outbound');
  const pill = document.getElementById('ch-voice-status-pill');
  if(inEl) inEl.checked = !!vc.inbound;
  if(outEl) outEl.checked = !!vc.outbound;
  if(pill){
    if(vc.inbound || vc.outbound){
      pill.textContent = (vc.inbound && vc.outbound) ? 'Inbound + Outbound' : (vc.inbound ? 'Inbound on' : 'Outbound on');
      pill.classList.add('on');
    } else {
      pill.textContent = 'Off';
      pill.classList.remove('on');
    }
  }
  const phone = document.getElementById('ch-voice-phone');
  if(phone) phone.value = a.role === 'Outbound Call Agent' ? '+1 (555) 010-OUT' : '+1 (555) 010-IN';
  const meta = document.getElementById('ch-voice-meta');
  if(meta){
    meta.innerHTML = `Agent ID: <code>${escapeHtml(a.id)}</code><br>Channels: ${(a.channels||[]).map(c=>escapeHtml(c)).join(' · ')} · Voice calling enabled`;
  }
  const simIn = document.getElementById('ch-sim-in');
  const simOut = document.getElementById('ch-sim-out');
  if(simIn) simIn.classList.toggle('hidden', a.role === 'Outbound Call Agent' && !vc.inbound);
  if(simOut) simOut.classList.toggle('hidden', a.role === 'Inbound Call Agent' && !vc.outbound);
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
  syncWidgetPreviewMic();
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
    const kb = answerFromSources(text, a);
    thread.messages.push({from:'agent', text:kb.answer, at:Date.now()+1});
    const ctx = { agentId: a.id, agentName: a.name, channel: 'WhatsApp', thread, found: kb.found };
    fireWorkflows('after_reply', ctx);
    if(kb.found === false) fireWorkflows('unknown_answer', ctx);
  }
  inbox.unshift(thread);
  fireWorkflows('new_conversation', { agentId: a.id, agentName: a.name, channel: 'WhatsApp', thread });
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
    const kb = answerFromSources(q, a);
    body.innerHTML += `<div class="bubble bot">${escapeHtml(kb.answer)}</div>`;
    body.scrollTop = body.scrollHeight;
    const ctx = { agentId: a.id, agentName: a.name, channel: 'Web Chat', found: kb.found };
    fireWorkflows('after_reply', ctx);
    if(kb.found === false) fireWorkflows('unknown_answer', ctx);
  }, 700);
}
function stopWpMic(){
  if(wpMicTimer){ clearInterval(wpMicTimer); wpMicTimer = null; }
  if(wpMicRecognition){
    try{ wpMicRecognition.stop(); }catch(e){}
    wpMicRecognition = null;
  }
  if(wpMicStream){
    wpMicStream.getTracks().forEach(t=>t.stop());
    wpMicStream = null;
  }
  wpMicRecorder = null;
  wpMicRecording = false;
  const btn = document.getElementById('wp-mic-btn');
  if(btn) btn.classList.remove('recording');
}
async function toggleWidgetPreviewMic(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  normalizeAgent(a);
  if(!a.voiceNotes.enabled || !a.voiceNotes.widgetMic){
    showToast('Enable voice notes + widget mic in Voice tab');
    return;
  }
  if(wpMicRecording && wpMicRecorder){
    wpMicRecorder.stop();
    return;
  }
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    showToast('Microphone not available in this browser');
    return;
  }
  try{
    wpMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    wpMicChunks = [];
    wpMicTranscript = '';
    wpMicRecording = true;
    wpMicRecorder = new MediaRecorder(wpMicStream);
    const btn = document.getElementById('wp-mic-btn');
    if(btn) btn.classList.add('recording');
    wpMicRecorder.ondataavailable = e=>{ if(e.data && e.data.size) wpMicChunks.push(e.data); };
    wpMicRecorder.onstop = ()=>{
      const secs = wpMicSeconds;
      const transcript = (wpMicTranscript || '').trim();
      const blob = new Blob(wpMicChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      stopWpMic();
      handleWidgetVoiceNote(a, url, secs, transcript);
    };
    wpMicRecorder.start();
    wpMicSeconds = 0;
    wpMicTimer = setInterval(()=>{
      wpMicSeconds++;
      if(wpMicSeconds >= (a.voiceNotes.maxSeconds || 60) && wpMicRecorder && wpMicRecorder.state === 'recording'){
        wpMicRecorder.stop();
        showToast('Max voice note length reached');
      }
    }, 1000);
    if(a.voiceNotes.transcribe){
      const rec = getSpeechRecognition();
      if(rec){
        wpMicRecognition = rec;
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = ev=>{
          let final = '';
          for(let i = 0; i < ev.results.length; i++){
            final += ev.results[i][0].transcript + ' ';
          }
          wpMicTranscript = final.trim();
        };
        try{ rec.start(); }catch(e){}
      }
    }
    showToast('Recording… tap mic again to send');
  }catch(err){
    stopWpMic();
    showToast(err.message || 'Could not access microphone');
  }
}
function handleWidgetVoiceNote(a, audioUrl, seconds, transcript){
  const body = document.getElementById('wp-chat-body');
  if(!body) return;
  const label = transcript
    ? escapeHtml(transcript)
    : (a.voiceNotes.transcribe ? '(No speech detected)' : 'Voice note');
  body.innerHTML += `<div class="bubble user"><div class="wp-voice-bubble">🎤 ${formatVnTime(seconds)} · ${label}<audio src="${audioUrl}" controls></audio></div></div>`;
  body.innerHTML += `<div class="demo-typing" id="wp-typing"><span></span><span></span><span></span></div>`;
  body.scrollTop = body.scrollHeight;
  setTimeout(()=>{
    const typing = document.getElementById('wp-typing'); if(typing) typing.remove();
    let answer;
    let found = false;
    if(!a.voiceNotes.transcribe){
      answer = 'I received your voice note (' + formatVnTime(seconds) + '). Enable “Transcribe voice notes” in Voice settings so I can answer from your knowledge.';
    } else if(!transcript){
      answer = 'I got your voice note but couldn’t transcribe it. Try again or type your question.';
    } else {
      const kb = answerFromSources(transcript, a);
      answer = kb.answer;
      found = kb.found;
    }
    body.innerHTML += `<div class="bubble bot">${escapeHtml(answer)}</div>`;
    body.scrollTop = body.scrollHeight;
    const ctx = { agentId: a.id, agentName: a.name, channel: 'Web Chat', found };
    fireWorkflows('after_reply', ctx);
    if(a.voiceNotes.transcribe && transcript && found === false) fireWorkflows('unknown_answer', ctx);
  }, 700);
}

/* ---------------- AI VOICE FIRST (DEMO) ---------------- */
const campaignAudiences = {
  'Renewal Campaign': 'Expiring in 30 days',
  'Lead Follow-up': 'New leads this week',
  'Appointment Reminders': 'Appointments tomorrow',
  'Collections': 'Overdue 15+ days',
  'Satisfaction Survey': 'Resolved tickets (7 days)'
};
function ensureVoiceChannel(a){
  if(!(a.channels||[]).includes('Voice') && !(a.channels||[]).includes('Phone')){
    a.channels = [...(a.channels||[]), 'Voice'];
  }
}
function syncCampaignStats(c){
  if(!c){
    c = { name:'—', audience:'—', total:0, completed:0, successful:0, running:false };
  }
  sanitizeCampaign(c);
  const donePct = c.total ? Math.round((c.completed/c.total)*100) : 0;
  const okPct = c.total ? Math.round((c.successful/c.total)*100) : 0;
  const pairs = [
    ['camp-name','vp-camp-name', c.name],
    ['camp-audience','vp-camp-audience', c.audience],
    ['camp-total','vp-camp-total', Number(c.total).toLocaleString()],
  ];
  pairs.forEach(([a,b,val])=>{
    const el1 = document.getElementById(a); if(el1) el1.textContent = val;
    const el2 = document.getElementById(b); if(el2) el2.textContent = val;
  });
  const doneHtml = `${Number(c.completed).toLocaleString()} <span class="pct">(${donePct}%)</span>`;
  const okHtml = `${Number(c.successful).toLocaleString()} <span class="pct">(${okPct}%)</span>`;
  const donePlain = `${Number(c.completed).toLocaleString()} (${donePct}%)`;
  const okPlain = `${Number(c.successful).toLocaleString()} (${okPct}%)`;
  const campDone = document.getElementById('camp-done'); if(campDone) campDone.innerHTML = doneHtml;
  const campOk = document.getElementById('camp-ok'); if(campOk) campOk.innerHTML = okHtml;
  const vpDone = document.getElementById('vp-camp-done'); if(vpDone) vpDone.textContent = donePlain;
  const vpOk = document.getElementById('vp-camp-ok'); if(vpOk) vpOk.textContent = okPlain;

  [['camp-type','camp-start-btn','camp-stop-btn','camp-run-note'],['vp-camp-type','vp-camp-start-btn','vp-camp-stop-btn','vp-camp-run-note']].forEach(([typeId,startId,stopId,noteId])=>{
    const typeEl = document.getElementById(typeId);
    if(typeEl && c.name && c.name !== '—'){
      const opts = [...typeEl.options].map(o=>o.value);
      if(opts.includes(c.name)) typeEl.value = c.name;
      typeEl.disabled = !!c.running;
    }
    const note = document.getElementById(noteId);
    const startBtn = document.getElementById(startId);
    const stopBtn = document.getElementById(stopId);
    if(note) note.style.display = c.running ? 'block' : 'none';
    if(startBtn){
      startBtn.classList.toggle('hidden', !!c.running);
      startBtn.disabled = !!c.running;
      startBtn.textContent = 'Start Campaign';
    }
    if(stopBtn){
      stopBtn.classList.toggle('hidden', !c.running);
      stopBtn.disabled = !c.running;
    }
  });
}
function createCallAgentFromVoice(role){
  if(!isCallAgentRole(role)) return;
  const id = genAgentId();
  const isInbound = role === 'Inbound Call Agent';
  const isOutbound = role === 'Outbound Call Agent';
  const newAgent = {
    id,
    name: role,
    role,
    industry: 'Clinic',
    language: 'English',
    voice: 'Emma (Natural)',
    status: 'Active',
    channels: ['Voice', 'Phone'],
    resolved: '0',
    rate: '—',
    sources: [],
    whatsapp: { connected:false, phone:'', autoReply:true, demo:true },
    voiceCalling: {
      inbound: isInbound,
      outbound: isOutbound,
      demo: true,
      campaign: {
        name: isOutbound ? 'Lead Follow-up' : 'Renewal Campaign',
        audience: isOutbound ? 'New leads this week' : 'Expiring in 30 days',
        total: 0, completed: 0, successful: 0, running: false
      }
    }
  };
  agents.unshift(newAgent);
  reindexAgent(newAgent);
  persistAgents();
  activeDetailId = id;
  renderAgentsGrid();
  renderOverview();
  renderKnowledge();
  renderIntegrations();
  renderWorkflows();
  renderAIVoicePage();
  const sel = document.getElementById('vp-agent');
  if(sel) sel.value = id;
  const canvasSel = document.getElementById('wf-canvas-agent');
  if(canvasSel) canvasSel.value = id;
  onVoicePageAgentChange();
  showToast(isInbound ? 'Inbound call agent created' : 'Outbound call agent created');
}
function renderAIVoicePage(){
  const sel = document.getElementById('vp-agent');
  if(!sel) return;
  const prev = sel.value || activeDetailId || agents[0]?.id;
  sel.innerHTML = agents.map(a=>`<option value="${a.id}">${escapeHtml(a.name)} · ${escapeHtml(a.role)}</option>`).join('') || '<option value="">No agents yet</option>';
  if(prev && agents.some(a=>a.id===prev)) sel.value = prev;
  const a = agents.find(x=>x.id===sel.value);
  if(a){
    activeDetailId = a.id;
    normalizeAgent(a);
    if(!a.voiceCalling.inbound && !a.voiceCalling.outbound){
      a.voiceCalling.inbound = true;
      a.voiceCalling.outbound = true;
      ensureVoiceChannel(a);
      persistAgents();
    }
    syncCampaignStats(a.voiceCalling.campaign);
  } else {
    activeDetailId = null;
    syncCampaignStats(null);
  }
}
function onVoicePageAgentChange(){
  const id = document.getElementById('vp-agent')?.value;
  if(!id) return;
  activeDetailId = id;
  const a = agents.find(x=>x.id===id); if(!a) return;
  normalizeAgent(a);
  syncCampaignStats(a.voiceCalling.campaign);
}
function simulateIncomingCallFromPage(){
  const id = document.getElementById('vp-agent')?.value;
  if(id) activeDetailId = id;
  simulateIncomingCall();
}
function simulateOutboundCallFromPage(){
  const id = document.getElementById('vp-agent')?.value;
  if(id) activeDetailId = id;
  simulateOutboundCall();
}
function updateCampaignTypeFromPage(){
  const id = document.getElementById('vp-agent')?.value;
  if(id) activeDetailId = id;
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  normalizeAgent(a);
  const name = document.getElementById('vp-camp-type').value;
  a.voiceCalling.campaign.name = name;
  a.voiceCalling.campaign.audience = campaignAudiences[name] || 'Selected audience';
  persistAgents();
  syncCampaignStats(a.voiceCalling.campaign);
  if(document.getElementById('camp-type')) document.getElementById('camp-type').value = name;
}
function startCallCampaignFromPage(){
  const id = document.getElementById('vp-agent')?.value;
  if(id) activeDetailId = id;
  startCallCampaign();
}
function stopCallCampaignFromPage(){
  const id = document.getElementById('vp-agent')?.value;
  if(id) activeDetailId = id;
  stopCallCampaign();
}
function renderVoicePanel(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  normalizeAgent(a);
  const vc = a.voiceCalling;
  const vn = a.voiceNotes;
  const inEl = document.getElementById('voice-inbound-toggle');
  const outEl = document.getElementById('voice-outbound-toggle');
  const pill = document.getElementById('voice-status-pill');
  if(inEl) inEl.checked = !!vc.inbound;
  if(outEl) outEl.checked = !!vc.outbound;
  if(pill){
    if(vc.inbound || vc.outbound){
      pill.textContent = (vc.inbound && vc.outbound) ? 'Inbound + Outbound' : (vc.inbound ? 'Inbound on' : 'Outbound on');
      pill.classList.add('on');
    } else {
      pill.textContent = 'Off';
      pill.classList.remove('on');
    }
  }
  const en = document.getElementById('vn-enabled');
  const tr = document.getElementById('vn-transcribe');
  const mic = document.getElementById('vn-widget-mic');
  const max = document.getElementById('vn-max-seconds');
  if(en) en.checked = !!vn.enabled;
  if(tr) tr.checked = !!vn.transcribe;
  if(mic) mic.checked = !!vn.widgetMic;
  if(max) max.value = String(vn.maxSeconds || 60);
  const demo = document.getElementById('vn-demo');
  if(demo) demo.classList.toggle('disabled', !vn.enabled);
  const recBtn = document.getElementById('vn-rec-btn');
  if(recBtn && !vnDemoRecorder) recBtn.disabled = !vn.enabled;
  syncWidgetPreviewMic();
  syncCampaignStats(vc.campaign);
}
function saveVoiceNoteSettings(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  normalizeAgent(a);
  a.voiceNotes.enabled = !!document.getElementById('vn-enabled')?.checked;
  a.voiceNotes.transcribe = !!document.getElementById('vn-transcribe')?.checked;
  a.voiceNotes.widgetMic = !!document.getElementById('vn-widget-mic')?.checked;
  a.voiceNotes.maxSeconds = Number(document.getElementById('vn-max-seconds')?.value) || 60;
  persistAgents();
  renderVoicePanel();
  renderEmbedPanel();
  refreshWorkflowCanvasIfVisible();
  showToast('Voice note settings saved');
}
function syncWidgetPreviewMic(){
  const a = agents.find(x=>x.id===activeDetailId);
  const btn = document.getElementById('wp-mic-btn');
  if(!btn) return;
  const show = !!(a && a.voiceNotes?.enabled && a.voiceNotes?.widgetMic);
  btn.classList.toggle('hidden', !show);
}
function formatVnTime(sec){
  const s = Math.max(0, Number(sec) || 0);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function getSpeechRecognition(){
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}
function stopVnDemoStreams(){
  if(vnDemoTimer){ clearInterval(vnDemoTimer); vnDemoTimer = null; }
  if(vnDemoRecognition){
    try{ vnDemoRecognition.stop(); }catch(e){}
    vnDemoRecognition = null;
  }
  if(vnDemoStream){
    vnDemoStream.getTracks().forEach(t=>t.stop());
    vnDemoStream = null;
  }
  vnDemoRecorder = null;
}
async function toggleVoiceNoteDemoRecord(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  normalizeAgent(a);
  if(!a.voiceNotes.enabled){ showToast('Enable voice notes first'); return; }
  if(vnDemoRecorder && vnDemoRecorder.state === 'recording'){
    vnDemoRecorder.stop();
    return;
  }
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    showToast('Microphone not available in this browser');
    return;
  }
  try{
    vnDemoStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    vnDemoChunks = [];
    vnDemoTranscript = '';
    vnDemoRecorder = new MediaRecorder(vnDemoStream);
    vnDemoRecorder.ondataavailable = e=>{ if(e.data && e.data.size) vnDemoChunks.push(e.data); };
    vnDemoRecorder.onstop = ()=>{
      stopVnDemoStreams();
      const blob = new Blob(vnDemoChunks, { type: 'audio/webm' });
      if(vnDemoUrl) URL.revokeObjectURL(vnDemoUrl);
      vnDemoUrl = URL.createObjectURL(blob);
      const transcript = (vnDemoTranscript || '').trim();
      vnDemoLastNote = {
        audioUrl: vnDemoUrl,
        duration: vnDemoSeconds,
        transcript,
        at: Date.now()
      };
      const audio = document.getElementById('vn-demo-audio');
      if(audio){ audio.src = vnDemoUrl; audio.classList.remove('hidden'); }
      const playBtn = document.getElementById('vn-play-btn');
      if(playBtn) playBtn.disabled = false;
      const sendBtn = document.getElementById('vn-send-btn');
      if(sendBtn) sendBtn.disabled = false;
      const recBtn = document.getElementById('vn-rec-btn');
      if(recBtn){ recBtn.classList.remove('recording'); recBtn.textContent = 'Hold / tap to record'; recBtn.disabled = !a.voiceNotes.enabled; }
      const status = document.getElementById('vn-demo-status');
      if(status) status.textContent = 'Recording saved — ready to send';
      const txEl = document.getElementById('vn-demo-transcript');
      if(a.voiceNotes.transcribe){
        const shown = transcript || '(Demo) No speech detected — you can still send the audio note.';
        if(txEl){ txEl.style.display = 'block'; txEl.textContent = 'Transcript: ' + shown; }
      } else if(txEl){
        txEl.style.display = 'block';
        txEl.textContent = 'Transcription is off — audio only (' + formatVnTime(vnDemoSeconds) + ').';
      }
    };
    vnDemoRecorder.start();
    vnDemoSeconds = 0;
    vnDemoLastNote = null;
    const sendBtn = document.getElementById('vn-send-btn');
    if(sendBtn) sendBtn.disabled = true;
    const status = document.getElementById('vn-demo-status');
    const timer = document.getElementById('vn-demo-timer');
    const recBtn = document.getElementById('vn-rec-btn');
    if(status) status.textContent = 'Recording… tap again to stop';
    if(recBtn){ recBtn.classList.add('recording'); recBtn.textContent = 'Stop recording'; }
    if(timer) timer.textContent = '0:00';
    vnDemoTimer = setInterval(()=>{
      vnDemoSeconds++;
      if(timer) timer.textContent = formatVnTime(vnDemoSeconds);
      if(vnDemoSeconds >= (a.voiceNotes.maxSeconds || 60) && vnDemoRecorder && vnDemoRecorder.state === 'recording'){
        vnDemoRecorder.stop();
        showToast('Max voice note length reached');
      }
    }, 1000);
    if(a.voiceNotes.transcribe){
      const rec = getSpeechRecognition();
      if(rec){
        vnDemoRecognition = rec;
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = ev=>{
          let final = '';
          for(let i = 0; i < ev.results.length; i++){
            final += ev.results[i][0].transcript + ' ';
          }
          vnDemoTranscript = final.trim();
        };
        try{ rec.start(); }catch(e){}
      }
    }
  }catch(err){
    stopVnDemoStreams();
    showToast(err.message || 'Could not access microphone');
  }
}
function playVoiceNoteDemo(){
  const audio = document.getElementById('vn-demo-audio');
  if(!audio || !audio.src){ showToast('Record a voice note first'); return; }
  audio.classList.remove('hidden');
  audio.play().catch(()=>showToast('Could not play audio'));
}
function sendVoiceNoteDemoToInbox(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  normalizeAgent(a);
  if(!a.voiceNotes.enabled){ showToast('Enable voice notes first'); return; }
  if(!vnDemoLastNote || !vnDemoLastNote.audioUrl){
    showToast('Record a voice note first');
    return;
  }
  const note = vnDemoLastNote;
  const transcript = (note.transcript || '').trim();
  const customerText = transcript
    ? ('🎤 Voice note: ' + transcript)
    : ('🎤 Voice note (' + formatVnTime(note.duration || 0) + ')');
  const names = ['Alex R.','Sam T.','Jordan L.','Casey M.','Riley P.'];
  const customer = names[Math.floor(Math.random()*names.length)];
  const thread = {
    id: 'th_vn_' + Math.random().toString(36).slice(2,8),
    channel: 'Web Chat',
    customer,
    phone: '',
    agentId: a.id,
    updatedAt: Date.now(),
    tag: 'Voice note',
    messages: [{
      from: 'customer',
      type: 'voice',
      text: customerText,
      transcript: transcript || '',
      audioUrl: note.audioUrl,
      duration: note.duration || 0,
      at: Date.now()
    }]
  };

  let answer;
  let found = false;
  if(!a.voiceNotes.transcribe){
    answer = 'I received your voice note (' + formatVnTime(note.duration || 0) + '). Enable “Transcribe voice notes” so I can answer from knowledge.';
  } else if(!transcript){
    answer = 'I got your voice note but couldn’t transcribe it. Try again or type your question.';
  } else {
    const kb = answerFromSources(transcript, a);
    answer = kb.answer;
    found = kb.found;
  }
  thread.messages.push({ from:'agent', text: answer, at: Date.now()+1 });

  inbox.unshift(thread);
  persistInbox();
  const ctx = { agentId: a.id, agentName: a.name, channel: 'Web Chat', thread, found };
  fireWorkflows('new_conversation', ctx);
  fireWorkflows('after_reply', ctx);
  if(a.voiceNotes.transcribe && transcript && found === false) fireWorkflows('unknown_answer', ctx);

  const sendBtn = document.getElementById('vn-send-btn');
  if(sendBtn) sendBtn.disabled = true;
  const status = document.getElementById('vn-demo-status');
  if(status) status.textContent = 'Sent to Omni inbox';

  omniFilter = 'Web Chat';
  setOmniFilter('Web Chat');
  activeThreadId = thread.id;
  goPage('conversations');
  openOmniThread(thread.id);
  showToast('Voice note conversation started');
  refreshWorkflowCanvasIfVisible();
}
function toggleVoiceInbound(on){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  normalizeAgent(a);
  a.voiceCalling.inbound = !!on;
  if(on) ensureVoiceChannel(a);
  persistAgents();
  renderVoicePanel();
  if(isCallAgentRole(a.role)) renderChannelsVoiceConnect();
  renderAgentsGrid();
  renderIntegrations();
  refreshWorkflowCanvasIfVisible();
  showToast(on ? 'Inbound AI answering enabled (demo)' : 'Inbound disabled');
}
function toggleVoiceOutbound(on){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  normalizeAgent(a);
  a.voiceCalling.outbound = !!on;
  if(on) ensureVoiceChannel(a);
  persistAgents();
  renderVoicePanel();
  if(isCallAgentRole(a.role)) renderChannelsVoiceConnect();
  renderAgentsGrid();
  renderIntegrations();
  refreshWorkflowCanvasIfVisible();
  showToast(on ? 'Outbound calling enabled (demo)' : 'Outbound disabled');
}
function updateCampaignType(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  normalizeAgent(a);
  const name = document.getElementById('camp-type').value;
  a.voiceCalling.campaign.name = name;
  a.voiceCalling.campaign.audience = campaignAudiences[name] || 'Selected audience';
  persistAgents();
  syncCampaignStats(a.voiceCalling.campaign);
}
function randomPhone(){
  return '+1 (555) ' + String(100 + Math.floor(Math.random()*900)) + '-' + String(1000 + Math.floor(Math.random()*9000));
}
function openCallOverlay(dir, phone, agentName){
  document.getElementById('call-dir-label').textContent = dir === 'outbound' ? 'Outbound Call' : 'Incoming Call';
  document.getElementById('call-number').textContent = phone;
  document.getElementById('call-agent-name').textContent = agentName || 'GreatAgen';
  document.getElementById('call-actions').classList.remove('hidden');
  document.getElementById('call-live').classList.add('hidden');
  document.getElementById('call-transcript').textContent = '';
  document.getElementById('call-timer').textContent = '00:00';
  document.getElementById('call-overlay').classList.remove('hidden');
}
function simulateIncomingCall(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  normalizeAgent(a);
  if(!a.voiceCalling.inbound){
    a.voiceCalling.inbound = true;
    ensureVoiceChannel(a);
    persistAgents();
    renderVoicePanel();
  }
  const phone = randomPhone();
  const names = ['Sarah M.','John D.','David L.','Michael M.','Robert R.'];
  pendingCall = {
    dir:'inbound',
    phone,
    customer: names[Math.floor(Math.random()*names.length)],
    agentId: a.id,
    question: roleDemo[a.role]?.q || 'I need help with my account.'
  };
  openCallOverlay('inbound', phone, a.name);
  showToast('Incoming call ringing (demo)');
}
function simulateOutboundCall(){
  const a = agents.find(x=>x.id===activeDetailId); if(!a) return;
  normalizeAgent(a);
  if(!a.voiceCalling.outbound){
    a.voiceCalling.outbound = true;
    ensureVoiceChannel(a);
    persistAgents();
    renderVoicePanel();
  }
  const phone = randomPhone();
  pendingCall = {
    dir:'outbound',
    phone,
    customer: 'Lead Prospect',
    agentId: a.id,
    question: a.voiceCalling.campaign?.name || 'Follow-up call'
  };
  openCallOverlay('outbound', phone, a.name);
  // Auto-connect outbound after brief ring for demo polish
  setTimeout(()=>{ if(pendingCall && pendingCall.dir==='outbound') acceptIncomingCall(); }, 900);
  showToast('Outbound call dialing (demo)');
}
function declineIncomingCall(){
  document.getElementById('call-overlay').classList.add('hidden');
  if(pendingCall){
    logPhoneCall(pendingCall, false, 'Call declined');
    pendingCall = null;
  }
  showToast('Call declined');
}
function acceptIncomingCall(){
  if(!pendingCall) return;
  document.getElementById('call-actions').classList.add('hidden');
  document.getElementById('call-live').classList.remove('hidden');
  const a = agents.find(x=>x.id===pendingCall.agentId);
  const greet = roleIntro[a?.role] || 'Hi! Thanks for calling. How can I help you today?';
  const kb = a ? answerFromSources(pendingCall.question, a) : { answer: "I've noted your request and will take care of it.", found: false };
  const reply = kb.answer;
  pendingCall.kbFound = kb.found;
  const transcript = document.getElementById('call-transcript');
  transcript.textContent = 'Connecting…';
  callSeconds = 0;
  clearInterval(callTimer);
  callTimer = setInterval(()=>{
    callSeconds++;
    const mm = String(Math.floor(callSeconds/60)).padStart(2,'0');
    const ss = String(callSeconds%60).padStart(2,'0');
    document.getElementById('call-timer').textContent = mm + ':' + ss;
  }, 1000);
  setTimeout(()=>{ transcript.textContent = 'AI: ' + greet; }, 400);
  setTimeout(()=>{ transcript.textContent = 'Caller: ' + pendingCall.question; }, 1600);
  setTimeout(()=>{
    transcript.textContent = 'AI: ' + reply;
    pendingCall.answer = reply;
    if(a){
      const ctx = { agentId: a.id, agentName: a.name, channel: 'Phone', found: kb.found };
      fireWorkflows('after_reply', ctx);
      if(kb.found === false) fireWorkflows('unknown_answer', ctx);
    }
  }, 2800);
}
function endActiveCall(){
  clearInterval(callTimer); callTimer = null;
  document.getElementById('call-overlay').classList.add('hidden');
  if(pendingCall){
    const a = agents.find(x=>x.id===pendingCall.agentId);
    logPhoneCall(pendingCall, true, pendingCall.answer || 'Call completed');
    if(a){
      fireWorkflows('call_ended', {
        agentId: a.id,
        agentName: a.name,
        channel: 'Phone',
        found: pendingCall.kbFound
      });
    }
    pendingCall = null;
  }
  showToast('Call ended — logged in Omni inbox');
}
function logPhoneCall(call, answered, summary){
  const thread = {
    id: 'th_ph_' + Math.random().toString(36).slice(2,8),
    channel: 'Phone',
    customer: call.customer || 'Caller',
    phone: call.phone,
    agentId: call.agentId,
    updatedAt: Date.now(),
    messages: [
      { from:'customer', text: (call.dir==='outbound' ? 'Outbound: ' : 'Inbound: ') + (call.question || 'Phone call'), at: Date.now()-2000 },
      { from:'agent', text: answered ? summary : 'Missed / declined (demo)', at: Date.now() }
    ]
  };
  inbox.unshift(thread);
  persistInbox();
  persistAgents();
  activeThreadId = thread.id;
}
function stopCallCampaign(){
  const a = agents.find(x=>x.id===activeDetailId);
  clearInterval(campaignTimer);
  campaignTimer = null;
  if(!a){
    syncCampaignStats(null);
    showToast('Campaign stopped');
    return;
  }
  normalizeAgent(a);
  const c = a.voiceCalling.campaign;
  if(!c.running){
    syncCampaignStats(c);
    return;
  }
  c.running = false;
  persistAgents();
  renderVoicePanel();
  syncCampaignStats(c);
  renderOverview();
  showToast('Campaign stopped — ' + c.completed + ' of ' + c.total + ' calls placed');
}
function startCallCampaign(){
  const a = agents.find(x=>x.id===activeDetailId);
  if(!a){ showToast('Select or create an agent first'); return; }
  normalizeAgent(a);
  if(!a.voiceCalling.outbound){
    a.voiceCalling.outbound = true;
    ensureVoiceChannel(a);
  }
  const c = a.voiceCalling.campaign;
  if(c.running){ showToast('Campaign already running'); return; }

  const typeEl = document.getElementById('vp-camp-type') || document.getElementById('camp-type');
  if(typeEl && typeEl.value){
    c.name = typeEl.value;
    c.audience = campaignAudiences[c.name] || 'Selected audience';
  }
  const CAMPAIGN_SIZE = 50;
  const CALL_GAP_MS = 30000; // next call after 30 seconds
  c.total = CAMPAIGN_SIZE;
  c.completed = 0;
  c.successful = 0;
  c.running = true;
  persistAgents();
  renderVoicePanel();
  syncCampaignStats(c);

  function placeCampaignCall(){
    if(!c.running) return;
    const phone = randomPhone();
    const reached = Math.random() > 0.4;
    c.completed = Math.min(c.total, c.completed + 1);
    if(reached) c.successful = Math.min(c.completed, c.successful + 1);

    inbox.unshift({
      id: 'th_ph_' + Math.random().toString(36).slice(2,8),
      channel:'Phone',
      customer: 'Campaign Contact',
      phone,
      agentId: a.id,
      updatedAt: Date.now(),
      messages:[
        {from:'customer', text:'Outbound campaign call: ' + c.name, at:Date.now()-1000},
        {from:'agent', text: reached ? 'Contact reached — action completed.' : 'No answer — will retry later.', at:Date.now()}
      ]
    });
    persistInbox();
    persistAgents();
    if(activeDetailId===a.id){
      renderVoicePanel();
      syncCampaignStats(a.voiceCalling.campaign);
    }
    renderOverview();
    renderConversations();

    if(c.completed >= c.total){
      clearInterval(campaignTimer);
      campaignTimer = null;
      c.running = false;
      persistAgents();
      if(activeDetailId===a.id){
        renderVoicePanel();
        syncCampaignStats(a.voiceCalling.campaign);
      }
      renderOverview();
      renderAnalytics();
      showToast('Campaign completed — ' + c.successful + ' successful of ' + c.total);
      return;
    }
    showToast('Call ' + c.completed + '/' + c.total + ' placed — next call in 30s');
  }

  clearInterval(campaignTimer);
  campaignTimer = null;
  // First call immediately, then one call every 30 seconds
  placeCampaignCall();
  if(c.running && c.completed < c.total){
    campaignTimer = setInterval(placeCampaignCall, CALL_GAP_MS);
  }
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
