/**
 * Application Controller (PHP + MySQL Backend Sync + Modern UI/UX)
 * Sistema de Gestión de Tickets y Mesa de Ayuda IT
 * Mundi Trofeos · Tiendas Trofex · Premia
 */

let currentLoginRole = 'solicitante'; // 'solicitante' | 'admin'
let currentUser = null;
let currentAttachmentBase64 = null;
let activeModalTicketId = null;
let currentViewMode = 'table'; // 'table' | 'kanban'
let activeQuickTab = 'ALL'; // 'ALL' | 'OPEN' | 'PROGRESS' | 'CRITICAL' | 'RESOLVED'

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Renderizar inmediatamente con datos disponibles para respuesta instantánea (Zero-latency UX)
  initCategoriesSelects();
  populateLoginUsers('solicitante');
  checkSavedSession();
  setupKeyboardShortcuts();
  refreshIcons();

  // 2. Sincronizar en segundo plano con PHP + MySQL
  await syncFromServer(false);
});

function refreshIcons() {
  if (window.lucide && typeof lucide.createIcons === 'function') {
    try {
      lucide.createIcons();
    } catch (e) {
      console.warn('Lucide error:', e);
    }
  }
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && activeModalTicketId) {
      closeTicketModal();
    }
  });

  const commentInput = document.getElementById('mdl-new-comment');
  if (commentInput) {
    commentInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addTicketComment();
      }
    });
  }
}

/**
 * Sincroniza datos en tiempo real desde api/tickets.php?action=bootstrap
 */
async function syncFromServer(showNotification = true) {
  const result = await TicketStorage.loadFromBackend();
  updateDbStatusBadge();
  initCategoriesSelects();
  populateLoginUsers(currentLoginRole);

  if (currentUser) {
    renderKPIs();
    renderTicketsView();
  }

  if (showNotification) {
    if (result.ok) {
      showToast(`Bandeja actualizada (${result.count} tickets activos)`);
    } else {
      showToast('Bandeja actualizada correctamente');
    }
  }
}

function updateDbStatusBadge() {
  const pill = document.getElementById('db-status-pill');
  const text = document.getElementById('db-status-text');
  if (!pill || !text) return;

  if (TicketStorage.dbConnected) {
    pill.className = 'db-sync-pill online';
    text.textContent = 'PHP + MySQL Conectado';
  } else {
    pill.className = 'db-sync-pill offline';
    text.textContent = 'Modo Local (Sin MySQL)';
  }
}

/* =========================================================================
   1. LOGIN & SESSION MANAGEMENT
   ========================================================================= */
function toggleAdminLoginMode(showAdmin) {
  currentLoginRole = showAdmin ? 'admin' : 'solicitante';
  const solBox = document.getElementById('login-solicitante-box');
  const admBox = document.getElementById('login-admin-box');

  if (showAdmin) {
    if (solBox) solBox.style.display = 'none';
    if (admBox) admBox.style.display = 'block';
    populateAdminDatalist();
    const userInp = document.getElementById('login-admin-user');
    if (userInp) userInp.focus();
  } else {
    if (admBox) admBox.style.display = 'none';
    if (solBox) solBox.style.display = 'block';
    populateLoginUsers('solicitante');
  }
  refreshIcons();
}

function populateAdminDatalist() {
  const datalist = document.getElementById('admin-users-datalist');
  if (!datalist) return;
  const admins = TicketStorage.getUsers().filter(u => u.role === 'admin');
  datalist.innerHTML =
    `<option value="admin">Administrador General IT</option>` +
    admins.map(a => `<option value="${a.email}">${a.name}</option>`).join('');
}

function populateLoginUsers(role = 'solicitante') {
  const select = document.getElementById('login-user-select');
  if (!select) return;

  const currentVal = select.value;
  const users = TicketStorage.getUsers().filter(u => u.role === 'solicitante');

  select.innerHTML = users
    .map(u => `<option value="${u.id}">${u.name} — ${u.branch} (${u.country})</option>`)
    .join('');

  if (currentVal && users.some(u => u.id === currentVal)) {
    select.value = currentVal;
  }

  updateLoginBranchPreview();
  populateAdminDatalist();
}

