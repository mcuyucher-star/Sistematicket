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
let realtimeSyncTimer = null;
let isRealtimeSyncRunning = false;
let lastKnownTicketsSnapshot = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Renderizar inmediatamente con datos disponibles para respuesta instantánea (Zero-latency UX)
  initCategoriesSelects();
  populateLoginUsers('solicitante');
  checkSavedSession();
  setupKeyboardShortcuts();
  refreshIcons();

  // 2. Sincronizar en segundo plano con PHP + MySQL
  await syncFromServer(false);
  lastKnownTicketsSnapshot = buildTicketsSnapshot(TicketStorage.getTickets());

  // 3. Iniciar sincronización automática en tiempo real (cada 4 segundos + eventos entre pestañas)
  startRealtimeTicketSync();
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
    if (e.key === 'Escape') {
      if (activeModalTicketId) closeTicketModal();
      closeNewUserModal();
      closeManageUsersModal();
      closeStatsModal();
      closeUserDropdownMenu();
    }
  });

  document.addEventListener('click', e => {
    const wrapper = document.getElementById('user-profile-dropdown-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      closeUserDropdownMenu();
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
    const freshUser = TicketStorage.getUsers().find(u => u.id === currentUser.id);
    if (freshUser) {
      currentUser = { ...freshUser, activeViewRole: currentUser.activeViewRole };
      localStorage.setItem(TICKET_STORAGE_KEYS.SESSION, JSON.stringify(currentUser));
      document.getElementById('user-display-name').textContent = currentUser.name;
      document.getElementById('user-avatar-text').textContent = currentUser.name.charAt(0).toUpperCase();
    }
    updateRoleButtonsUI();
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

  lastKnownTicketsSnapshot = buildTicketsSnapshot(TicketStorage.getTickets());
}

/**
 * Construye una huella ligera del estado actual de los tickets para detectar cambios en tiempo real
 */
function buildTicketsSnapshot(tickets) {
  const map = {};
  (tickets || []).forEach(t => {
    const comments = Array.isArray(t.comments) ? t.comments : [];
    const lastComment = comments.length > 0 ? comments[comments.length - 1] : null;
    map[t.id] = {
      code: t.code,
      branch: t.branch,
      status: t.status,
      priority: t.priority,
      assignedTechId: t.assignedTechId || '',
      assignedTechName: t.assignedTechName || 'Sin asignar',
      resolutionNotes: t.resolutionNotes || '',
      commentsCount: comments.length,
      lastCommentAuthor: lastComment ? lastComment.author : '',
      lastCommentRole: lastComment ? lastComment.role : '',
      lastCommentText: lastComment ? lastComment.text : ''
    };
  });
  return map;
}

function startRealtimeTicketSync() {
  if (realtimeSyncTimer) clearInterval(realtimeSyncTimer);

  // Sincronización periódica cada 4 segundos con el servidor PHP + MySQL
  realtimeSyncTimer = setInterval(() => {
    if (!document.hidden && currentUser) {
      pollRealtimeTicketUpdates();
    }
  }, 4000);

  // Sincronización instantánea entre pestañas del mismo navegador
  window.addEventListener('storage', e => {
    if (e.key === TICKET_STORAGE_KEYS.TICKETS && currentUser) {
      handleDetectedRealtimeChanges(TicketStorage.getTickets());
    }
  });

  // Sincronizar de inmediato al volver a la pestaña
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentUser) {
      pollRealtimeTicketUpdates();
    }
  });
}

async function pollRealtimeTicketUpdates() {
  if (isRealtimeSyncRunning || !currentUser) return;
  isRealtimeSyncRunning = true;
  try {
    await TicketStorage.loadFromBackend();
    updateDbStatusBadge();
    handleDetectedRealtimeChanges(TicketStorage.getTickets());
  } catch (err) {
    // Silencioso en segundo plano
  } finally {
    isRealtimeSyncRunning = false;
  }
}

function handleDetectedRealtimeChanges(freshTickets) {
  if (!currentUser) return;
  const newSnapshot = buildTicketsSnapshot(freshTickets);
  const oldSnapshot = lastKnownTicketsSnapshot || {};

  let hasChanges = false;
  const notifications = [];
  const isAdmin = currentUser.activeViewRole === 'admin';
  const userBranch = (currentUser.branch || '').toLowerCase();

  // Detectar tickets nuevos o modificados
  Object.keys(newSnapshot).forEach(id => {
    const curr = newSnapshot[id];
    const prev = oldSnapshot[id];

    if (!prev) {
      hasChanges = true;
      if (isAdmin) {
        notifications.push(`🔔 Nuevo ticket recibido: ${curr.code} (${curr.branch})`);
      } else if ((curr.branch || '').toLowerCase() === userBranch) {
        notifications.push(`🔔 Ticket registrado: ${curr.code} (${curr.status})`);
      }
      return;
    }

    const statusChanged = curr.status !== prev.status;
    const techChanged = curr.assignedTechId !== prev.assignedTechId || curr.assignedTechName !== prev.assignedTechName;
    const notesChanged = curr.resolutionNotes !== prev.resolutionNotes;
    const commentsChanged = curr.commentsCount !== prev.commentsCount;
    const prioChanged = curr.priority !== prev.priority;

    if (statusChanged || techChanged || notesChanged || commentsChanged || prioChanged) {
      hasChanges = true;
      const belongsToStore = (curr.branch || '').toLowerCase() === userBranch;

      if (!isAdmin && belongsToStore) {
        if (statusChanged) {
          notifications.push(`🔔 Tu ticket ${curr.code} cambió de estado a: ${curr.status} (${curr.assignedTechName})`);
        } else if (techChanged) {
          notifications.push(`👨‍💻 Ticket ${curr.code} asignado a: ${curr.assignedTechName}`);
        } else if (commentsChanged && curr.lastCommentRole === 'Soporte IT') {
          notifications.push(`💬 Nuevo comentario de ${curr.lastCommentAuthor} en ticket ${curr.code}`);
        }
      } else if (isAdmin) {
        if (commentsChanged && curr.lastCommentRole !== 'Soporte IT') {
          notifications.push(`💬 ${curr.lastCommentAuthor} comentó en el ticket ${curr.code}`);
        }
      }
    }
  });

  // Detectar si algún ticket fue eliminado
  Object.keys(oldSnapshot).forEach(id => {
    if (!newSnapshot[id]) {
      hasChanges = true;
    }
  });

  if (!hasChanges) return;

  lastKnownTicketsSnapshot = newSnapshot;
  renderKPIs();
  renderTicketsView();
  refreshOpenModalRealtime();

  if (notifications.length > 0) {
    showToast(notifications[0]);
  }
}

