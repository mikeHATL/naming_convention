/* ═══════════════════════════════════════════════════════
   ATL BIM Naming Convention Checker — Static SPA
   Auth: APS PKCE (no server required)
   ═══════════════════════════════════════════════════════ */

const App = (() => {

  // ─── APS endpoints ────────────────────────────────────────────────────────
  const APS_AUTH_URL  = 'https://developer.api.autodesk.com/authentication/v2/authorize';
  const APS_TOKEN_URL = 'https://developer.api.autodesk.com/authentication/v2/token';
  const APS_BASE      = 'https://developer.api.autodesk.com';

  // ─── Config (from config.js) ──────────────────────────────────────────────
  function getCallbackUrl() {
    if (window.APS_CALLBACK_URL) return window.APS_CALLBACK_URL;
    // Build URL to callback.html (same directory as index.html)
    const base = location.href.split('?')[0];
    const dir  = base.endsWith('/') ? base : base.substring(0, base.lastIndexOf('/') + 1);
    return dir + 'callback.html';
  }

  // ─── State ────────────────────────────────────────────────────────────────
  let state = {
    selectedHubId: null,
    selectedProjectId: null,
    selectedFolderId: null,
    selectedFolderName: '',
    files: [],
    filter: 'all',
    search: '',
    sortCol: 'name',
    sortDir: 'asc',
    scanning: false,
    scanAborted: false,
    expandedRows: new Set()
  };

  let renderTimer = null;
  let dashTimer   = null;

  // ─── PKCE helpers ─────────────────────────────────────────────────────────
  function base64urlEncode(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function generateVerifier() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return base64urlEncode(arr.buffer);
  }

  async function generateChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64urlEncode(digest);
  }

  // ─── Auth: login ──────────────────────────────────────────────────────────
  async function login() {
    const clientId = window.APS_CLIENT_ID;
    if (!clientId || clientId === 'YOUR_CLIENT_ID_HERE') {
      alert('Please set your APS_CLIENT_ID in config.js before signing in.');
      return;
    }

    const verifier   = generateVerifier();
    const challenge  = await generateChallenge(verifier);
    sessionStorage.setItem('pkce_verifier', verifier);

    const params = new URLSearchParams({
      response_type:         'code',
      client_id:             clientId,
      redirect_uri:          getCallbackUrl(),
      scope:                 'data:read account:read user:read',
      code_challenge:        challenge,
      code_challenge_method: 'S256',
      nonce:                 Math.random().toString(36).slice(2)
    });

    window.location.href = `${APS_AUTH_URL}?${params}`;
  }

  // ─── Auth: handle callback (code in URL) ──────────────────────────────────
  async function handleCallback(code) {
    const verifier = sessionStorage.getItem('pkce_verifier');
    if (!verifier) throw new Error('PKCE verifier missing — please sign in again.');

    const res = await fetch(APS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  getCallbackUrl(),
        client_id:     window.APS_CLIENT_ID,
        code_verifier: verifier
      })
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Token exchange failed (${res.status}): ${txt}`);
    }

    const tokens = await res.json();
    sessionStorage.removeItem('pkce_verifier');
    sessionStorage.setItem('aps_token',     tokens.access_token);
    sessionStorage.setItem('aps_token_exp', Date.now() + tokens.expires_in * 1000);
    if (tokens.refresh_token) {
      sessionStorage.setItem('aps_refresh', tokens.refresh_token);
    }

    // Clean ?code=... from the URL
    window.history.replaceState({}, '', getCallbackUrl());
  }

  // ─── Auth: token access ───────────────────────────────────────────────────
  function getToken() {
    return sessionStorage.getItem('aps_token');
  }

  function isAuthenticated() {
    const token = getToken();
    const exp   = Number(sessionStorage.getItem('aps_token_exp') || 0);
    return !!token && Date.now() < exp;
  }

  function logout() {
    sessionStorage.removeItem('aps_token');
    sessionStorage.removeItem('aps_token_exp');
    sessionStorage.removeItem('aps_refresh');
    showLogin();
  }

  // ─── APS API: direct browser fetch ───────────────────────────────────────
  async function apsGet(path, params = {}) {
    const url = new URL(APS_BASE + path);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${getToken()}` }
    });

    if (res.status === 401) {
      logout();
      throw new Error('Session expired — please sign in again.');
    }
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`API ${res.status}: ${txt.slice(0, 200)}`);
    }
    return res.json();
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    if (isAuthenticated()) {
      await showApp();
    } else {
      showLogin();
    }
  }

  // ─── Screen management ────────────────────────────────────────────────────
  function showLoading(msg) {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
    const errEl = document.getElementById('login-error');
    errEl.textContent = msg || '';
    errEl.className   = msg ? 'login-loading' : 'login-error hidden';
  }

  function showLogin(errorMsg) {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('auth-area').classList.remove('hidden');
    document.getElementById('user-area').classList.add('hidden');
    const errEl = document.getElementById('login-error');
    if (errorMsg) {
      errEl.textContent = errorMsg;
      errEl.classList.remove('hidden');
    } else {
      errEl.classList.add('hidden');
    }
  }

  async function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('auth-area').classList.add('hidden');
    document.getElementById('user-area').classList.remove('hidden');
    await loadHubs();
  }

  // ─── Hub / Project / Folder loading ──────────────────────────────────────
  async function loadHubs() {
    const sel = document.getElementById('hub-select');
    sel.innerHTML = '<option value="">Loading…</option>';
    try {
      const json = await apsGet('/project/v1/hubs');
      const hubs = json.data || [];
      if (!hubs.length) {
        sel.innerHTML = '<option value="">No hubs found</option>';
        return;
      }
      sel.innerHTML = '<option value="">Select a hub…</option>' +
        hubs.map(h => `<option value="${h.id}">${esc(h.attributes?.name || h.id)}</option>`).join('');
    } catch (err) {
      sel.innerHTML = `<option value="">Error: ${esc(err.message)}</option>`;
    }
  }

  async function onHubChange(hubId) {
    state.selectedHubId     = hubId;
    state.selectedProjectId = null;
    state.selectedFolderId  = null;

    const projSel = document.getElementById('project-select');
    projSel.disabled = true;
    projSel.innerHTML = '<option value="">Loading…</option>';
    clearFolderTree();

    if (!hubId) { projSel.innerHTML = '<option value="">Select a hub first</option>'; return; }

    try {
      const json     = await apsGet(`/project/v1/hubs/${encodeURIComponent(hubId)}/projects`);
      const projects = json.data || [];
      if (!projects.length) {
        projSel.innerHTML = '<option value="">No projects found</option>';
        projSel.disabled  = false;
        return;
      }
      projSel.innerHTML = '<option value="">Select a project…</option>' +
        projects.map(p =>
          `<option value="${p.id}|${hubId}">${esc(p.attributes?.name || p.id)}</option>`
        ).join('');
      projSel.disabled = false;
    } catch (err) {
      projSel.innerHTML = `<option value="">Error: ${esc(err.message)}</option>`;
    }
  }

  async function onProjectChange(value) {
    if (!value) { clearFolderTree(); return; }
    const [projectId, hubId]    = value.split('|');
    state.selectedProjectId     = projectId;
    state.selectedHubId         = hubId;
    state.selectedFolderId      = null;
    updateScanButton();
    await loadTopFolders(hubId, projectId);
  }

  async function loadTopFolders(hubId, projectId) {
    const tree = document.getElementById('folder-tree');
    setFolderStatus('Loading…');
    tree.innerHTML = '<div class="tree-loading"><span class="spinner"></span>Loading folders…</div>';

    try {
      const json    = await apsGet(
        `/project/v1/hubs/${encodeURIComponent(hubId)}/projects/${encodeURIComponent(projectId)}/topFolders`
      );
      const folders = json.data || [];
      tree.innerHTML = '';

      if (!folders.length) {
        tree.innerHTML = '<p class="tree-hint">No folders found.</p>';
        setFolderStatus('');
        return;
      }
      folders.forEach(f => tree.appendChild(buildFolderNode(f, projectId)));
      setFolderStatus(`${folders.length} top-level folder${folders.length !== 1 ? 's' : ''}`);
    } catch (err) {
      tree.innerHTML = `<p class="tree-hint" style="color:var(--error-text)">Error: ${esc(err.message)}</p>`;
      setFolderStatus('');
    }
  }

  function buildFolderNode(folder, projectId) {
    const id   = folder.id;
    const name = folder.attributes?.displayName || folder.attributes?.name || 'Unnamed';

    const node = document.createElement('div');
    node.className        = 'tree-node';
    node.dataset.folderId = id;

    const row = document.createElement('div');
    row.className = 'tree-row';
    row.innerHTML = `
      <svg class="tree-chevron" viewBox="0 0 24 24"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
      <svg class="tree-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
      <span class="tree-name" title="${esc(name)}">${esc(name)}</span>
    `;

    const children = document.createElement('div');
    children.className = 'tree-children hidden';

    let loaded = false;
    let open   = false;

    row.addEventListener('click', async () => {
      selectFolder(id, name, row);
      open = !open;
      const chevron = row.querySelector('.tree-chevron');

      if (open) {
        chevron.classList.add('open');
        children.classList.remove('hidden');

        if (!loaded) {
          loaded = true;
          children.innerHTML = '<div class="tree-loading"><span class="spinner"></span>Loading…</div>';
          try {
            const json       = await apsGet(
              `/data/v1/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(id)}/contents`
            );
            const subFolders = (json.data || []).filter(i => i.type === 'folders');
            children.innerHTML = '';
            if (!subFolders.length) {
              children.innerHTML = '<div class="tree-loading" style="color:var(--text-dim)">No subfolders</div>';
            } else {
              subFolders.forEach(sf => children.appendChild(buildFolderNode(sf, projectId)));
            }
          } catch (err) {
            children.innerHTML = `<div class="tree-loading" style="color:var(--error-text)">${esc(err.message)}</div>`;
          }
        }
      } else {
        chevron.classList.remove('open');
        children.classList.add('hidden');
      }
    });

    node.appendChild(row);
    node.appendChild(children);
    return node;
  }

  function selectFolder(folderId, folderName, rowEl) {
    document.querySelectorAll('.tree-row.selected').forEach(r => r.classList.remove('selected'));
    rowEl.classList.add('selected');
    state.selectedFolderId   = folderId;
    state.selectedFolderName = folderName;
    updateScanButton();
  }

  function clearFolderTree() {
    document.getElementById('folder-tree').innerHTML =
      '<p class="tree-hint">Select a project to browse folders.</p>';
    setFolderStatus('');
    state.selectedFolderId   = null;
    state.selectedFolderName = '';
    updateScanButton();
  }

  function setFolderStatus(text) {
    document.getElementById('folder-status').textContent = text;
  }

  function updateScanButton() {
    document.getElementById('scan-btn').disabled = !state.selectedFolderId || state.scanning;
  }

  // ─── Scan ─────────────────────────────────────────────────────────────────
  async function startScan() {
    if (!state.selectedFolderId || !state.selectedProjectId || state.scanning) return;

    state.files        = [];
    state.scanning     = true;
    state.scanAborted  = false;
    state.expandedRows.clear();

    document.getElementById('scan-btn').classList.add('hidden');
    document.getElementById('stop-btn').classList.remove('hidden');
    document.getElementById('scan-progress').classList.remove('hidden');
    document.getElementById('export-btn').style.display = 'none';
    updateProgress('Starting scan…');

    document.getElementById('dashboard-empty').classList.add('hidden');
    document.getElementById('dashboard-content').classList.remove('hidden');
    resetDashboard();
    renderTable();

    try {
      await scanFolder(state.selectedProjectId, state.selectedFolderId, '');
    } catch (err) {
      if (!state.scanAborted) console.error('Scan error:', err);
    }

    state.scanning = false;
    finishScan();
  }

  async function scanFolder(projectId, folderId, folderPath) {
    if (state.scanAborted) return;

    let cursor = null;
    do {
      if (state.scanAborted) return;

      const params = { 'page[limit]': 50 };
      if (cursor) params['page[cursor]'] = cursor;

      let result;
      try {
        result = await apsGet(
          `/data/v1/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(folderId)}/contents`,
          params
        );
      } catch (err) {
        if (state.scanAborted) return;
        console.warn(`Skipping folder (error): ${err.message}`);
        return;
      }

      for (const item of (result.data || [])) {
        if (state.scanAborted) return;

        const displayName = item.attributes?.displayName || item.attributes?.name || '';
        const itemPath    = folderPath ? `${folderPath}/${displayName}` : displayName;

        if (item.type === 'folders') {
          updateProgress(`Scanning ${displayName}…`);
          await scanFolder(projectId, item.id, itemPath);
        } else if (item.type === 'items') {
          const naming = NAMING.checkFileName(displayName);
          state.files.push({
            id:           item.id,
            name:         displayName,
            path:         itemPath,
            ext:          displayName.includes('.') ? displayName.split('.').pop().toLowerCase() : '',
            modifiedTime: item.attributes?.lastModifiedTime || null,
            ...naming
          });
          scheduleUpdate();
        }
      }

      cursor = null;
      if (result.links?.next?.href) {
        try {
          const url = new URL(result.links.next.href);
          cursor = url.searchParams.get('page[cursor]');
        } catch { cursor = null; }
      }
    } while (cursor);
  }

  function stopScan() {
    state.scanAborted = true;
    state.scanning    = false;
    finishScan('Scan stopped.');
  }

  function finishScan(msg) {
    document.getElementById('scan-btn').classList.remove('hidden');
    document.getElementById('stop-btn').classList.add('hidden');
    document.getElementById('scan-progress').classList.add('hidden');
    document.getElementById('export-btn').style.display = 'flex';
    updateProgress(msg || `Done — ${state.files.length} files scanned`);
    updateScanButton();
    // Final render
    if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
    if (dashTimer)   { clearTimeout(dashTimer);   dashTimer   = null; }
    updateDashboard();
    renderTable();
  }

  function updateProgress(label) {
    document.getElementById('progress-label').textContent = label;
  }

  function scheduleUpdate() {
    if (!dashTimer) {
      dashTimer = setTimeout(() => {
        dashTimer = null;
        updateDashboard();
        updateProgress(`${state.files.length} files found…`);
      }, 200);
    }
    if (!renderTimer) {
      renderTimer = setTimeout(() => {
        renderTimer = null;
        renderTable();
      }, 300);
    }
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────
  function resetDashboard() {
    setVal('stat-total', 0);
    setVal('stat-compliant', 0);
    setVal('stat-noncompliant', 0);
    setVal('stat-issue-count', 0);
    document.getElementById('stat-compliant-pct').textContent   = '—';
    document.getElementById('stat-noncompliant-pct').textContent = '—';
    document.getElementById('ring-pct').textContent             = '0%';
    document.getElementById('ring-fill').style.strokeDasharray  = '0 314';
    document.getElementById('category-bars').innerHTML          = '';
    document.getElementById('issue-list').innerHTML             = '';
  }

  function updateDashboard() {
    const files      = state.files;
    const total      = files.length;
    const compliant  = files.filter(f => f.compliant).length;
    const issues     = files.reduce((s, f) => s + (f.issues?.length || 0), 0);
    const pct        = total > 0 ? Math.round((compliant / total) * 100) : 0;

    setVal('stat-total', total);
    setVal('stat-compliant', compliant);
    setVal('stat-noncompliant', total - compliant);
    setVal('stat-issue-count', issues);
    document.getElementById('stat-compliant-pct').textContent   = total ? `${pct}%` : '—';
    document.getElementById('stat-noncompliant-pct').textContent = total ? `${100 - pct}%` : '—';

    // Ring
    const circ    = 314;
    const fill    = document.getElementById('ring-fill');
    fill.style.strokeDasharray = `${(pct / 100) * circ} ${circ}`;
    fill.style.stroke = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--error)';
    document.getElementById('ring-pct').textContent = `${pct}%`;

    // Category bars
    const cats    = {};
    files.forEach(f => { cats[f.category] = (cats[f.category] || 0) + 1; });
    const sorted  = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const maxCat  = sorted[0]?.[1] || 1;
    const palette = {
      'Main Model': '#1565c0', 'Site Model': '#2ea043', '3D Asset Model': '#7b4ea6',
      'Revit Family': '#FFB600', 'Annotation Family': '#ff8c00', 'Document': '#8b949e', 'Unknown': '#484f58'
    };
    document.getElementById('category-bars').innerHTML = sorted.map(([cat, count]) => `
      <div class="bar-item">
        <span class="bar-label" title="${esc(cat)}">${esc(cat)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${Math.round((count / maxCat) * 100)}%;background:${palette[cat] || '#8b949e'}"></div>
        </div>
        <span class="bar-count">${count}</span>
      </div>`).join('');

    // Top issues
    const issueMap = {};
    files.forEach(f => (f.issues || []).forEach(i => {
      const key = i.split(' \'')[0].split(' —')[0].substring(0, 60);
      issueMap[key] = (issueMap[key] || 0) + 1;
    }));
    const topIssues = Object.entries(issueMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
    document.getElementById('issue-list').innerHTML = topIssues.length === 0
      ? '<p style="font-size:12px;color:var(--success-text)">✓ No common issues found</p>'
      : topIssues.map(([issue, count]) => `
          <div class="issue-item">
            <span class="issue-badge">${count}</span>
            <span class="issue-text">${esc(issue)}</span>
          </div>`).join('');
  }

  function setVal(id, val) {
    document.getElementById(id).textContent = Number(val).toLocaleString();
  }

  // ─── File table ───────────────────────────────────────────────────────────
  function getFilteredFiles() {
    let files = [...state.files];
    if (state.filter === 'compliant')       files = files.filter(f => f.compliant);
    else if (state.filter === 'noncompliant') files = files.filter(f => !f.compliant);
    else if (state.filter.startsWith('cat:')) {
      const cat = state.filter.slice(4);
      files = files.filter(f => f.category === cat);
    }
    if (state.search) {
      const q = state.search.toLowerCase();
      files = files.filter(f => f.name.toLowerCase().includes(q) || f.path?.toLowerCase().includes(q));
    }
    files.sort((a, b) => {
      let av = a[state.sortCol] ?? '', bv = b[state.sortCol] ?? '';
      if (typeof av === 'boolean') av = av ? 1 : 0;
      if (typeof bv === 'boolean') bv = bv ? 1 : 0;
      const c = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return state.sortDir === 'asc' ? c : -c;
    });
    return files;
  }

  function renderTable() {
    const files    = getFilteredFiles();
    const tbody    = document.getElementById('file-tbody');
    const table    = document.getElementById('file-table');
    const emptyEl  = document.getElementById('list-empty');
    const countLbl = document.getElementById('file-count-label');

    countLbl.textContent = state.files.length > 0
      ? `Showing ${files.length} of ${state.files.length} file${state.files.length !== 1 ? 's' : ''}`
      : '';

    if (!files.length) {
      table.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      emptyEl.innerHTML = state.files.length === 0 ? '<p>No files scanned yet.</p>' : '<p>No files match the current filter.</p>';
      return;
    }

    table.classList.remove('hidden');
    emptyEl.classList.add('hidden');
    tbody.innerHTML = '';

    files.forEach(file => {
      const tr = buildFileRow(file);
      tbody.appendChild(tr);
      if (state.expandedRows.has(file.id)) tbody.appendChild(buildExpandedRow(file));
    });
  }

  function buildFileRow(file) {
    const tr          = document.createElement('tr');
    const pathDisplay = file.path && file.path !== file.name
      ? file.path.substring(0, file.path.lastIndexOf('/')) : '';

    tr.innerHTML = `
      <td class="col-name">
        <div class="file-name-cell">
          <span class="file-name-text" title="${esc(file.name)}">${esc(file.name)}</span>
          ${pathDisplay ? `<span class="file-path-text" title="${esc(file.path)}">${esc(pathDisplay)}</span>` : ''}
        </div>
      </td>
      <td class="col-ext"><span class="ext-badge">${esc(file.ext || '—')}</span></td>
      <td class="col-cat"><span class="cat-badge ${catClass(file.category)}">${esc(file.category)}</span></td>
      <td class="col-status">
        ${file.compliant
          ? '<span class="status-badge status-ok"><svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>Compliant</span>'
          : `<span class="status-badge status-err"><svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>${file.issues?.length || 0} Issue${(file.issues?.length || 0) !== 1 ? 's' : ''}</span>`
        }
      </td>
      <td class="col-issues" style="text-align:center">
        <span class="issues-count ${file.issues?.length > 0 ? 'has-issues' : 'no-issues'}">${file.issues?.length || 0}</span>
      </td>`;

    tr.addEventListener('click', () => toggleRow(file, tr));
    return tr;
  }

  function buildExpandedRow(file) {
    const tr = document.createElement('tr');
    tr.className            = 'expanded-row';
    tr.dataset.expandedFor  = file.id;
    tr.innerHTML = `
      <td colspan="5">
        <div class="expanded-content">
          <div class="expanded-title">${file.compliant ? '✓ Naming Convention Compliant' : `Issues (${file.issues?.length || 0})`}</div>
          ${file.issues?.length
            ? file.issues.map(i => `<div class="issue-row">${esc(i)}</div>`).join('')
            : '<div class="issue-row" style="color:var(--success-text)">✓ All naming rules passed</div>'}
          <div class="pattern-note">Pattern: ${esc(file.pattern)}</div>
        </div>
      </td>`;
    return tr;
  }

  function toggleRow(file, tr) {
    if (state.expandedRows.has(file.id)) {
      state.expandedRows.delete(file.id);
      document.querySelector(`[data-expanded-for="${file.id}"]`)?.remove();
    } else {
      state.expandedRows.add(file.id);
      tr.insertAdjacentElement('afterend', buildExpandedRow(file));
    }
  }

  function catClass(cat) {
    const map = {
      'Main Model': 'cat-main-model', 'Site Model': 'cat-site-model',
      '3D Asset Model': 'cat-asset-model', 'Revit Family': 'cat-family',
      'Annotation Family': 'cat-annotation', 'Document': 'cat-document', 'Unknown': 'cat-unknown'
    };
    return map[cat] || 'cat-unknown';
  }

  // ─── Filter / Search / Sort ───────────────────────────────────────────────
  function setFilter(filter, chipEl) {
    state.filter = filter;
    state.expandedRows.clear();
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chipEl.classList.add('active');
    renderTable();
  }

  function onSearch(value) {
    state.search = value;
    state.expandedRows.clear();
    renderTable();
  }

  function sortBy(col) {
    state.sortDir = state.sortCol === col && state.sortDir === 'asc' ? 'desc' : 'asc';
    state.sortCol = col;
    document.querySelectorAll('.sort-icon').forEach(el => {
      el.classList.remove('asc', 'desc');
      if (el.dataset.col === col) el.classList.add(state.sortDir);
    });
    renderTable();
  }

  // ─── Export CSV ───────────────────────────────────────────────────────────
  function exportCSV() {
    const rows = [
      ['File Name', 'Path', 'Extension', 'Category', 'Pattern', 'Compliant', 'Issues'],
      ...getFilteredFiles().map(f => [
        f.name, f.path || '', f.ext || '', f.category, f.pattern,
        f.compliant ? 'Yes' : 'No', (f.issues || []).join('; ')
      ])
    ];
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `ATL-NamingCheck-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  return { init, login, logout, onHubChange, onProjectChange, startScan, stopScan, setFilter, onSearch, sortBy, exportCSV, closeModal };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