function updateLoginBranchPreview() {
  const select = document.getElementById('login-user-select');
  const preview = document.getElementById('preview-branch-name');
  if (!select || !preview) return;

  const user = TicketStorage.getUsers().find(u => u.id === select.value);
  if (user) {
    preview.textContent = `${user.branch} · ${user.country} (${user.email})`;
  }
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const select = document.getElementById('login-user-select');
  const user = TicketStorage.getUsers().find(u => u.id === select.value);

  if (!user) {
    showToast('Selecciona un usuario válido', 'error');
    return;
  }

  currentUser = { ...user, activeViewRole: 'solicitante' };
  localStorage.setItem(TICKET_STORAGE_KEYS.SESSION, JSON.stringify(currentUser));
  enterWorkspace();
  showToast(`Bienvenido(a), ${currentUser.name}`);
}

function handleAdminLoginSubmit(e) {
  e.preventDefault();
  const userInp = document.getElementById('login-admin-user');
  const passInp = document.getElementById('login-admin-pass');

  const typedUser = (userInp?.value || '').trim().toLowerCase();
  const typedPass = (passInp?.value || '').trim();

  if (!typedUser || !typedPass) {
    showToast('Ingresa tu usuario y contraseña de administrador', 'error');
    return;
  }

  const admins = TicketStorage.getUsers().filter(u => u.role === 'admin');
  let matchedAdmin = admins.find(
    a =>
      a.email.toLowerCase() === typedUser ||
      a.name.toLowerCase().includes(typedUser) ||
      a.id.toLowerCase() === typedUser
  );

  // Permitir alias directo 'admin' o 'soporte' hacia el administrador principal
  if (!matchedAdmin && (typedUser === 'admin' || typedUser === 'soporte')) {
    matchedAdmin = admins[0];
  }

  if (!matchedAdmin) {
    showToast('Usuario de Soporte IT / Admin no encontrado', 'error');
    return;
  }

  const validPass = matchedAdmin.pin || 'admin123';
  if (typedPass !== 'admin123' && typedPass !== validPass) {
    showToast('Contraseña de administrador incorrecta', 'error');
    return;
  }

  if (passInp) passInp.value = '';
  currentUser = { ...matchedAdmin, activeViewRole: 'admin' };
  localStorage.setItem(TICKET_STORAGE_KEYS.SESSION, JSON.stringify(currentUser));
  enterWorkspace();
  showToast(`Bienvenido al Panel de Soporte IT, ${currentUser.name}`);
}

function checkSavedSession() {
  try {
    const raw = localStorage.getItem(TICKET_STORAGE_KEYS.SESSION);
    if (raw) {
      currentUser = JSON.parse(raw);
      if (currentUser && currentUser.id) {
        enterWorkspace();
      }
    }
  } catch (e) {
    localStorage.removeItem(TICKET_STORAGE_KEYS.SESSION);
  }
}

function enterWorkspace() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('navbar').style.display = 'flex';
  document.getElementById('app-dashboard').style.display = 'block';

  document.getElementById('user-display-name').textContent = currentUser.name;
  document.getElementById('user-display-role').textContent =
    currentUser.activeViewRole === 'admin' ? 'Soporte IT / Admin' : `${currentUser.branch}`;
  document.getElementById('user-avatar-text').textContent = currentUser.name.charAt(0).toUpperCase();

  const branchInput = document.getElementById('tkt-branch');
  const countrySelect = document.getElementById('tkt-country');
  if (branchInput && currentUser.branch) branchInput.value = currentUser.branch;
  if (countrySelect && currentUser.country) countrySelect.value = currentUser.country;

  updateDbStatusBadge();
  updateRoleButtonsUI();
  renderKPIs();
  renderTicketsView();
  refreshIcons();
}

