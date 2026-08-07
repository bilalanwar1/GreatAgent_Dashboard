/**
 * GreatAgen frontend knowledge (extract + chunk + retrieve).
 * No embeddings / LLM — grounded extractive answers only.
 */
(function (global) {
  const STOP = new Set([
    'the','a','an','and','or','to','of','in','on','for','is','are','was','were','be','been',
    'what','when','where','how','who','which','do','does','did','can','could','would','should',
    'you','your','me','my','we','our','us','they','them','their','this','that','with','from',
    'about','please','tell','give','get','have','has','had','will','just','also','any','all'
  ]);

  const UNKNOWN =
    "I couldn't find that in this agent's knowledge. Try asking about something covered in the uploaded website or documents, or add more knowledge sources.";

  const NO_KNOWLEDGE =
    "This agent has no searchable knowledge yet. Add a website URL (Extract) or upload a PDF, DOCX, or TXT file first.";

  function tokenize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t));
  }

  function chunkText(text, meta) {
    const clean = String(text || '')
      .replace(/\r/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!clean) return [];

    const size = 700;
    const overlap = 100;
    const chunks = [];
    let i = 0;
    let idx = 0;
    while (i < clean.length) {
      let end = Math.min(clean.length, i + size);
      if (end < clean.length) {
        const slice = clean.slice(i, end);
        const lastBreak = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('. '), slice.lastIndexOf(' '));
        if (lastBreak > size * 0.4) end = i + lastBreak + 1;
      }
      const piece = clean.slice(i, end).trim();
      if (piece.length > 40) {
        chunks.push({
          id: (meta.sourceKey || 'src') + '_c' + idx,
          sourceKey: meta.sourceKey || '',
          sourceName: meta.sourceName || 'Knowledge',
          sourceType: meta.sourceType || 'url',
          text: piece
        });
        idx++;
      }
      if (end >= clean.length) break;
      i = Math.max(i + 1, end - overlap);
    }
    return chunks;
  }

  function sourceKey(s, i) {
    return (s.type || 'src') + ':' + (s.name || i);
  }

  function readySources(sources) {
    return (sources || []).filter(
      (s) => s && s.content && s.status !== 'error' && s.status !== 'extracting' && String(s.content).trim().length > 40
    );
  }

  function rebuildAgentIndex(agent) {
    if (!agent) return [];
    const chunks = [];
    readySources(agent.sources).forEach((s, i) => {
      const key = sourceKey(s, i);
      chunkText(s.content, {
        sourceKey: key,
        sourceName: s.name || 'Source',
        sourceType: s.type || 'url'
      }).forEach((c) => chunks.push(c));
    });
    agent.knowledgeChunks = chunks;
    return chunks;
  }

  function ensureIndex(agent) {
    if (!agent) return [];
    if (!Array.isArray(agent.knowledgeChunks) || !agent.knowledgeChunks.length) {
      return rebuildAgentIndex(agent);
    }
    // Rebuild if sources exist with content but chunks empty / stale count
    const ready = readySources(agent.sources);
    if (ready.length && !agent.knowledgeChunks.length) return rebuildAgentIndex(agent);
    return agent.knowledgeChunks;
  }

  function scoreChunk(tokens, chunk) {
    if (!tokens.length || !chunk || !chunk.text) return 0;
    const lower = chunk.text.toLowerCase();
    const nameLower = String(chunk.sourceName || '').toLowerCase();
    let score = 0;
    let hits = 0;
    tokens.forEach((t) => {
      if (lower.includes(t)) {
        hits++;
        const freq = lower.split(t).length - 1;
        score += 1 + (t.length > 5 ? 0.5 : 0) + Math.min(freq - 1, 3) * 0.15;
      }
      if (nameLower.includes(t)) score += 0.35;
    });
    // Prefer denser matches
    if (hits > 1) score += hits * 0.35;
    // Bonus if most query tokens appear
    const coverage = hits / tokens.length;
    score += coverage * 1.2;
    return score;
  }

  function retrieve(question, agent, limit) {
    const tokens = tokenize(question);
    const chunks = ensureIndex(agent);
    if (!chunks.length) return { tokens, hits: [] };

    const ranked = chunks
      .map((chunk) => ({ chunk, score: scoreChunk(tokens, chunk) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const top = ranked.slice(0, limit || 3);
    return { tokens, hits: top };
  }

  function minScoreFor(tokens) {
    if (!tokens.length) return 99;
    if (tokens.length === 1) return 1.1;
    return Math.max(1.4, tokens.length * 0.45);
  }

  function answerFromKnowledge(question, agentOrSources) {
    const q = String(question || '').trim();
    if (!q) return { answer: 'Please type a question.', cite: null, found: false };

    // Support passing agent object or legacy sources array
    let agent = agentOrSources;
    if (Array.isArray(agentOrSources)) {
      agent = { sources: agentOrSources, knowledgeChunks: null };
    }
    if (!agent) return { answer: NO_KNOWLEDGE, cite: null, found: false };

    const ready = readySources(agent.sources);
    if (!ready.length) return { answer: NO_KNOWLEDGE, cite: null, found: false };

    // Always refresh index from current sources so deletes/updates apply
    rebuildAgentIndex(agent);

    const { tokens, hits } = retrieve(q, agent, 3);
    const threshold = minScoreFor(tokens);
    const strong = hits.filter((h) => h.score >= threshold);

    if (!strong.length) {
      return { answer: UNKNOWN, cite: null, found: false };
    }

    const cites = [];
    const parts = strong.map((h, i) => {
      const name = h.chunk.sourceName;
      if (name && !cites.includes(name)) cites.push(name);
      const text = h.chunk.text.length > 450 ? h.chunk.text.slice(0, 450) + '…' : h.chunk.text;
      return strong.length > 1 ? '(' + (i + 1) + ') ' + text : text;
    });

    return {
      answer: parts.join('\n\n'),
      cite: cites.join(' · '),
      found: true,
      score: strong[0].score
    };
  }

  function extOf(name) {
    const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : '';
  }

  function readAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsText(file);
    });
  }

  function readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  async function extractPdfText(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF library not loaded');
    }
    const data = await readAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const maxPages = Math.min(pdf.numPages, 40);
    const parts = [];
    for (let p = 1; p <= maxPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const text = content.items.map((it) => it.str).join(' ');
      if (text.trim()) parts.push(text);
    }
    return parts.join('\n\n').trim();
  }

  async function extractDocxText(file) {
    if (typeof mammoth === 'undefined') {
      throw new Error('DOCX library not loaded');
    }
    const data = await readAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer: data });
    return String(result.value || '').trim();
  }

  async function extractFileText(file) {
    if (!file) throw new Error('No file selected');
    const ext = extOf(file.name);
    const type = (file.type || '').toLowerCase();

    if (ext === 'txt' || ext === 'md' || ext === 'csv' || type.startsWith('text/')) {
      const text = (await readAsText(file)).trim();
      if (text.length < 20) throw new Error('File has little or no readable text');
      return text.slice(0, 200000);
    }
    if (ext === 'pdf' || type === 'application/pdf') {
      const text = await extractPdfText(file);
      if (!text || text.length < 20) throw new Error('No readable text found in PDF');
      return text.slice(0, 200000);
    }
    if (ext === 'docx' || type.includes('wordprocessingml')) {
      const text = await extractDocxText(file);
      if (!text || text.length < 20) throw new Error('No readable text found in DOCX');
      return text.slice(0, 200000);
    }
    if (ext === 'doc') {
      throw new Error('Legacy .doc is not supported — please upload DOCX, PDF, or TXT');
    }
    throw new Error('Unsupported file type. Upload PDF, DOCX, or TXT');
  }

  global.Knowledge = {
    UNKNOWN,
    NO_KNOWLEDGE,
    tokenize,
    chunkText,
    rebuildAgentIndex,
    ensureIndex,
    retrieve,
    answerFromKnowledge,
    extractFileText,
    readySources,
    sourceKey
  };
})(window);