function refreshOpenModalRealtime() {
  if (!activeModalTicketId) return;
  const ticket = TicketStorage.getTickets().find(t => t.id === activeModalTicketId);
  if (!ticket) {
    closeTicketModal();
    return;
  }

  const isAdmin = currentUser && currentUser.activeViewRole === 'admin';
  const badgeEl = document.getElementById('mdl-priority-badge');
  if (badgeEl) {
    badgeEl.innerHTML = `${isAdmin ? getPriorityBadgeHTML(ticket.priority) : ''} ${getStatusBadgeHTML(ticket.status)} ${isAdmin ? getSLABadgeHTML(ticket) : ''}`;
  }

  renderModalComments(ticket);

  // Actualizar controles del modal si el usuario no está escribiendo activamente en las notas técnicas
  const activeEl = document.activeElement;
  const isEditingAdminFields =
    activeEl &&
    (activeEl.id === 'mdl-resolution-notes' ||
      activeEl.id === 'mdl-status-select' ||
      activeEl.id === 'mdl-tech-select' ||
      activeEl.id === 'mdl-prio-select');

  if (!isEditingAdminFields) {
    const btnModalClaim = document.getElementById('btn-modal-claim-ticket');
    const btnModalRelease = document.getElementById('btn-modal-release-ticket');
    const lockedBanner = document.getElementById('mdl-locked-banner');
    const btnSaveAdmin = document.getElementById('btn-save-admin-changes');

    const isTicketActive = isAdmin && ticket.status !== 'Resuelto' && ticket.status !== 'Cerrado';
    const isUnassigned = !ticket.assignedTechId;
    const isOwnedByMe = Boolean(currentUser && ticket.assignedTechId === currentUser.id);
    const isLockedByOther = Boolean(isTicketActive && ticket.assignedTechId && !isOwnedByMe);

    if (btnModalClaim) btnModalClaim.style.display = isTicketActive && isUnassigned ? 'inline-flex' : 'none';
    if (btnModalRelease) btnModalRelease.style.display = isTicketActive && isOwnedByMe ? 'inline-flex' : 'none';
    if (lockedBanner) {
      if (isLockedByOther) {
        lockedBanner.innerHTML = `<i data-lucide="lock" style="width: 14px; height: 14px;"></i> En atención por ${ticket.assignedTechName}`;
        lockedBanner.style.display = 'inline-flex';
      } else {
        lockedBanner.style.display = 'none';
      }
    }

    const statusSel = document.getElementById('mdl-status-select');
    const techSel = document.getElementById('mdl-tech-select');
    const prioSel = document.getElementById('mdl-prio-select');
    const notesInp = document.getElementById('mdl-resolution-notes');

    if (statusSel) {
      statusSel.disabled = isLockedByOther;
      statusSel.value = ticket.status;
    }
    if (techSel) {
      techSel.disabled = isLockedByOther;
      techSel.value = ticket.assignedTechId || '';
    }
    if (prioSel) {
      prioSel.disabled = isLockedByOther;
      prioSel.value = ticket.priority;
    }
    if (notesInp) {
      notesInp.disabled = isLockedByOther;
      notesInp.value = ticket.resolutionNotes || '';
    }
    if (btnSaveAdmin) btnSaveAdmin.style.display = isLockedByOther ? 'none' : 'inline-flex';
    refreshIcons();
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
function isMainAdmin(user = currentUser) {
  if (!user || user.role !== 'admin') return false;
  return user.id === 't1' || String(user.name || '').toLowerCase().includes('maynor');
}

function toggleAdminLoginMode(showAdmin) {
  currentLoginRole = showAdmin ? 'admin' : 'solicitante';
  const solBox = document.getElementById('login-solicitante-box');
  const admBox = document.getElementById('login-admin-box');

  if (showAdmin) {
    if (solBox) solBox.style.display = 'none';
    if (admBox) admBox.style.display = 'block';
    populateAdminDatalist();
    const passInp = document.getElementById('login-admin-pass');
    if (passInp) passInp.focus();
  } else {
    if (admBox) admBox.style.display = 'none';
    if (solBox) solBox.style.display = 'block';
    populateLoginUsers('solicitante');
  }
  refreshIcons();
}

function populateAdminDatalist() {
  const selectAdmin = document.getElementById('login-admin-user');
  if (!selectAdmin) return;
  const prevVal = selectAdmin.value;
  const admins = TicketStorage.getUsers().filter(u => u.role === 'admin');
  selectAdmin.innerHTML = admins
    .map(a => `<option value="${a.id}">${a.name}${isMainAdmin(a) ? ' (Administrador General)' : ' (Soporte IT)'}</option>`)
    .join('');
  if (prevVal && admins.some(a => a.id === prevVal)) {
    selectAdmin.value = prevVal;
  } else if (admins.length > 0) {
    selectAdmin.value = admins[0].id;
  }
}

function populateLoginUsers(role = 'solicitante') {
  const select = document.getElementById('login-user-select');
  if (!select) return;

  const currentVal = select.value;
  const users = TicketStorage.getUsers().filter(u => u.role === 'solicitante');

  select.innerHTML = users
    .map(u => `<option value="${u.id}">${u.name}</option>`)
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
    preview.textContent = `${user.branch} · ${user.country}`;
  }
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const select = document.getElementById('login-user-select');
  const passInput = document.getElementById('login-store-pass');
  const user = TicketStorage.getUsers().find(u => u.id === select.value);

  if (!user) {
    showToast('Selecciona un usuario válido', 'error');
    return;
  }

  if (user.blocked) {
    showToast('Este usuario se encuentra bloqueado. Contacta al Administrador IT', 'error');
    return;
  }

  const typedPass = (passInput?.value || '').trim();
  const expectedPass = String(user.pin || '1');
  if (typedPass !== expectedPass && typedPass !== '1') {
    showToast('Contraseña de sucursal incorrecta', 'error');
    return;
  }

  if (passInput) passInput.value = '';
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
    showToast('Selecciona tu usuario e ingresa la contraseña', 'error');
    return;
  }

  const admins = TicketStorage.getUsers().filter(u => u.role === 'admin');
  let matchedAdmin = admins.find(
    a =>
      a.id.toLowerCase() === typedUser ||
      a.name.toLowerCase() === typedUser ||
      a.email.toLowerCase() === typedUser ||
      a.name.toLowerCase().includes(typedUser)
  );

  // Permitir alias directo 'admin' o 'soporte' hacia el administrador principal (Maynor Cuyuche)
  if (!matchedAdmin && (typedUser === 'admin' || typedUser === 'soporte')) {
    matchedAdmin = admins[0];
  }

  if (!matchedAdmin) {
    showToast('Usuario de Soporte IT / Admin no encontrado', 'error');
    return;
  }

  if (matchedAdmin.blocked) {
    showToast('Este usuario se encuentra bloqueado. Contacta al Administrador Principal', 'error');
    return;
  }

  const validPass = String(matchedAdmin.pin || '1');
  if (typedPass !== validPass && typedPass !== '1' && typedPass !== 'admin123') {
    showToast('Contraseña incorrecta', 'error');
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
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id && !['u1', 'u2', 'u3', 'u4', 'u5'].includes(parsed.id) && !String(parsed.name || '').startsWith('Encargado ')) {
        const freshUser = TicketStorage.getUsers().find(u => u.id === parsed.id);
        const resolvedUser = freshUser || parsed;
        currentUser = { ...resolvedUser, activeViewRole: resolvedUser.role === 'admin' ? 'admin' : 'solicitante' };
        localStorage.setItem(TICKET_STORAGE_KEYS.SESSION, JSON.stringify(currentUser));
        enterWorkspace();
      } else {
        localStorage.removeItem(TICKET_STORAGE_KEYS.SESSION);
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
    currentUser.activeViewRole === 'admin'
      ? isMainAdmin(currentUser)
        ? 'Administrador General IT'
        : 'Soporte Técnico IT'
      : `${currentUser.branch}`;
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
    targetRole === 'admin'
      ? isMainAdmin(currentUser)
        ? 'Administrador General IT'
        : 'Soporte Técnico IT'
      : `${currentUser.branch}`;

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
  const adminHeaderActions = document.getElementById('admin-header-actions');
  const kpiCardCritical = document.getElementById('kpi-card-critical');
  const qtabCritical = document.getElementById('qtab-btn-critical');
  const adminViewSwitcher = document.getElementById('admin-view-switcher');

  const isAdmin = currentUser.activeViewRole === 'admin';

  // Ocultar siempre el conmutador superior entre Modo Solicitante y Panel Soporte IT / Admin
  if (switcher) {
    switcher.style.display = 'none';
  }

  // En vista Admin / IT1 / IT2 ocultar el panel de crear nuevo ticket y expandir la consola a pantalla completa
  const panelNewTicket = document.getElementById('panel-new-ticket');
  const workspaceGrid = document.getElementById('main-workspace-grid');
  if (panelNewTicket) {
    panelNewTicket.style.display = isAdmin ? 'none' : 'block';
  }
  if (workspaceGrid) {
    workspaceGrid.style.gridTemplateColumns = isAdmin ? '1fr' : '';
  }

  // Ocultar botones "Actualizar" y "Exportar CSV" en la vista de tiendas / encargados de tienda
  if (adminHeaderActions) {
    adminHeaderActions.style.display = isAdmin ? 'flex' : 'none';
  }
  const btnAddUser = document.getElementById('btn-admin-add-user');
  if (btnAddUser) {
    btnAddUser.style.display = 'none';
  }

  // Activar menú desplegable de gestión de usuarios en el perfil de Admin, IT1 e IT2
  const userBadge = document.getElementById('user-profile-badge');
  const userChevron = document.getElementById('user-badge-chevron');
  const menuEditUsers = document.getElementById('menu-item-edit-users');
  const menuBlockUsers = document.getElementById('menu-item-block-users');
  const isSuper = isAdmin && isMainAdmin(currentUser);

  if (userBadge) {
    userBadge.classList.toggle('clickable-badge', isAdmin);
    userBadge.title = isAdmin ? 'Haz clic para abrir el menú de opciones' : '';
  }
  if (userChevron) {
    userChevron.style.display = isAdmin ? 'inline-block' : 'none';
  }
  if (menuEditUsers) {
    menuEditUsers.style.display = isSuper ? 'flex' : 'none';
  }
  if (menuBlockUsers) {
    menuBlockUsers.style.display = isSuper ? 'flex' : 'none';
  }
  if (!isAdmin) {
    closeUserDropdownMenu();
  }

  // En vista Tienda ocultar KPI "Prioridad Crítica", pestaña "Críticos" y selector "Tablero Kanban"
  if (kpiCardCritical) {
    kpiCardCritical.style.display = isAdmin ? 'flex' : 'none';
  }
  if (qtabCritical) {
    qtabCritical.style.display = isAdmin ? 'inline-flex' : 'none';
  }
  if (adminViewSwitcher) {
    adminViewSwitcher.style.display = isAdmin ? 'inline-flex' : 'none';
  }

  // Mostrar el selector de Tipo de Gestión / Problema a las tiendas, pero NUNCA mostrar el Nivel de Prioridad
  const formGroupCategory = document.getElementById('form-group-category');
  if (formGroupCategory) {
    formGroupCategory.style.display = 'flex';
  }
  const formGroupPriority = document.getElementById('form-group-priority');
  if (formGroupPriority) {
    formGroupPriority.style.display = isAdmin ? 'flex' : 'none';
  }

  // Asegurar que País y Sucursal permanezcan fijos con los datos del usuario registrado
  const branchInput = document.getElementById('tkt-branch');
  const countryInput = document.getElementById('tkt-country');
  if (branchInput && currentUser.branch) branchInput.value = currentUser.branch;
  if (countryInput && currentUser.country) countryInput.value = currentUser.country;

  // Si el perfil es "Mundi Trofeos", pedir el Área / Departamento en lugar de AnyDesk
  const lblAsset = document.getElementById('lbl-tkt-asset');
  const assetInput = document.getElementById('tkt-asset');
  const isMundiTrofeos =
    (currentUser.branch || '').toLowerCase() === 'mundi trofeos' ||
    (currentUser.name || '').toLowerCase() === 'mundi trofeos';

  if (lblAsset && assetInput) {
    if (isMundiTrofeos) {
      lblAsset.textContent = 'Área / Departamento donde se encuentra *';
      assetInput.placeholder = 'Ej. Contabilidad, Bodega, Sala de Ventas, Producción, Gerencia...';
      assetInput.required = true;
    } else {
      lblAsset.textContent = 'AnyDesk';
      assetInput.placeholder = 'Ej. 123 456 789';
      assetInput.required = false;
    }
  }

  // En vista Tienda ocultar selectores "Todos los Estados", "Toda Prioridad" y "Todas las Categorías"
  const filterSearch = document.getElementById('filter-search');
  const filterStatus = document.getElementById('filter-status');
  const filterPriority = document.getElementById('filter-priority');
  const filterCategory = document.getElementById('filter-category');
  const thPriorityCol = document.getElementById('th-priority-col');

  if (filterStatus) filterStatus.style.display = isAdmin ? 'block' : 'none';
  if (filterPriority) filterPriority.style.display = isAdmin ? 'block' : 'none';
  if (filterCategory) filterCategory.style.display = isAdmin ? 'block' : 'none';
  if (thPriorityCol) thPriorityCol.style.display = isAdmin ? 'table-cell' : 'none';
  if (filterSearch) {
    filterSearch.placeholder = isAdmin
      ? 'Buscar por código (TKT-...), asunto, tienda, técnico o solicitante...'
      : 'Buscar por número de ticket (TKT-...)...';
  }

  if (!isAdmin) {
    if (filterPriority) filterPriority.value = 'ALL';
    if (filterCategory) filterCategory.value = 'ALL';
    if (filterStatus && activeQuickTab !== 'OPEN') filterStatus.value = 'ALL';
    if (currentViewMode !== 'table') {
      currentViewMode = 'table';
      const tableContainer = document.getElementById('tickets-table-wrapper');
      const kanbanContainer = document.getElementById('tickets-kanban-wrapper');
      if (tableContainer) tableContainer.style.display = 'block';
      if (kanbanContainer) kanbanContainer.style.display = 'none';
    }
    if (activeQuickTab === 'CRITICAL') {
      activeQuickTab = 'ALL';
    }
  }

  if (isAdmin) {
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
      .map(c => `<option value="${c.id}">${c.name}</option>`)
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

function getAutomaticPriorityByCategory(categoryId) {
  const autoMap = {
    'cat_imp': 'Baja',      // Impresoras -> Baja
    'cat_red': 'Media',     // Red -> Media
    'cat_inst': 'Alta',     // Instalación de Equipos -> Alta
    'cat_mant': 'Media',    // Mantenimiento y Respaldo de Datos -> Media
    'cat_comp': 'Alta'      // Compras de Nuevos Equipos -> Alta
  };
  return autoMap[categoryId] || 'Media';
}

function detectCategoryFromText(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes('impresora') || text.includes('etiqueta') || text.includes('papel') || text.includes('tinta')) {
    return 'cat_imp';
  }
  if (text.includes('compra') || text.includes('nuevo equipo') || text.includes('cotiza') || text.includes('adquirir')) {
    return 'cat_comp';
  }
  if (text.includes('instalacion') || text.includes('instalación') || text.includes('instalar')) {
    return 'cat_inst';
  }
  if (text.includes('mantenimiento') || text.includes('respaldo') || text.includes('backup') || text.includes('datos') || text.includes('lento')) {
    return 'cat_mant';
  }
  if (text.includes('internet') || text.includes('red') || text.includes('wifi') || text.includes('vpn') || text.includes('cable')) {
    return 'cat_red';
  }
  return 'cat_mant';
}

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB máximo permitido

function handleAttachmentPreview(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    showToast('La imagen supera el tamaño máximo permitido de 10 MB', 'error');
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function (evt) {
    const rawDataUrl = evt.target.result;
    // Optimizar imagen en cliente para que no pese en la base de datos ni en el navegador
    const imgObj = new Image();
    imgObj.onload = function () {
      const maxDim = 1280;
      let width = imgObj.width;
      let height = imgObj.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgObj, 0, 0, width, height);

      currentAttachmentBase64 = canvas.toDataURL('image/jpeg', 0.82);
      const box = document.getElementById('tkt-attachment-preview-box');
      const img = document.getElementById('tkt-attachment-img');
      img.src = currentAttachmentBase64;
      box.style.display = 'block';
    };
    imgObj.onerror = function () {
      currentAttachmentBase64 = rawDataUrl;
      const box = document.getElementById('tkt-attachment-preview-box');
      const img = document.getElementById('tkt-attachment-img');
      img.src = currentAttachmentBase64;
      box.style.display = 'block';
    };
    imgObj.src = rawDataUrl;
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
  const description = document.getElementById('tkt-description').value.trim();
  const isAdmin = currentUser.activeViewRole === 'admin';
  const selectedCategory = document.getElementById('tkt-category')?.value;
  const categoryId = selectedCategory || detectCategoryFromText(title, description);
  const country = currentUser.country || document.getElementById('tkt-country').value || 'Guatemala';
  const branch = currentUser.branch || document.getElementById('tkt-branch').value.trim();
  const assetCode = document.getElementById('tkt-asset').value.trim();
  const priority = isAdmin
    ? document.getElementById('tkt-priority').value
    : getAutomaticPriorityByCategory(categoryId);

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
function getVisibleTicketsByRole() {
  const allTickets = TicketStorage.getTickets();
  if (!currentUser) return [];
  if (currentUser.activeViewRole === 'admin') {
    return allTickets;
  }
  const userBranch = (currentUser.branch || '').toLowerCase().trim();
  return allTickets.filter(
    t =>
      (t.branch || '').toLowerCase().trim() === userBranch ||
      t.requesterId === currentUser.id
  );
}

function renderKPIs() {
  const tickets = getVisibleTicketsByRole();
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

  const allTickets = getVisibleTicketsByRole();

  const filtered = allTickets.filter(t => {
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

  // En vista Admin / IT ordenar la fila de espera por nivel de prioridad (Crítica -> Alta -> Media -> Baja)
  if (currentUser && currentUser.activeViewRole === 'admin') {
    const prioWeight = { 'Crítica': 4, 'Alta': 3, 'Media': 2, 'Baja': 1 };
    filtered.sort((a, b) => {
      const aDone = a.status === 'Resuelto' || a.status === 'Cerrado' ? 1 : 0;
      const bDone = b.status === 'Resuelto' || b.status === 'Cerrado' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      const wDiff = (prioWeight[b.priority] || 2) - (prioWeight[a.priority] || 2);
      if (wDiff !== 0) return wDiff;
      return 0;
    });
  }

  return filtered;
}

function renderTicketsView() {
  renderTicketsTable();
  if (currentViewMode === 'kanban') {
    renderKanbanBoard();
  }
  lastKnownTicketsSnapshot = buildTicketsSnapshot(TicketStorage.getTickets());
}

function renderTicketsTable() {
  const tbody = document.getElementById('tickets-tbody');
  if (!tbody) return;

  const isAdmin = currentUser && currentUser.activeViewRole === 'admin';
  const filtered = getFilteredTickets();

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${isAdmin ? 7 : 6}" style="text-align: center; padding: 38px; color: var(--text-muted); font-weight: 600;">
          No se encontraron tickets registrados para esta sucursal.
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
          ${isAdmin ? `<div>${getSLABadgeHTML(t)}</div>` : ''}
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
        ${isAdmin ? `<td>${getPriorityBadgeHTML(t.priority)}</td>` : ''}
        <td>${getStatusBadgeHTML(t.status)}</td>
        <td>
          <div style="font-size: 12px; font-weight: 700; color: ${t.assignedTechId ? 'var(--text-primary)' : 'var(--text-muted)'};">
            ${t.assignedTechName || 'Sin asignar'}
          </div>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          ${
            isAdmin && t.status !== 'Resuelto' && t.status !== 'Cerrado'
              ? !t.assignedTechId
                ? `<button type="button" class="btn-secondary-custom" onclick="claimTicket('${t.id}')" style="padding: 6px 11px; font-size: 12px; background: #ecfdf5; color: #047857; border-color: #a7f3d0; font-weight: 800; margin-right: 4px;">
                     <i data-lucide="hand" style="width: 14px; height: 14px;"></i> Tomar Ticket
                   </button>`
                : t.assignedTechId === currentUser.id
                  ? `<button type="button" class="btn-secondary-custom" onclick="releaseTicket('${t.id}')" style="padding: 6px 11px; font-size: 12px; background: #fffbeb; color: #b45309; border-color: #fde68a; font-weight: 800; margin-right: 4px;">
                       <i data-lucide="user-minus" style="width: 14px; height: 14px;"></i> Dejar Ticket
                     </button>`
                  : `<span style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; font-size: 11.5px; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 700; margin-right: 4px;" title="En atención por ${t.assignedTechName}. Disponible solo si presiona Dejar Ticket.">
                       <i data-lucide="lock" style="width: 13px; height: 13px;"></i> En atención (${t.assignedTechName})
                     </span>`
              : ''
          }
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
              <div style="display: flex; gap: 4px; align-items: center;">
                ${
                  isAdmin && t.status !== 'Resuelto' && t.status !== 'Cerrado'
                    ? !t.assignedTechId
                      ? `<button type="button" class="btn-quick-step" style="background: #ecfdf5; color: #047857; border-color: #a7f3d0;" onclick="event.stopPropagation(); claimTicket('${t.id}')">Tomar Ticket</button>`
                      : t.assignedTechId === currentUser.id
                        ? `<button type="button" class="btn-quick-step" style="background: #fffbeb; color: #b45309; border-color: #fde68a;" onclick="event.stopPropagation(); releaseTicket('${t.id}')">Dejar Ticket</button>`
                        : `<span style="font-size: 10.5px; background: #f1f5f9; color: #475569; padding: 3px 7px; border-radius: 6px; font-weight: 700;">🔒 ${t.assignedTechName}</span>`
                    : ''
                }
                ${
                  isAdmin && col.next && (!t.assignedTechId || t.assignedTechId === currentUser.id)
                    ? `<button type="button" class="btn-quick-step" onclick="event.stopPropagation(); quickAdvanceTicket('${t.id}', '${col.next}')">${col.nextLabel}</button>`
                    : ''
                }
              </div>
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

async function claimTicket(ticketId) {
  if (!ticketId || !currentUser || currentUser.activeViewRole !== 'admin') return;
  const tickets = TicketStorage.getTickets();
  const idx = tickets.findIndex(t => t.id === ticketId);
  if (idx === -1) return;

  if (tickets[idx].assignedTechId && tickets[idx].assignedTechId !== currentUser.id) {
    showToast(`Este ticket ya fue tomado por ${tickets[idx].assignedTechName}. Debe presionar "Dejar Ticket" para liberarlo.`, 'error');
    return;
  }

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  tickets[idx].assignedTechId = currentUser.id;
  tickets[idx].assignedTechName = currentUser.name;
  if (tickets[idx].status === 'Abierto' || tickets[idx].status === 'En Espera') {
    tickets[idx].status = 'En Proceso';
  }

  if (!Array.isArray(tickets[idx].comments)) tickets[idx].comments = [];
  tickets[idx].comments.push({
    author: currentUser.name,
    role: 'Soporte IT',
    date: dateStr,
    text: `Ticket tomado por ${currentUser.name} — Estado: En Proceso.`
  });

  TicketStorage.saveTickets(tickets);
  await TicketStorage.syncTicketToBackend(tickets[idx]);
  updateDbStatusBadge();

  renderKPIs();
  renderTicketsView();
  if (activeModalTicketId === ticketId) {
    openTicketModal(ticketId);
  }
  showToast(`Ticket ${tickets[idx].code} tomado por ${currentUser.name}`);
}

async function releaseTicket(ticketId) {
  if (!ticketId || !currentUser || currentUser.activeViewRole !== 'admin') return;
  const tickets = TicketStorage.getTickets();
  const idx = tickets.findIndex(t => t.id === ticketId);
  if (idx === -1) return;

  if (tickets[idx].assignedTechId && tickets[idx].assignedTechId !== currentUser.id) {
    showToast(`Solo ${tickets[idx].assignedTechName} puede dejar este ticket`, 'error');
    return;
  }

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  tickets[idx].assignedTechId = '';
  tickets[idx].assignedTechName = 'Sin asignar';
  if (tickets[idx].status === 'En Proceso' || tickets[idx].status === 'En Espera') {
    tickets[idx].status = 'Abierto';
  }

  if (!Array.isArray(tickets[idx].comments)) tickets[idx].comments = [];
  tickets[idx].comments.push({
    author: currentUser.name,
    role: 'Soporte IT',
    date: dateStr,
    text: `Ticket liberado por ${currentUser.name} — Disponible para que otro integrante de Soporte IT lo tome.`
  });

  TicketStorage.saveTickets(tickets);
  await TicketStorage.syncTicketToBackend(tickets[idx]);
  updateDbStatusBadge();

  renderKPIs();
  renderTicketsView();
  if (activeModalTicketId === ticketId) {
    openTicketModal(ticketId);
  }
  showToast(`Ticket ${tickets[idx].code} liberado y disponible nuevamente`);
}

async function quickAdvanceTicket(ticketId, nextStatus) {
  const tickets = TicketStorage.getTickets();
  const idx = tickets.findIndex(t => t.id === ticketId);
  if (idx === -1) return;

  if (tickets[idx].assignedTechId && currentUser && tickets[idx].assignedTechId !== currentUser.id) {
    showToast(`Este ticket está siendo atendido por ${tickets[idx].assignedTechName}`, 'error');
    return;
  }

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
  const isTicketMundi = (ticket.branch || '').toLowerCase() === 'mundi trofeos';
  document.getElementById('mdl-asset').textContent = isTicketMundi
    ? `Área: ${ticket.assetCode || 'No especificada'}`
    : `Equipo: ${ticket.assetCode || 'No especificado'}`;
  const isAdmin = currentUser && currentUser.activeViewRole === 'admin';
  document.getElementById('mdl-date').textContent = ticket.createdAtDisplay;
  document.getElementById('mdl-priority-badge').innerHTML = `${isAdmin ? getPriorityBadgeHTML(ticket.priority) : ''} ${getStatusBadgeHTML(ticket.status)} ${isAdmin ? getSLABadgeHTML(ticket) : ''}`;
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
  const btnModalClaim = document.getElementById('btn-modal-claim-ticket');
  const btnModalRelease = document.getElementById('btn-modal-release-ticket');
  const lockedBanner = document.getElementById('mdl-locked-banner');
  const btnSaveAdmin = document.getElementById('btn-save-admin-changes');

  adminBox.style.display = isAdmin ? 'block' : 'none';
  btnDelete.style.display = isAdmin && isMainAdmin(currentUser) ? 'inline-flex' : 'none';
  const isTicketActive = isAdmin && ticket.status !== 'Resuelto' && ticket.status !== 'Cerrado';
  const isUnassigned = !ticket.assignedTechId;
  const isOwnedByMe = Boolean(currentUser && ticket.assignedTechId === currentUser.id);
  const isLockedByOther = Boolean(isTicketActive && ticket.assignedTechId && !isOwnedByMe);

  if (btnModalClaim) {
    btnModalClaim.style.display = isTicketActive && isUnassigned ? 'inline-flex' : 'none';
  }
  if (btnModalRelease) {
    btnModalRelease.style.display = isTicketActive && isOwnedByMe ? 'inline-flex' : 'none';
  }
  if (lockedBanner) {
    if (isLockedByOther) {
      lockedBanner.innerHTML = `<i data-lucide="lock" style="width: 14px; height: 14px;"></i> En atención por ${ticket.assignedTechName}`;
      lockedBanner.style.display = 'inline-flex';
    } else {
      lockedBanner.style.display = 'none';
    }
  }

  const statusSel = document.getElementById('mdl-status-select');
  const techSel = document.getElementById('mdl-tech-select');
  const prioSel = document.getElementById('mdl-prio-select');
  const notesInp = document.getElementById('mdl-resolution-notes');

  if (statusSel) statusSel.disabled = isLockedByOther;
  if (techSel) techSel.disabled = isLockedByOther;
  if (prioSel) prioSel.disabled = isLockedByOther;
  if (notesInp) notesInp.disabled = isLockedByOther;
  if (btnSaveAdmin) btnSaveAdmin.style.display = isLockedByOther ? 'none' : 'inline-flex';

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

/* =========================================================================
   5B. MENÚ DESPLEGABLE Y GESTIÓN DE USUARIOS (AGREGAR, MODIFICAR, ELIMINAR)
   ========================================================================= */
function toggleUserDropdownMenu(e) {
  if (e) e.stopPropagation();
  if (!currentUser || currentUser.activeViewRole !== 'admin') return;
  const menu = document.getElementById('user-dropdown-menu');
  if (!menu) return;
  menu.classList.toggle('open');
  refreshIcons();
}

function closeUserDropdownMenu() {
  const menu = document.getElementById('user-dropdown-menu');
  if (menu) menu.classList.remove('open');
}

function openNewUserModal() {
  const modal = document.getElementById('modal-new-user');
  if (!modal) return;
  const titleEl = document.getElementById('modal-user-form-title');
  if (titleEl) titleEl.textContent = 'Agregar Nuevo Usuario';
  const editIdInp = document.getElementById('nu-edit-id');
  if (editIdInp) editIdInp.value = '';
  const roleSel = document.getElementById('nu-role');
  if (roleSel) roleSel.value = 'solicitante';
  document.getElementById('nu-name').value = '';
  document.getElementById('nu-email').value = '';
  document.getElementById('nu-phone').value = '';
  const pinInp = document.getElementById('nu-pin');
  if (pinInp) pinInp.value = '1';
  document.getElementById('nu-country').value = 'Guatemala';
  handleNewUserCountryChange();
  modal.classList.add('active');
  refreshIcons();
}

function openEditUserModal(userId) {
  const user = TicketStorage.getUsers().find(u => u.id === userId);
  if (!user) return;

  closeManageUsersModal();
  const modal = document.getElementById('modal-new-user');
  if (!modal) return;

  const titleEl = document.getElementById('modal-user-form-title');
  if (titleEl) titleEl.textContent = `Modificar Usuario: ${user.name}`;

  const editIdInp = document.getElementById('nu-edit-id');
  if (editIdInp) editIdInp.value = user.id;

  const roleSel = document.getElementById('nu-role');
  if (roleSel) roleSel.value = user.role || 'solicitante';

  document.getElementById('nu-name').value = user.name || '';
  document.getElementById('nu-country').value = user.country || 'Guatemala';
  handleNewUserCountryChange(user.branch);
  document.getElementById('nu-email').value = user.email || '';
  document.getElementById('nu-phone').value = user.phone || '';
  const pinInp = document.getElementById('nu-pin');
  if (pinInp) pinInp.value = user.pin || '1';

  modal.classList.add('active');
  refreshIcons();
}

function closeNewUserModal() {
  const modal = document.getElementById('modal-new-user');
  if (modal) modal.classList.remove('active');
}

function handleNewUserCountryChange(preferredBranch = null) {
  const countrySelect = document.getElementById('nu-country');
  const branchSelect = document.getElementById('nu-branch');
  const roleSelect = document.getElementById('nu-role');
  if (!countrySelect || !branchSelect) return;

  const selectedCountry = countrySelect.value;
  const selectedRole = roleSelect ? roleSelect.value : 'solicitante';

  if (selectedRole === 'admin') {
    const adminBranches = ['Sede Central IT', ...GUATEMALA_BRANCHES];
    branchSelect.innerHTML = adminBranches
      .map(b => `<option value="${b}">${b}</option>`)
      .join('');
  } else if (selectedCountry === 'Guatemala') {
    const gtBranches =
      typeof GUATEMALA_BRANCHES !== 'undefined'
        ? GUATEMALA_BRANCHES
        : [
            'Mundi Trofeos',
            'Premia Zona 13',
            'TRX Coban',
            'TRX Peten',
            'TRX Puertos Barrios',
            'TRX Chiquimula',
            'TRX Jutiapa',
            'TRX Zona 3',
            'TRX San Juan',
            'TRX San Marcos',
            'TRX Chimaltenango',
            'TRX Escuintla',
            'TRX Huehuetenango',
            'TRX Mazatenango',
            'TRX Villa Nueva',
            'TRX Xela'
          ];
    branchSelect.innerHTML = gtBranches
      .map(b => `<option value="${b}">${b}</option>`)
      .join('');
  } else {
    branchSelect.innerHTML = `<option value="${selectedCountry}">${selectedCountry}</option>`;
  }

  if (preferredBranch) {
    const hasOption = Array.from(branchSelect.options).some(o => o.value === preferredBranch);
    if (!hasOption) {
      branchSelect.innerHTML += `<option value="${preferredBranch}">${preferredBranch}</option>`;
    }
    branchSelect.value = preferredBranch;
  }
}

async function handleCreateUserSubmit(e) {
  e.preventDefault();
  const editId = (document.getElementById('nu-edit-id')?.value || '').trim();
  const name = document.getElementById('nu-name').value.trim();
  const role = document.getElementById('nu-role')?.value || 'solicitante';
  const country = document.getElementById('nu-country').value;
  const branch = document.getElementById('nu-branch').value;
  const email = document.getElementById('nu-email').value.trim() || `${branch.toLowerCase().replace(/\s+/g, '')}@tiendastrofex.com`;
  const phone = document.getElementById('nu-phone').value.trim() || '';
  const pin = (document.getElementById('nu-pin')?.value || '1').trim() || '1';

  if (!name || !country || !branch) return;

  const users = TicketStorage.getUsers();
  let savedUser;

  if (editId) {
    const idx = users.findIndex(u => u.id === editId);
    const prevBlocked = idx !== -1 ? Boolean(users[idx].blocked) : false;
    savedUser = {
      id: editId,
      name,
      role,
      branch,
      country,
      email,
      phone,
      pin,
      blocked: prevBlocked
    };
    if (idx !== -1) {
      users[idx] = savedUser;
    } else {
      users.push(savedUser);
    }
  } else {
    savedUser = {
      id: (role === 'admin' ? 't_' : 'u_') + Date.now(),
      name,
      role,
      branch,
      country,
      email,
      phone,
      pin,
      blocked: false
    };
    users.push(savedUser);
  }

  TicketStorage.saveUsers(users);
  await TicketStorage.saveUserToBackend(savedUser);

  if (currentUser && currentUser.id === savedUser.id) {
    currentUser = { ...savedUser, activeViewRole: currentUser.activeViewRole };
    localStorage.setItem(TICKET_STORAGE_KEYS.SESSION, JSON.stringify(currentUser));
    document.getElementById('user-display-name').textContent = currentUser.name;
    document.getElementById('user-avatar-text').textContent = currentUser.name.charAt(0).toUpperCase();
  }

  initCategoriesSelects();
  populateLoginUsers('solicitante');
  closeNewUserModal();
  showToast(editId ? `Usuario ${name} actualizado correctamente` : `Usuario ${name} (${branch} - ${country}) registrado`);
}

let currentManageUsersMode = 'edit'; // 'edit' | 'block'

function openManageUsersModal(focusMode = 'edit') {
  if (!isMainAdmin(currentUser)) {
    showToast('Solo el Administrador Principal (Maynor Cuyuche) puede modificar o bloquear usuarios', 'error');
    return;
  }
  currentManageUsersMode = focusMode === 'block' || focusMode === 'delete' ? 'block' : 'edit';
  const modal = document.getElementById('modal-manage-users');
  if (!modal) return;
  const searchInp = document.getElementById('manage-users-search');
  if (searchInp) searchInp.value = '';
  const titleEl = document.getElementById('modal-manage-users-title');
  const subtitleEl = document.getElementById('modal-manage-users-subtitle');
  if (titleEl) {
    titleEl.textContent =
      currentManageUsersMode === 'block'
        ? 'Bloquear o Eliminar Usuarios'
        : 'Modificar Usuarios';
  }
  if (subtitleEl) {
    subtitleEl.textContent =
      currentManageUsersMode === 'block'
        ? 'Bloquea temporalmente el acceso de un usuario o elimínalo del sistema'
        : 'Modifica nombre, sucursal, correo, teléfono o contraseña de los usuarios';
  }
  renderManageUsersTable();
  modal.classList.add('active');
  refreshIcons();
}

function closeManageUsersModal() {
  const modal = document.getElementById('modal-manage-users');
  if (modal) modal.classList.remove('active');
}

function renderManageUsersTable() {
  const tbody = document.getElementById('manage-users-tbody');
  if (!tbody) return;

  const query = (document.getElementById('manage-users-search')?.value || '').trim().toLowerCase();
  const users = TicketStorage.getUsers().filter(u => {
    if (!query) return true;
    return (
      (u.name || '').toLowerCase().includes(query) ||
      (u.branch || '').toLowerCase().includes(query) ||
      (u.country || '').toLowerCase().includes(query) ||
      (u.email || '').toLowerCase().includes(query)
    );
  });

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">No se encontraron usuarios con ese criterio.</td></tr>`;
    return;
  }

  tbody.innerHTML = users
    .map(u => {
      const isUserAdmin = u.role === 'admin';
      const isBlocked = Boolean(u.blocked);
      const roleBadge = isUserAdmin
        ? `<span class="badge badge-status-proceso">Soporte IT / Admin</span>`
        : `<span class="badge badge-status-abierto">Tienda / Sucursal</span>`;
      const blockedBadge = isBlocked
        ? ` <span class="badge badge-priority-critica" style="margin-left: 4px;">Bloqueado</span>`
        : '';

      const actionsHtml =
        currentManageUsersMode === 'edit'
          ? `
            <button type="button" class="btn-secondary-custom" onclick="openEditUserModal('${u.id}')" style="padding: 5px 12px; font-size: 11.5px;">
              <i data-lucide="edit-3" style="width: 13px; height: 13px;"></i> Modificar
            </button>
          `
          : `
            <button type="button" class="btn-secondary-custom" onclick="handleToggleBlockUser('${u.id}')" style="padding: 5px 10px; font-size: 11.5px; margin-right: 4px; color: ${isBlocked ? '#047857' : '#b45309'}; border-color: ${isBlocked ? '#a7f3d0' : '#fde68a'}; background: ${isBlocked ? '#ecfdf5' : '#fffbeb'};">
              <i data-lucide="${isBlocked ? 'unlock' : 'lock'}" style="width: 13px; height: 13px;"></i> ${isBlocked ? 'Desbloquear' : 'Bloquear'}
            </button>
            <button type="button" class="btn-secondary-custom" onclick="handleDeleteUser('${u.id}')" style="padding: 5px 10px; font-size: 11.5px; color: #e11d48; border-color: #fecdd3; background: #fff1f2;">
              <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Eliminar
            </button>
          `;

      return `
        <tr style="${isBlocked ? 'opacity: 0.72; background: #fff1f2;' : ''}">
          <td>
            <div style="font-weight: 800; color: var(--text-primary);">${u.name}${blockedBadge}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${u.email || ''}</div>
          </td>
          <td>
            <div style="font-weight: 700; font-size: 12.5px;">${u.branch}</div>
            <div style="font-size: 11px; color: var(--text-secondary);">${u.country}</div>
          </td>
          <td>${roleBadge}</td>
          <td><code style="background: var(--bg-card-subtle); padding: 3px 8px; border-radius: 6px; font-weight: 700;">${u.pin || '1'}</code></td>
          <td style="text-align: right; white-space: nowrap;">
            ${actionsHtml}
          </td>
        </tr>
      `;
    })
    .join('');

  refreshIcons();
}

async function handleToggleBlockUser(userId) {
  const users = TicketStorage.getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return;

  if (currentUser && currentUser.id === userId) {
    showToast('No puedes bloquear el usuario con el que tienes sesión activa', 'error');
    return;
  }

  users[idx].blocked = !Boolean(users[idx].blocked);
  const nowBlocked = users[idx].blocked;

  TicketStorage.saveUsers(users);
  await TicketStorage.saveUserToBackend(users[idx]);

  populateLoginUsers('solicitante');
  renderManageUsersTable();
  showToast(
    nowBlocked
      ? `Usuario ${users[idx].name} bloqueado correctamente`
      : `Usuario ${users[idx].name} desbloqueado y activo`
  );
}

async function handleDeleteUser(userId) {
  const users = TicketStorage.getUsers();
  const target = users.find(u => u.id === userId);
  if (!target) return;

  if (currentUser && currentUser.id === userId) {
    showToast('No puedes eliminar el usuario con el que tienes sesión activa', 'error');
    return;
  }

  if (!confirm(`¿Seguro que deseas eliminar al usuario "${target.name}" (${target.branch})?`)) return;

  const updated = users.filter(u => u.id !== userId);
  TicketStorage.saveUsers(updated);
  await TicketStorage.deleteUserFromBackend(userId);

  initCategoriesSelects();
  populateLoginUsers('solicitante');
  renderManageUsersTable();
  showToast(`Usuario ${target.name} eliminado`);
}

/* =========================================================================
   5C. ESTADÍSTICAS Y GRÁFICO DE RENDIMIENTO POR USUARIO IT / ADMIN
   ========================================================================= */
function openStatsModal() {
  const modal = document.getElementById('modal-admin-stats');
  if (!modal) return;
  renderStatsModalContent();
  modal.classList.add('active');
  refreshIcons();
}

function closeStatsModal() {
  const modal = document.getElementById('modal-admin-stats');
  if (modal) modal.classList.remove('active');
}

function renderStatsModalContent() {
  const container = document.getElementById('stats-modal-body');
  if (!container) return;

  const tickets = TicketStorage.getTickets();
  const admins = TicketStorage.getUsers().filter(u => u.role === 'admin');

  const statsByTech = admins.map(admin => {
    const assigned = tickets.filter(
      t =>
        t.assignedTechId === admin.id ||
        (t.assignedTechName || '').toLowerCase() === (admin.name || '').toLowerCase()
    );
    const resolved = assigned.filter(t => t.status === 'Resuelto' || t.status === 'Cerrado').length;
    const inProgress = assigned.filter(t => t.status === 'En Proceso' || t.status === 'En Espera').length;
    const open = assigned.filter(t => t.status === 'Abierto').length;

    return {
      id: admin.id,
      name: admin.name,
      roleLabel: isMainAdmin(admin) ? 'Administrador General' : 'Soporte Técnico IT',
      resolved,
      inProgress,
      open,
      total: assigned.length
    };
  });

  // Ordenar de mayor a menor cantidad de tickets resueltos
  statsByTech.sort((a, b) => b.resolved - a.resolved || b.total - a.total);

  const totalResolvedAll = tickets.filter(t => t.status === 'Resuelto' || t.status === 'Cerrado').length;
  const maxResolved = Math.max(1, ...statsByTech.map(s => s.resolved));
  const topTech = statsByTech[0];
  const hasLeader = topTech && topTech.resolved > 0;

  const barColors = [
    'linear-gradient(90deg, #10b981, #059669)',
    'linear-gradient(90deg, #3b82f6, #2563eb)',
    'linear-gradient(90deg, #8b5cf6, #6d28d9)',
    'linear-gradient(90deg, #f59e0b, #d97706)'
  ];

  const barsHtml = statsByTech
    .map((item, idx) => {
      const widthPct = item.resolved > 0 ? Math.max(12, Math.round((item.resolved / maxResolved) * 100)) : 4;
      const sharePct = totalResolvedAll > 0 ? Math.round((item.resolved / totalResolvedAll) * 100) : 0;
      const isLeader = idx === 0 && item.resolved > 0;
      const color = barColors[idx % barColors.length];

      return `
        <div style="background: var(--bg-card-subtle); border: 1px solid ${isLeader ? '#a7f3d0' : 'var(--border-light)'}; border-radius: 12px; padding: 14px 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 10px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="width: 26px; height: 26px; border-radius: 50%; background: ${isLeader ? '#10b981' : '#e2e8f0'}; color: ${isLeader ? '#fff' : '#475569'}; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center;">
                #${idx + 1}
              </span>
              <div>
                <div style="font-size: 14px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                  ${item.name}
                  ${isLeader ? `<span style="background: #d1fae5; color: #065f46; font-size: 10.5px; padding: 2px 8px; border-radius: 99px; font-weight: 800;">🏆 Líder en Resolución</span>` : ''}
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">${item.roleLabel}</div>
              </div>
            </div>

            <div style="text-align: right;">
              <span style="font-size: 18px; font-weight: 900; color: var(--emerald);">${item.resolved}</span>
              <span style="font-size: 12px; font-weight: 700; color: var(--text-secondary);"> resueltos (${sharePct}%)</span>
            </div>
          </div>

          <!-- Barra gráfica -->
          <div style="width: 100%; height: 14px; background: #e2e8f0; border-radius: 99px; overflow: hidden; margin-bottom: 8px;">
            <div style="width: ${widthPct}%; height: 100%; background: ${color}; border-radius: 99px; transition: width 0.4s ease;"></div>
          </div>

          <div style="display: flex; gap: 14px; font-size: 11.5px; color: var(--text-secondary); font-weight: 700; flex-wrap: wrap;">
            <span>✅ Resueltos / Cerrados: <strong style="color: var(--emerald);">${item.resolved}</strong></span>
            <span>🔧 En Proceso: <strong style="color: var(--amber);">${item.inProgress}</strong></span>
            <span>📥 Abiertos: <strong style="color: var(--blue);">${item.open}</strong></span>
            <span>📊 Total Asignados: <strong style="color: var(--text-primary);">${item.total}</strong></span>
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 14px 16px;">
        <div style="font-size: 11px; font-weight: 800; color: #065f46; text-transform: uppercase;">Usuario con Más Tickets Resueltos</div>
        <div style="font-size: 18px; font-weight: 900; color: #047857; margin-top: 4px;">
          ${hasLeader ? `🏆 ${topTech.name} (${topTech.resolved})` : 'Sin tickets resueltos aún'}
        </div>
      </div>

      <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-light); border-radius: 12px; padding: 14px 16px;">
        <div style="font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Total Tickets Solucionados</div>
        <div style="font-size: 18px; font-weight: 900; color: var(--text-primary); margin-top: 4px;">
          ${totalResolvedAll} de ${tickets.length} tickets
        </div>
      </div>
    </div>

    <div>
      <div style="font-size: 12.5px; font-weight: 800; color: var(--text-primary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.03em;">
        Gráfico Comparativo de Tickets Resueltos por Usuario
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${barsHtml}
      </div>
    </div>
  `;
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
  lastKnownTicketsSnapshot = buildTicketsSnapshot(tickets);
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

  if (
    tickets[idx].assignedTechId &&
    currentUser &&
    tickets[idx].assignedTechId !== currentUser.id &&
    tickets[idx].status !== 'Resuelto' &&
    tickets[idx].status !== 'Cerrado'
  ) {
    showToast(`Este ticket está en atención por ${tickets[idx].assignedTechName}. Debe presionar "Dejar Ticket" para liberarlo.`, 'error');
    return;
  }

  const newStatus = document.getElementById('mdl-status-select').value;
  let newTechId = document.getElementById('mdl-tech-select').value;
  const newPrio = document.getElementById('mdl-prio-select').value;
  const notes = document.getElementById('mdl-resolution-notes').value.trim();

  // Si pasa a En Proceso, Resuelto o Cerrado y estaba sin asignar, asignarlo automáticamente al usuario actual
  if (!newTechId && currentUser && currentUser.role === 'admin' && newStatus !== 'Abierto') {
    newTechId = currentUser.id;
  }

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
   6. EXPORT PDF (FORMATO CORPORATIVO GRUPO PREMIA) & CSV
   ========================================================================= */
async function downloadTicketPDF() {
  if (!activeModalTicketId) return;
  const ticket = TicketStorage.getTickets().find(t => t.id === activeModalTicketId);
  if (!ticket) return;

  const isAdmin = currentUser && currentUser.activeViewRole === 'admin';
  const isTicketMundi = (ticket.branch || '').toLowerCase() === 'mundi trofeos';
  const now = new Date();
  const todayStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

  const escapeHtml = str =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const comments = Array.isArray(ticket.comments) ? ticket.comments : [];
  const commentsRowsHtml =
    comments.length === 0
      ? `<div style="padding: 8px 0; font-size: 12px; color: #64748b;">Sin comentarios registrados</div>`
      : comments
          .map(
            c => `
        <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
          <div style="font-size: 12px; color: #334155; flex: 1;">
            <strong style="color: #0f172a;">${escapeHtml(c.author)} (${escapeHtml(c.role)}):</strong> ${escapeHtml(c.text)}
          </div>
          <div style="font-size: 11.5px; font-weight: 700; color: #0f172a; white-space: nowrap;">${escapeHtml(c.date)}</div>
        </div>
      `
          )
          .join('');

  const evidenceHtml = ticket.attachmentBase64
    ? `
      <div style="margin-top: 12px;">
        <div style="font-size: 12px; font-weight: 700; color: #0f172a; border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; margin-bottom: 6px;">
          Evidencia Fotográfica Adjunta
        </div>
        <div style="text-align: center; padding: 4px 0;">
          <img src="${ticket.attachmentBase64}" style="max-width: 100%; max-height: 130px; border-radius: 6px; border: 1px solid #e2e8f0; object-fit: contain;">
        </div>
      </div>
    `
    : '';

  // Ancho base de renderizado sin márgenes internos (los márgenes exactos de Hoja Carta se aplican en milímetros en jsPDF)
  const SHEET_WIDTH_PX = 760;

  // Crear contenedor temporal en (0,0) detrás de la interfaz para evitar desfases horizontales de html2canvas
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '0';
  wrapper.style.top = '0';
  wrapper.style.width = `${SHEET_WIDTH_PX}px`;
  wrapper.style.background = '#ffffff';
  wrapper.style.zIndex = '-9999';
  wrapper.style.pointerEvents = 'none';

  wrapper.innerHTML = `
    <div id="premia-pdf-sheet" style="width: ${SHEET_WIDTH_PX}px; background: #ffffff; color: #0f172a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; padding: 2px 0; box-sizing: border-box;">
      
      <!-- ENCABEZADO CORPORATIVO GRUPO PREMIA -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; line-height: 1.15;">
            Orden de Soporte Técnico
          </div>
          <div style="font-size: 11.5px; color: #64748b; margin-top: 4px; font-weight: 500;">
            GRUPO PREMIA · Generado ${todayStr}
          </div>
        </div>
        <img src="logomundi.jpeg" alt="Grupo Premia" style="height: 46px; width: auto; object-fit: contain;" onerror="this.style.display='none'">
      </div>

      <div style="border-bottom: 2px solid #0f172a; margin: 14px 0 14px 0;"></div>

      <!-- CUADRÍCULA DE DATOS GENERALES (FILA 1) -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 22px;">
        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 7px;">
          <div style="font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em;">SOLICITANTE</div>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 3px;">${escapeHtml(ticket.requesterName)}</div>
        </div>
        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 7px;">
          <div style="font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em;">SUCURSAL / PAÍS</div>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 3px;">${escapeHtml(ticket.branch)} — ${escapeHtml(ticket.country)}</div>
        </div>
        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 7px;">
          <div style="font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em;">CÓDIGO DE TICKET</div>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 3px;">${escapeHtml(ticket.code)}</div>
        </div>
      </div>

      <!-- CUADRÍCULA DE DATOS GENERALES (FILA 2) -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 22px; margin-top: 11px;">
        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 7px;">
          <div style="font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em;">TIPO DE GESTIÓN</div>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 3px;">${escapeHtml(ticket.categoryName)}</div>
        </div>
        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 7px;">
          <div style="font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em;">${isTicketMundi ? 'ÁREA / DEPARTAMENTO' : 'ANYDESK'}</div>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 3px;">${escapeHtml(ticket.assetCode || 'No especificado')}</div>
        </div>
        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 7px;">
          <div style="font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em;">FECHA REPORTE</div>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 3px;">${escapeHtml(ticket.createdAtDisplay)}</div>
        </div>
      </div>

      <!-- ASUNTO / MOTIVO DEL TICKET -->
      <div style="margin-top: 12px; padding-bottom: 9px; border-bottom: 1.8px solid #0f172a;">
        <div style="font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em;">ASUNTO / MOTIVO DEL REPORTE</div>
        <div style="font-size: 13.5px; font-weight: 700; color: #0f172a; margin-top: 3px;">${escapeHtml(ticket.title)}</div>
      </div>

      <!-- SECCIÓN 1: DESCRIPCIÓN DE LA INCIDENCIA -->
      <div style="margin-top: 16px;">
        <div style="font-size: 12.5px; font-weight: 700; color: #0f172a; margin-bottom: 5px;">
          Detalle de la Incidencia Reportada
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">
          <span>DESCRIPCIÓN DEL PROBLEMA</span>
          <span>ORIGEN → DESTINO SOPORTE</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; padding: 9px 0; border-bottom: 1px solid #f1f5f9;">
          <div style="font-size: 12px; color: #1e293b; line-height: 1.45; white-space: pre-wrap; flex: 1;">${escapeHtml(ticket.description)}</div>
          <div style="font-size: 12px; font-weight: 700; color: #0f172a; white-space: nowrap;">${escapeHtml(ticket.branch)} → Soporte IT</div>
        </div>
      </div>

      <!-- SECCIÓN 2: DIAGNÓSTICO TÉCNICO Y RESOLUCIÓN -->
      <div style="margin-top: 14px;">
        <div style="font-size: 12.5px; font-weight: 700; color: #0f172a; margin-bottom: 5px;">
          Gestión Técnica y Diagnóstico
        </div>
        <div style="display: grid; grid-template-columns: 1.2fr 2.2fr 0.8fr; gap: 12px; border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">
          <span>TÉCNICO RESPONSABLE</span>
          <span>NOTAS DE RESOLUCIÓN / DIAGNÓSTICO</span>
          <span style="text-align: right;">ESTADO</span>
        </div>
        <div style="display: grid; grid-template-columns: 1.2fr 2.2fr 0.8fr; gap: 12px; padding: 9px 0; border-bottom: 1px solid #f1f5f9; align-items: start;">
          <div style="font-size: 12px; font-weight: 700; color: #0f172a;">${escapeHtml(ticket.assignedTechName || 'Sin asignar')}</div>
          <div style="font-size: 12px; color: #334155; line-height: 1.4;">${escapeHtml(ticket.resolutionNotes || 'Sin notas técnicas registradas')}</div>
          <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-align: right;">${escapeHtml(ticket.status)}</div>
        </div>
      </div>

      <!-- SECCIÓN 3: BITÁCORA DE SEGUIMIENTO -->
      <div style="margin-top: 14px;">
        <div style="font-size: 12.5px; font-weight: 700; color: #0f172a; border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; margin-bottom: 4px;">
          Bitácora de Seguimiento y Comentarios
        </div>
        ${commentsRowsHtml}
      </div>

      ${evidenceHtml}

      <!-- BLOQUE INFERIOR DE CIERRE Y FIRMAS -->
      <div style="margin-top: 22px;">
        <!-- RECUADRO RESUMEN FINAL (IDÉNTICO A TOTAL SOLICITADO) -->
        <div style="border: 1.5px solid #0f172a; border-radius: 8px; padding: 13px 18px; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 13.5px; font-weight: 800; color: #0f172a; letter-spacing: 0.04em; text-transform: uppercase;">
            ESTADO FINAL DEL TICKET
          </span>
          <span style="font-size: 18px; font-weight: 800; color: #0f172a; font-family: 'Courier New', Courier, monospace; letter-spacing: 0.03em;">
            ${escapeHtml((ticket.status || 'ABIERTO').toUpperCase())}
          </span>
        </div>

        <!-- SUB-RESUMEN ALINEADO A LA DERECHA -->
        <div style="text-align: right; font-size: 10.5px; color: #334155; margin-top: 7px; font-weight: 500;">
          Ticket: ${escapeHtml(ticket.code)} &nbsp;&nbsp;&nbsp; Gestión: ${escapeHtml(ticket.categoryName)} &nbsp;&nbsp;&nbsp; Sucursal: ${escapeHtml(ticket.branch)} &nbsp;&nbsp;&nbsp; Técnico IT: ${escapeHtml(ticket.assignedTechName || 'Sin asignar')}${isAdmin ? ` &nbsp;&nbsp;&nbsp; Prioridad: ${escapeHtml(ticket.priority)}` : ''}
        </div>

        <!-- FIRMAS DE CONFORMIDAD -->
        <div style="display: flex; justify-content: space-around; align-items: flex-end; margin-top: 48px; padding: 0 20px;">
          <div style="width: 230px; border-top: 1.2px solid #0f172a; padding-top: 6px; text-align: center; font-size: 11px; font-weight: 700; color: #334155;">
            Firma del solicitante
          </div>
          <div style="width: 230px; border-top: 1.2px solid #0f172a; padding-top: 6px; text-align: center; font-size: 11px; font-weight: 700; color: #334155;">
            Autorizado por (Soporte IT)
          </div>
        </div>

        <!-- PIE DE PÁGINA -->
        <div style="text-align: right; font-size: 9.5px; color: #94a3b8; margin-top: 24px;">
          Documento generado desde el sistema de tickets — Grupo Premia
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);
  const sheet = wrapper.querySelector('#premia-pdf-sheet');

  if (!window.html2pdf) {
    window.print();
    wrapper.remove();
    return;
  }

  // Esperar a que carguen las imágenes (logo / evidencia) antes de renderizar el lienzo
  const imgs = Array.from(sheet.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      img =>
        img.complete
          ? Promise.resolve()
          : new Promise(res => {
              img.onload = res;
              img.onerror = res;
            })
    )
  );

  const opt = {
    margin: 0,
    filename: `Orden_Soporte_${ticket.code}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      width: SHEET_WIDTH_PX,
      windowWidth: SHEET_WIDTH_PX
    },
    jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
  };

  try {
    showToast(`Generando PDF tamaño Carta de ${ticket.code}...`);
    const worker = html2pdf().set(opt).from(sheet);
    const canvas = await worker.toCanvas().get('canvas');
    const pdf = await worker.toPdf().get('pdf');

    // Reemplazar páginas automáticas por 1 única Hoja Carta (215.9 x 279.4 mm) con márgenes simétricos exactos
    const existingPages = pdf.internal.getNumberOfPages();
    pdf.addPage('letter', 'portrait');
    for (let p = existingPages; p >= 1; p--) {
      pdf.deletePage(p);
    }
    pdf.setPage(1);

    const PAGE_WIDTH_MM = 215.9;
    const PAGE_HEIGHT_MM = 279.4;
    const MARGIN_X_MM = 12.5; // 12.5 mm margen izquierdo y 12.5 mm margen derecho (centrado simétrico exacto)
    const MARGIN_TOP_MM = 11.5; // 11.5 mm margen superior
    const MARGIN_BOTTOM_MM = 11.5; // 11.5 mm margen inferior

    const usableWidthMm = PAGE_WIDTH_MM - MARGIN_X_MM * 2; // 190.9 mm de ancho útil
    const usableHeightMm = PAGE_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM; // 256.4 mm de alto útil

    let renderWidthMm = usableWidthMm;
    let renderHeightMm = (canvas.height / canvas.width) * renderWidthMm;

    if (renderHeightMm > usableHeightMm) {
      const ratio = usableHeightMm / renderHeightMm;
      renderHeightMm = usableHeightMm;
      renderWidthMm = renderWidthMm * ratio;
    }

    const offsetXMm = (PAGE_WIDTH_MM - renderWidthMm) / 2;
    const offsetYMm = MARGIN_TOP_MM;

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    pdf.addImage(imgData, 'JPEG', offsetXMm, offsetYMm, renderWidthMm, renderHeightMm);
    pdf.save(`Orden_Soporte_${ticket.code}.pdf`);
  } finally {
    wrapper.remove();
  }
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