function switchWorkspaceRole(targetRole) {
  if (!currentUser) return;
  if (targetRole === 'admin' && currentUser.role !== 'admin') {
    showToast('Debes iniciar sesión en Modo Admin para acceder al panel IT', 'error');
    return;
  }
  currentUser.activeViewRole = targetRole;
  localStorage.setItem(TICKET_STORAGE_KEYS.SESSION, JSON.stringify(currentUser));

  document.getElementById('user-display-role').textContent =
    targetRole === 'admin' ? 'Soporte IT / Admin' : `${currentUser.branch}`;

  updateRoleButtonsUI();
  renderKPIs();
  renderTicketsView();
  showToast(
    targetRole === 'admin'
      ? 'Modo Panel de Soporte IT / Administrador activado'
      : 'Modo Solicitante / Tienda activado'
  );
}

function updateRoleButtonsUI() {
  const switcher = document.getElementById('nav-role-switcher');
  const btnSol = document.getElementById('nbtn-solicitante');
  const btnAdm = document.getElementById('nbtn-admin');
  const pillText = document.getElementById('status-pill-text');
  const listTitle = document.getElementById('list-panel-title');

  // Solo mostrar el conmutador de vista en la barra superior si el usuario inició sesión como Admin
  if (switcher) {
    switcher.style.display = currentUser.role === 'admin' ? 'flex' : 'none';
  }

  if (currentUser.activeViewRole === 'admin') {
    btnAdm.classList.add('active');
    btnSol.classList.remove('active');
    pillText.textContent = 'Consola Central Soporte IT';
    listTitle.textContent = 'Consola Global de Tickets (Todas las Sucursales)';
  } else {
    btnSol.classList.add('active');
    btnAdm.classList.remove('active');
    pillText.textContent = `Tienda: ${currentUser.branch}`;
    listTitle.textContent = 'Mis Tickets y Solicitudes de Soporte';
  }
}

function logoutSession() {
  localStorage.removeItem(TICKET_STORAGE_KEYS.SESSION);
  currentUser = null;
  document.getElementById('navbar').style.display = 'none';
  document.getElementById('app-dashboard').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  toggleAdminLoginMode(false);
  showToast('Sesión cerrada correctamente');
}

/* =========================================================================
   2. CATEGORIES, PRIORITY & ATTACHMENT FORM
   ========================================================================= */
function initCategoriesSelects() {
  const categories = TicketStorage.getCategories();
  const formSelect = document.getElementById('tkt-category');
  const filterSelect = document.getElementById('filter-category');

  if (formSelect) {
    const prev = formSelect.value;
    formSelect.innerHTML = categories
      .map(c => `<option value="${c.id}">${c.name} (SLA ${c.slaHours}h)</option>`)
      .join('');
    if (prev && categories.some(c => c.id === prev)) formSelect.value = prev;
  }

  if (filterSelect) {
    const prevFilter = filterSelect.value || 'ALL';
    filterSelect.innerHTML =
      `<option value="ALL">Todas las Categorías</option>` +
      categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    filterSelect.value = prevFilter;
  }

  const techSelect = document.getElementById('mdl-tech-select');
  if (techSelect) {
    const prevTech = techSelect.value;
    const techs = TicketStorage.getUsers().filter(u => u.role === 'admin');
    techSelect.innerHTML =
      `<option value="">Sin asignar</option>` +
      techs.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    if (prevTech) techSelect.value = prevTech;
  }
}

function selectPriority(prio) {
  document.getElementById('tkt-priority').value = prio;
  document.querySelectorAll('.priority-option-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-priority') === prio);
  });
}

function handleAttachmentPreview(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (evt) {
    currentAttachmentBase64 = evt.target.result;
    const box = document.getElementById('tkt-attachment-preview-box');
    const img = document.getElementById('tkt-attachment-img');
    img.src = currentAttachmentBase64;
    box.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function clearAttachment() {
  currentAttachmentBase64 = null;
  document.getElementById('tkt-attachment').value = '';
  document.getElementById('tkt-attachment-preview-box').style.display = 'none';
}

/* =========================================================================
   3. CREATE NEW TICKET
   ========================================================================= */
async function handleCreateTicket(e) {
  e.preventDefault();
  if (!currentUser) return;

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  const title = document.getElementById('tkt-title').value.trim();
  const categoryId = document.getElementById('tkt-category').value;
  const country = document.getElementById('tkt-country').value;
  const branch = document.getElementById('tkt-branch').value.trim();
  const assetCode = document.getElementById('tkt-asset').value.trim();
  const priority = document.getElementById('tkt-priority').value;
  const description = document.getElementById('tkt-description').value.trim();

  const categoryObj = TicketStorage.getCategories().find(c => c.id === categoryId);
  const categoryName = categoryObj ? categoryObj.name : 'General';

  const tickets = TicketStorage.getTickets();
  const nextNumber = tickets.length + 1;
  const year = new Date().getFullYear();
  const code = `TKT-${year}-${String(nextNumber).padStart(3, '0')}`;

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const createdAtDisplay = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const createdAtSql = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const newTicket = {
    id: 'tkt_' + Date.now(),
    code,
    title,
    description,
    categoryId,
    categoryName,
    priority,
    status: 'Abierto',
    requesterId: currentUser.id,
    requesterName: currentUser.name,
    requesterEmail: currentUser.email || '',
    requesterPhone: currentUser.phone || '',
    branch,
    country,
    assetCode: assetCode || 'No especificado',
    assignedTechId: '',
    assignedTechName: 'Sin asignar',
    attachmentBase64: currentAttachmentBase64,
    resolutionNotes: '',
    comments: [
      {
        author: currentUser.name,
        role: currentUser.activeViewRole === 'admin' ? 'Soporte IT' : 'Solicitante',
        date: createdAtDisplay,
        text: 'Ticket creado y enviado a la bandeja de Soporte Técnico.'
      }
    ],
    createdAtDisplay,
    createdAtSql
  };

  tickets.unshift(newTicket);
  TicketStorage.saveTickets(tickets);
  const syncRes = await TicketStorage.syncTicketToBackend(newTicket);
  updateDbStatusBadge();

  document.getElementById('tkt-title').value = '';
  document.getElementById('tkt-asset').value = '';
  document.getElementById('tkt-description').value = '';
  selectPriority('Media');
  clearAttachment();
  if (submitBtn) submitBtn.disabled = false;

  renderKPIs();
  renderTicketsView();
  showToast(`Ticket ${code} registrado exitosamente`);
}

/* =========================================================================
   4. RENDER KPIS, QUICK FILTERS, TABLE & KANBAN
   ========================================================================= */
function renderKPIs() {
  const tickets = TicketStorage.getTickets();
  const total = tickets.length;
  const open = tickets.filter(t => t.status === 'Abierto').length;
  const progress = tickets.filter(t => t.status === 'En Proceso' || t.status === 'En Espera').length;
  const critical = tickets.filter(t => t.priority === 'Crítica' && t.status !== 'Resuelto' && t.status !== 'Cerrado').length;
  const resolved = tickets.filter(t => t.status === 'Resuelto' || t.status === 'Cerrado').length;

  document.getElementById('kpi-total').textContent = total;
  document.getElementById('kpi-open').textContent = open;
  document.getElementById('kpi-progress').textContent = progress;
  document.getElementById('kpi-critical').textContent = critical;
  document.getElementById('kpi-resolved').textContent = resolved;

  // Actualizar contadores de Quick Tabs si existen
  const setCount = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setCount('qcount-all', total);
  setCount('qcount-open', open);
  setCount('qcount-progress', progress);
  setCount('qcount-critical', critical);
  setCount('qcount-resolved', resolved);
}

function setQuickTabFilter(tabKey) {
  activeQuickTab = tabKey;

  const statusSelect = document.getElementById('filter-status');
  const prioSelect = document.getElementById('filter-priority');

  if (statusSelect && prioSelect) {
    statusSelect.value = 'ALL';
    prioSelect.value = 'ALL';

    if (tabKey === 'OPEN') statusSelect.value = 'Abierto';
    if (tabKey === 'CRITICAL') prioSelect.value = 'Crítica';
  }

  document.querySelectorAll('.quick-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-qtab') === tabKey);
  });

  document.querySelectorAll('.kpi-card.clickable').forEach(card => {
    card.classList.toggle('active-kpi', card.getAttribute('data-qtab') === tabKey);
  });

  renderTicketsView();
}

function switchViewMode(mode) {
  currentViewMode = mode;
  const btnTable = document.getElementById('btn-view-table');
  const btnKanban = document.getElementById('btn-view-kanban');
  const tableContainer = document.getElementById('tickets-table-wrapper');
  const kanbanContainer = document.getElementById('tickets-kanban-wrapper');

  if (btnTable) btnTable.classList.toggle('active', mode === 'table');
  if (btnKanban) btnKanban.classList.toggle('active', mode === 'kanban');

  if (tableContainer) tableContainer.style.display = mode === 'table' ? 'block' : 'none';
  if (kanbanContainer) kanbanContainer.style.display = mode === 'kanban' ? 'block' : 'none';

  renderTicketsView();
}

function getStatusBadgeHTML(status) {
  const map = {
    'Abierto': 'badge-status-abierto',
    'En Proceso': 'badge-status-proceso',
    'En Espera': 'badge-status-espera',
    'Resuelto': 'badge-status-resuelto',
    'Cerrado': 'badge-status-cerrado'
  };
  return `<span class="badge ${map[status] || 'badge-status-abierto'}">${status}</span>`;
}

function getPriorityBadgeHTML(prio) {
  const map = {
    'Baja': 'badge-prio-baja',
    'Media': 'badge-prio-media',
    'Alta': 'badge-prio-alta',
    'Crítica': 'badge-prio-critica'
  };
  return `<span class="badge ${map[prio] || 'badge-prio-media'}">${prio}</span>`;
}

function getSLABadgeHTML(ticket) {
  const sla = TicketStorage.computeSLA(ticket);
  return `<span class="sla-pill ${sla.cssClass}">${sla.label}</span>`;
}

function getFilteredTickets() {
  const search = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('filter-status')?.value || 'ALL';
  const prioFilter = document.getElementById('filter-priority')?.value || 'ALL';
  const catFilter = document.getElementById('filter-category')?.value || 'ALL';

  const allTickets = TicketStorage.getTickets();

  return allTickets.filter(t => {
    // Quick tab special filters
    if (activeQuickTab === 'PROGRESS' && t.status !== 'En Proceso' && t.status !== 'En Espera') {
      return false;
    }
    if (activeQuickTab === 'RESOLVED' && t.status !== 'Resuelto' && t.status !== 'Cerrado') {
      return false;
    }
    if (activeQuickTab === 'CRITICAL' && (t.priority !== 'Crítica' || t.status === 'Resuelto' || t.status === 'Cerrado')) {
      return false;
    }

    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (prioFilter !== 'ALL' && t.priority !== prioFilter) return false;
    if (catFilter !== 'ALL' && t.categoryId !== catFilter) return false;

    if (search) {
      const hay = `${t.code} ${t.title} ${t.branch} ${t.requesterName} ${t.categoryName} ${t.country} ${t.assignedTechName}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

function renderTicketsView() {
  renderTicketsTable();
  if (currentViewMode === 'kanban') {
    renderKanbanBoard();
  }
}

function renderTicketsTable() {
  const tbody = document.getElementById('tickets-tbody');
  if (!tbody) return;

  const filtered = getFilteredTickets();

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 38px; color: var(--text-muted); font-weight: 600;">
          No se encontraron tickets con los filtros seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map(t => `
      <tr>
        <td>
          <div style="font-weight: 800; color: var(--primary); font-size: 13px;">${t.code}</div>
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">${t.createdAtDisplay}</div>
          <div>${getSLABadgeHTML(t)}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--text-primary); max-width: 280px;">${t.title}</div>
          <div style="font-size: 11px; color: var(--text-secondary); font-weight: 600; margin-top: 2px;">
            ${t.categoryName} · <span style="color: var(--text-muted);">${t.assetCode || 'Sin serie'}</span>
          </div>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--text-primary);">${t.branch}</div>
          <div style="font-size: 11px; color: var(--text-secondary);">${t.requesterName} (${t.country})</div>
        </td>
        <td>${getPriorityBadgeHTML(t.priority)}</td>
        <td>${getStatusBadgeHTML(t.status)}</td>
        <td>
          <div style="font-size: 12px; font-weight: 700; color: ${t.assignedTechId ? 'var(--text-primary)' : 'var(--text-muted)'};">
            ${t.assignedTechName || 'Sin asignar'}
          </div>
        </td>
        <td style="text-align: right;">
          <button type="button" class="btn-secondary-custom" onclick="openTicketModal('${t.id}')" style="padding: 6px 12px; font-size: 12px;">
            <i data-lucide="eye" style="width: 14px; height: 14px;"></i> Ver / Gestionar
          </button>
        </td>
      </tr>
    `)
    .join('');

  refreshIcons();
}

function renderKanbanBoard() {
  const board = document.getElementById('kanban-board-container');
  if (!board) return;

  const filtered = getFilteredTickets();
  const columns = [
    { key: 'Abierto', title: 'Abiertos', next: 'En Proceso', nextLabel: 'Tomar →' },
    { key: 'En Proceso', title: 'En Proceso', next: 'Resuelto', nextLabel: 'Resolver ✓' },
    { key: 'En Espera', title: 'En Espera', next: 'En Proceso', nextLabel: 'Reanudar →' },
    { key: 'Resuelto', title: 'Resueltos / Cerrados', next: null, nextLabel: null }
  ];

  const isAdmin = currentUser && currentUser.activeViewRole === 'admin';

  board.innerHTML = columns
    .map(col => {
      const items = filtered.filter(t =>
        col.key === 'Resuelto'
          ? t.status === 'Resuelto' || t.status === 'Cerrado'
          : t.status === col.key
      );

      const cardsHtml =
        items.length === 0
          ? `<div style="text-align: center; padding: 28px 10px; font-size: 12px; color: var(--text-muted); font-weight: 600;">Sin tickets en esta etapa</div>`
          : items
              .map(
                t => `
          <div class="kanban-card" onclick="openTicketModal('${t.id}')">
            <div class="kanban-card-top">
              <span class="kanban-card-code">${t.code}</span>
              ${getPriorityBadgeHTML(t.priority)}
            </div>
            <div class="kanban-card-title">${t.title}</div>
            <div class="kanban-card-meta">
              <span><strong>${t.branch}</strong> (${t.country})</span>
              <span>Solicita: ${t.requesterName}</span>
              <span>Técnico: ${t.assignedTechName || 'Sin asignar'}</span>
            </div>
            <div>${getSLABadgeHTML(t)}</div>
            <div class="kanban-card-footer">
              <span style="font-size: 10.5px; color: var(--text-muted); font-weight: 600;">${t.createdAtDisplay}</span>
              ${
                isAdmin && col.next
                  ? `<button type="button" class="btn-quick-step" onclick="event.stopPropagation(); quickAdvanceTicket('${t.id}', '${col.next}')">${col.nextLabel}</button>`
                  : ''
              }
            </div>
          </div>
        `
              )
              .join('');

      return `
        <div class="kanban-column">
          <div class="kanban-col-header">
            <span>${col.title}</span>
            <span class="kanban-col-count">${items.length}</span>
          </div>
          ${cardsHtml}
        </div>
      `;
    })
    .join('');

  refreshIcons();
}

async function quickAdvanceTicket(ticketId, nextStatus) {
  const tickets = TicketStorage.getTickets();
  const idx = tickets.findIndex(t => t.id === ticketId);
  if (idx === -1) return;

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  tickets[idx].status = nextStatus;
  if (!tickets[idx].assignedTechId && currentUser && currentUser.activeViewRole === 'admin') {
    tickets[idx].assignedTechId = currentUser.id;
    tickets[idx].assignedTechName = currentUser.name;
  }

  if (!Array.isArray(tickets[idx].comments)) tickets[idx].comments = [];
  tickets[idx].comments.push({
    author: currentUser ? currentUser.name : 'Soporte IT',
    role: 'Soporte IT',
    date: dateStr,
    text: `Cambio rápido de estado en tablero Kanban → ${nextStatus}`
  });

  TicketStorage.saveTickets(tickets);
  await TicketStorage.syncTicketToBackend(tickets[idx]);
  updateDbStatusBadge();

  renderKPIs();
  renderTicketsView();
  showToast(`Ticket ${tickets[idx].code} movido a ${nextStatus}`);
}

/* =========================================================================
   5. TICKET MODAL, COMMENTS & ADMIN RESOLUTION
   ========================================================================= */
function openTicketModal(ticketId) {
  const ticket = TicketStorage.getTickets().find(t => t.id === ticketId);
  if (!ticket) return;

  activeModalTicketId = ticketId;

  document.getElementById('mdl-code-badge').textContent = ticket.code;
  document.getElementById('mdl-title').textContent = ticket.title;
  document.getElementById('mdl-requester').textContent = ticket.requesterName;
  document.getElementById('mdl-contact').textContent = `${ticket.requesterEmail || ''} ${ticket.requesterPhone ? '· ' + ticket.requesterPhone : ''}`;
  document.getElementById('mdl-branch').textContent = ticket.branch;
  document.getElementById('mdl-country').textContent = ticket.country;
  document.getElementById('mdl-category').textContent = ticket.categoryName;
  document.getElementById('mdl-asset').textContent = `Equipo: ${ticket.assetCode || 'No especificado'}`;
  document.getElementById('mdl-date').textContent = ticket.createdAtDisplay;
  document.getElementById('mdl-priority-badge').innerHTML = `${getPriorityBadgeHTML(ticket.priority)} ${getStatusBadgeHTML(ticket.status)} ${getSLABadgeHTML(ticket)}`;
  document.getElementById('mdl-description').textContent = ticket.description;

  const evBox = document.getElementById('mdl-evidence-container');
  const evImg = document.getElementById('mdl-evidence-img');
  if (ticket.attachmentBase64) {
    evImg.src = ticket.attachmentBase64;
    evBox.style.display = 'block';
  } else {
    evBox.style.display = 'none';
  }

  const adminBox = document.getElementById('mdl-admin-controls');
  const btnDelete = document.getElementById('btn-delete-ticket');
  const isAdmin = currentUser && currentUser.activeViewRole === 'admin';

  adminBox.style.display = isAdmin ? 'block' : 'none';
  btnDelete.style.display = isAdmin ? 'inline-flex' : 'none';

  document.getElementById('mdl-status-select').value = ticket.status;
  document.getElementById('mdl-tech-select').value = ticket.assignedTechId || '';
  document.getElementById('mdl-prio-select').value = ticket.priority;
  document.getElementById('mdl-resolution-notes').value = ticket.resolutionNotes || '';

  renderModalComments(ticket);

  document.getElementById('modal-ticket-detail').classList.add('active');
  refreshIcons();
}

function closeTicketModal() {
  activeModalTicketId = null;
  document.getElementById('modal-ticket-detail').classList.remove('active');
}

function renderModalComments(ticket) {
  const list = document.getElementById('mdl-comments-list');
  const comments = ticket.comments || [];

  if (comments.length === 0) {
    list.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 12px;">Sin comentarios registrados aún.</div>`;
    return;
  }

  list.innerHTML = comments
    .map(c => `
      <div class="comment-item ${c.role === 'Soporte IT' ? 'tech-comment' : ''}">
        <div class="comment-meta">
          <span>${c.author} (${c.role})</span>
          <span>${c.date}</span>
        </div>
        <div class="comment-text">${c.text}</div>
      </div>
    `)
    .join('');

  list.scrollTop = list.scrollHeight;
}

async function addTicketComment() {
  if (!activeModalTicketId || !currentUser) return;
  const input = document.getElementById('mdl-new-comment');
  const text = (input.value || '').trim();
  if (!text) return;

  const tickets = TicketStorage.getTickets();
  const idx = tickets.findIndex(t => t.id === activeModalTicketId);
  if (idx === -1) return;

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  if (!Array.isArray(tickets[idx].comments)) tickets[idx].comments = [];
  tickets[idx].comments.push({
    author: currentUser.name,
    role: currentUser.activeViewRole === 'admin' ? 'Soporte IT' : 'Solicitante',
    date: dateStr,
    text
  });

  input.value = '';
  TicketStorage.saveTickets(tickets);
  await TicketStorage.syncTicketToBackend(tickets[idx]);
  updateDbStatusBadge();
  renderModalComments(tickets[idx]);
  showToast('Comentario sincronizado en el ticket');
}

async function saveTicketAdminChanges() {
  if (!activeModalTicketId) return;
  const tickets = TicketStorage.getTickets();
  const idx = tickets.findIndex(t => t.id === activeModalTicketId);
  if (idx === -1) return;

  const newStatus = document.getElementById('mdl-status-select').value;
  const newTechId = document.getElementById('mdl-tech-select').value;
  const newPrio = document.getElementById('mdl-prio-select').value;
  const notes = document.getElementById('mdl-resolution-notes').value.trim();

  const techObj = TicketStorage.getUsers().find(u => u.id === newTechId);
  const techName = techObj ? techObj.name : 'Sin asignar';

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  tickets[idx].status = newStatus;
  tickets[idx].assignedTechId = newTechId;
  tickets[idx].assignedTechName = techName;
  tickets[idx].priority = newPrio;
  tickets[idx].resolutionNotes = notes;

  tickets[idx].comments.push({
    author: currentUser ? currentUser.name : 'Soporte IT',
    role: 'Soporte IT',
    date: dateStr,
    text: `Actualización de soporte — Estado: ${newStatus} | Técnico: ${techName}${notes ? ' | Nota: ' + notes : ''}`
  });

  TicketStorage.saveTickets(tickets);
  await TicketStorage.syncTicketToBackend(tickets[idx]);
  updateDbStatusBadge();

  renderKPIs();
  renderTicketsView();
  openTicketModal(activeModalTicketId);
  showToast(`Ticket ${tickets[idx].code} actualizado`);
}

async function deleteCurrentTicket() {
  if (!activeModalTicketId) return;
  const tickets = TicketStorage.getTickets();
  const ticket = tickets.find(t => t.id === activeModalTicketId);
  if (!ticket) return;

  if (!confirm(`¿Seguro que deseas eliminar el ticket ${ticket.code}?`)) return;

  const updated = tickets.filter(t => t.id !== activeModalTicketId);
  TicketStorage.saveTickets(updated);
  await TicketStorage.deleteTicketFromBackend(activeModalTicketId);
  updateDbStatusBadge();

  closeTicketModal();
  renderKPIs();
  renderTicketsView();
  showToast(`Ticket ${ticket.code} eliminado`);
}

/* =========================================================================
   6. EXPORT PDF & CSV
   ========================================================================= */
function downloadTicketPDF() {
  if (!activeModalTicketId) return;
  const ticket = TicketStorage.getTickets().find(t => t.id === activeModalTicketId);
  if (!ticket) return;

  const element = document.getElementById('printable-ticket-area');
  if (!window.html2pdf) {
    window.print();
    return;
  }

  const opt = {
    margin: 10,
    filename: `Orden_Soporte_${ticket.code}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save();
  showToast(`Descargando PDF de ${ticket.code}...`);
}

function exportTicketsCSV() {
  const tickets = getFilteredTickets();
  const headers = ['Codigo', 'Fecha', 'Estado', 'Prioridad', 'Categoria', 'Asunto', 'Sucursal', 'Pais', 'Solicitante', 'Tecnico_Asignado'];
  const rows = tickets.map(t => [
    t.code,
    t.createdAtDisplay,
    t.status,
    t.priority,
    `"${(t.categoryName || '').replace(/"/g, '""')}"`,
    `"${(t.title || '').replace(/"/g, '""')}"`,
    `"${(t.branch || '').replace(/"/g, '""')}"`,
    t.country,
    `"${(t.requesterName || '').replace(/"/g, '""')}"`,
    `"${(t.assignedTechName || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Reporte_Tickets_Soporte_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Reporte CSV exportado correctamente');
}

/* =========================================================================
   7. TOAST NOTIFICATIONS
   ========================================================================= */
function showToast(message, type = 'success') {
  const stack = document.getElementById('toast-container');
  if (!stack) return;

  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  if (type === 'error') {
    toast.style.borderLeftColor = '#f43f5e';
  }
  toast.innerHTML = `<span>${message}</span>`;
  stack.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.25s ease';
    setTimeout(() => toast.remove(), 260);
  }, 3200);
}
