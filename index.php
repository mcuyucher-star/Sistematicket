<?php
/**
 * Vista Principal del Sistema de Gestión de Tickets & Mesa de Ayuda IT
 * Arquitectura Híbrida PHP 8+ / MySQL PDO + Modern UI/UX
 * Mundi Trofeos · Tiendas Trofex · Premia
 */

require_once __DIR__ . '/config/database.php';

$pdo = Database::getConnection();
$isDbConnected = ($pdo !== null);
$serverYear = date('Y');
?>
<!DOCTYPE html>
<html lang="es">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mundi Trofeos · Tiendas Trofex · Premia - Sistema de Tickets & Mesa de Ayuda IT (PHP + MySQL)</title>
  <link rel="stylesheet" href="css/styles.css?v=<?= time() ?>">
  <!-- Lucide Icons -->
  <script src="https://unpkg.com/lucide@latest"></script>
  <!-- HTML2PDF.js for PDF Ticket Export -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
</head>

<body>

  <div class="app-container">

    <!-- ENTERPRISE NAVBAR -->
    <header class="navbar" id="navbar" style="display: none;">
      <div class="brand-section">
        <img src="logomundi.jpeg" alt="Logo Mundi Trofeos" class="brand-logo-img" onerror="this.style.display='none'">
        <div class="brand-titles">
          <h1>Mundi Trofeos · Tiendas Trofex · Premia</h1>
          <p>Sistema de Tickets & Mesa de Ayuda IT · Centroamérica</p>
        </div>
      </div>

      <!-- Live Status Badge -->
      <div class="system-status-pill">
        <span class="status-dot"></span>
        <span id="status-pill-text">Mesa de Ayuda Activa</span>
      </div>

      <div class="nav-user-controls">
        <!-- Role Switcher Nav (Oculto para separar completamente Vista Tienda y Vista Admin/IT) -->
        <div class="role-switcher-nav" id="nav-role-switcher" style="display: none;">
          <button type="button" class="nav-role-btn active" id="nbtn-solicitante" onclick="switchWorkspaceRole('solicitante')">
            <i data-lucide="life-buoy" style="width: 14px; height: 14px;"></i> Modo Solicitante / Tienda
          </button>
          <button type="button" class="nav-role-btn" id="nbtn-admin" onclick="switchWorkspaceRole('admin')">
            <i data-lucide="shield-check" style="width: 14px; height: 14px;"></i> Panel Soporte IT / Admin
          </button>
        </div>

        <!-- User Badge + Dropdown Menu (Admin, IT1, IT2) -->
        <div class="user-profile-dropdown-wrapper" id="user-profile-dropdown-wrapper">
          <div class="user-profile-badge" id="user-profile-badge" onclick="toggleUserDropdownMenu(event)">
            <div class="user-avatar-circle" id="user-avatar-text">U</div>
            <div style="display: flex; flex-direction: column;">
              <span class="user-name-text" id="user-display-name">Usuario</span>
              <span class="user-role-text" id="user-display-role">Solicitante</span>
            </div>
            <i data-lucide="chevron-down" id="user-badge-chevron" style="width: 15px; height: 15px; color: var(--text-secondary); display: none;"></i>
          </div>

          <div class="user-dropdown-menu" id="user-dropdown-menu">
            <div class="user-dropdown-header">Panel de Administración</div>
            <button type="button" class="user-dropdown-item" onclick="openStatsModal(); closeUserDropdownMenu();">
              <i data-lucide="bar-chart-3" style="width: 15px; height: 15px;"></i> Estadísticas
            </button>
            <div class="user-dropdown-header" style="margin-top: 4px; border-top: 1px solid var(--border-light); padding-top: 8px;">Gestión de Usuarios</div>
            <button type="button" class="user-dropdown-item" onclick="openNewUserModal(); closeUserDropdownMenu();">
              <i data-lucide="user-plus" style="width: 15px; height: 15px;"></i> Agregar Usuario
            </button>
            <button type="button" class="user-dropdown-item" id="menu-item-edit-users" onclick="openManageUsersModal('edit'); closeUserDropdownMenu();">
              <i data-lucide="edit-3" style="width: 15px; height: 15px;"></i> Modificar Usuarios
            </button>
            <button type="button" class="user-dropdown-item danger-item" id="menu-item-block-users" onclick="openManageUsersModal('block'); closeUserDropdownMenu();">
              <i data-lucide="lock" style="width: 15px; height: 15px;"></i> Bloquear Usuario
            </button>
          </div>
        </div>

        <!-- Logout Button -->
        <button type="button" class="btn-logout-nav" onclick="logoutSession()">
          <i data-lucide="log-out" style="width: 14px; height: 14px;"></i> Salir
        </button>
      </div>
    </header>

    <!-- MAIN WORKSPACE -->
    <main class="main-workspace">

      <!-- ===================================================================
           1. LOGIN SCREEN
           =================================================================== -->
      <section class="login-wrapper" id="login-screen">
        <div class="login-card-enterprise">
          <div class="login-brand-header">
            <img src="logomundi.jpeg" alt="Mundi Trofeos" class="login-logo-img" onerror="this.style.display='none'">
            <h2>Sistema de Tickets & Soporte IT</h2>
            <p>Mundi Trofeos · Tiendas Trofex · Premia</p>
          </div>

          <!-- MODO 1: INGRESO SOLICITANTE / TIENDA (POR DEFECTO) -->
          <div id="login-solicitante-box">
            <form id="form-login" onsubmit="handleLoginSubmit(event)" style="display: flex; flex-direction: column; gap: 16px;">
              <div class="form-field">
                <label class="form-label-custom" id="lbl-login-user">Seleccionar Usuario / Encargado de Tienda</label>
                <select class="form-select-custom" id="login-user-select" onchange="updateLoginBranchPreview()"></select>
              </div>

              <div id="login-branch-preview" style="background: var(--bg-card-subtle); border: 1px solid var(--border-light); padding: 10px 14px; border-radius: 8px; font-size: 12px; color: var(--text-secondary); font-weight: 600;">
                Sucursal: <strong id="preview-branch-name" style="color: var(--text-primary);">—</strong>
              </div>

              <div class="form-field">
                <label class="form-label-custom">Contraseña *</label>
                <input type="password" class="form-input-custom" id="login-store-pass" required placeholder="Ingresa tu contraseña de sucursal" autocomplete="current-password">
              </div>

              <button type="submit" class="btn-primary-lg">
                <i data-lucide="log-in" style="width: 18px; height: 18px;"></i> Ingresar al Sistema de Tickets
              </button>

              <div class="admin-login-footer">
                <button type="button" class="btn-link-admin-mode" onclick="toggleAdminLoginMode(true)">
                  <i data-lucide="shield-check" style="width: 15px; height: 15px;"></i> Ingresar modo Admin
                </button>
              </div>
            </form>
          </div>

          <!-- MODO 2: FORMULARIO DE ACCESO ADMIN (USUARIO Y CONTRASEÑA) -->
          <div id="login-admin-box" style="display: none;">
            <form id="form-login-admin" onsubmit="handleAdminLoginSubmit(event)" style="display: flex; flex-direction: column; gap: 15px;">
              <div class="admin-mode-banner">
                <i data-lucide="lock" style="width: 16px; height: 16px;"></i>
                <span>Acceso Exclusivo Soporte IT / Administrador</span>
              </div>

              <div class="form-field">
                <label class="form-label-custom">Usuario Admin / Soporte IT *</label>
                <select class="form-select-custom" id="login-admin-user" required>
                  <option value="t1">Maynor Cuyuche (Administrador General)</option>
                  <option value="t2">IT1 (Soporte IT)</option>
                  <option value="t3">IT2 (Soporte IT)</option>
                </select>
              </div>

              <div class="form-field">
                <label class="form-label-custom">Contraseña *</label>
                <input type="password" class="form-input-custom" id="login-admin-pass" required placeholder="Ingresa tu contraseña" autocomplete="current-password">
              </div>

              <button type="submit" class="btn-primary-lg">
                <i data-lucide="shield-check" style="width: 18px; height: 18px;"></i> Iniciar Sesión como Admin
              </button>

              <div class="admin-login-footer">
                <button type="button" class="btn-link-admin-mode" onclick="toggleAdminLoginMode(false)">
                  <i data-lucide="arrow-left" style="width: 15px; height: 15px;"></i> Volver a ingreso de Solicitante / Tienda
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <!-- ===================================================================
           2. DASHBOARD & TICKET SYSTEM (SOLICITANTE + ADMIN IT)
           =================================================================== -->
      <section id="app-dashboard" style="display: none;">

        <!-- INTERACTIVE KPI SUMMARY CARDS -->
        <div class="kpi-grid">
          <div class="kpi-card clickable active-kpi" data-qtab="ALL" onclick="setQuickTabFilter('ALL')" title="Haz clic para ver todos los tickets">
            <div class="kpi-info">
              <span>Total Tickets</span>
              <h3 id="kpi-total">0</h3>
              <p>Registrados en plataforma</p>
            </div>
            <div class="kpi-icon-box" style="background: var(--primary-light); color: var(--primary);">
              <i data-lucide="ticket" style="width: 24px; height: 24px;"></i>
            </div>
          </div>

          <div class="kpi-card clickable" data-qtab="OPEN" onclick="setQuickTabFilter('OPEN')" title="Haz clic para filtrar tickets abiertos">
            <div class="kpi-info">
              <span>Abiertos / Pendientes</span>
              <h3 id="kpi-open" style="color: var(--blue);">0</h3>
              <p>Requieren atención inicial</p>
            </div>
            <div class="kpi-icon-box" style="background: var(--blue-bg); color: var(--blue);">
              <i data-lucide="clock" style="width: 24px; height: 24px;"></i>
            </div>
          </div>

          <div class="kpi-card clickable" data-qtab="PROGRESS" onclick="setQuickTabFilter('PROGRESS')" title="Haz clic para filtrar tickets en proceso">
            <div class="kpi-info">
              <span>En Proceso / Soporte</span>
              <h3 id="kpi-progress" style="color: var(--amber);">0</h3>
              <p>Asignados a técnico IT</p>
            </div>
            <div class="kpi-icon-box" style="background: var(--amber-bg); color: var(--amber);">
              <i data-lucide="wrench" style="width: 24px; height: 24px;"></i>
            </div>
          </div>

          <div class="kpi-card clickable" id="kpi-card-critical" data-qtab="CRITICAL" onclick="setQuickTabFilter('CRITICAL')" title="Haz clic para filtrar tickets críticos activos" style="display: none;">
            <div class="kpi-info">
              <span>Prioridad Crítica</span>
              <h3 id="kpi-critical" style="color: var(--rose);">0</h3>
              <p>Urgencia alta en tiendas</p>
            </div>
            <div class="kpi-icon-box" style="background: var(--rose-bg); color: var(--rose);">
              <i data-lucide="flame" style="width: 24px; height: 24px;"></i>
            </div>
          </div>

          <div class="kpi-card clickable" data-qtab="RESOLVED" onclick="setQuickTabFilter('RESOLVED')" title="Haz clic para filtrar tickets resueltos">
            <div class="kpi-info">
              <span>Resueltos / Cerrados</span>
              <h3 id="kpi-resolved" style="color: var(--emerald);">0</h3>
              <p>Incidencias solucionadas</p>
            </div>
            <div class="kpi-icon-box" style="background: var(--emerald-bg); color: var(--emerald);">
              <i data-lucide="check-circle-2" style="width: 24px; height: 24px;"></i>
            </div>
          </div>
        </div>

        <!-- MAIN WORKSPACE GRID -->
        <div class="workspace-grid" id="main-workspace-grid">

          <!-- LEFT PANEL: CREATE NEW TICKET -->
          <div class="card-panel" id="panel-new-ticket">
            <div class="card-header">
              <div class="card-header-title">
                <div style="width: 36px; height: 36px; border-radius: 10px; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center;">
                  <i data-lucide="plus-circle" style="width: 20px; height: 20px;"></i>
                </div>
                <div>
                  <h3>Nuevo Ticket de Soporte</h3>
                  <p>Reportar falla, equipo o requerimiento</p>
                </div>
              </div>
            </div>

            <div class="card-body">
              <form id="form-new-ticket" onsubmit="handleCreateTicket(event)" style="display: flex; flex-direction: column; gap: 14px;">

                <div class="form-field">
                  <label class="form-label-custom">Asunto / Título del Problema *</label>
                  <input type="text" class="form-input-custom" id="tkt-title" required placeholder="Ej. Impresora de facturación no imprime en Caja 1">
                </div>

                <div class="form-field" id="form-group-category">
                  <label class="form-label-custom">Tipo de Gestión / Problema *</label>
                  <select class="form-select-custom" id="tkt-category" required>
                    <option value="cat_imp">Impresoras</option>
                    <option value="cat_red">Red</option>
                    <option value="cat_inst">Instalación de Equipos</option>
                    <option value="cat_mant">Mantenimiento y Respaldo de Datos</option>
                    <option value="cat_comp">Compras de Nuevos Equipos</option>
                  </select>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div class="form-field">
                    <label class="form-label-custom">País *</label>
                    <input type="text" class="form-input-custom" id="tkt-country" readonly required style="background: var(--bg-card-subtle); font-weight: 700; color: var(--text-primary); cursor: not-allowed;">
                  </div>

                  <div class="form-field">
                    <label class="form-label-custom">Sucursal / Tienda *</label>
                    <input type="text" class="form-input-custom" id="tkt-branch" readonly required style="background: var(--bg-card-subtle); font-weight: 700; color: var(--text-primary); cursor: not-allowed;">
                  </div>
                </div>

                <div class="form-field">
                  <label class="form-label-custom" id="lbl-tkt-asset">AnyDesk</label>
                  <input type="text" class="form-input-custom" id="tkt-asset" placeholder="Ej. 123 456 789">
                </div>

                <div class="form-field" id="form-group-priority" style="display: none;">
                  <label class="form-label-custom">Nivel de Prioridad *</label>
                  <input type="hidden" id="tkt-priority" value="Media">
                  <div class="priority-selector-grid">
                    <button type="button" class="priority-option-btn" data-priority="Baja" onclick="selectPriority('Baja')">Baja</button>
                    <button type="button" class="priority-option-btn active" data-priority="Media" onclick="selectPriority('Media')">Media</button>
                    <button type="button" class="priority-option-btn" data-priority="Alta" onclick="selectPriority('Alta')">Alta</button>
                    <button type="button" class="priority-option-btn" data-priority="Crítica" onclick="selectPriority('Crítica')">Crítica</button>
                  </div>
                </div>

                <div class="form-field">
                  <label class="form-label-custom">Descripción Detallada de la Incidencia *</label>
                  <textarea class="form-textarea-custom" id="tkt-description" required placeholder="Describe qué ocurrió, mensajes de error en pantalla y desde qué hora se presenta el inconveniente..."></textarea>
                </div>

                <div class="form-field">
                  <label class="form-label-custom">Foto o Captura de Evidencia (Opcional)</label>
                  <label class="upload-zone" for="tkt-attachment">
                    <input type="file" id="tkt-attachment" accept="image/*" style="display: none;" onchange="handleAttachmentPreview(event)">
                    <i data-lucide="camera" style="width: 22px; height: 22px; color: var(--primary); margin-bottom: 4px;"></i>
                    <div style="font-size: 12px; font-weight: 700; color: var(--text-primary);">Haz clic para adjuntar foto o captura de pantalla</div>
                    <div style="font-size: 11px; color: var(--text-muted);">Formatos JPG, PNG · Tamaño máximo 10 MB</div>
                  </label>
                  <div id="tkt-attachment-preview-box" style="display: none; margin-top: 8px; position: relative;">
                    <img id="tkt-attachment-img" src="" alt="Vista previa" style="width: 100%; max-height: 160px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-light);">
                    <button type="button" onclick="clearAttachment()" style="position: absolute; top: 8px; right: 8px; background: rgba(15,23,42,0.8); color: #fff; border: none; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 700; cursor: pointer;">Quitar</button>
                  </div>
                </div>

                <button type="submit" class="btn-primary-lg" style="margin-top: 4px;">
                  <i data-lucide="send" style="width: 17px; height: 17px;"></i> Generar Ticket de Soporte
                </button>
              </form>
            </div>
          </div>

          <!-- RIGHT PANEL: TICKETS LIST & KANBAN MANAGEMENT -->
          <div class="card-panel">
            <div class="card-header">
              <div class="card-header-title">
                <div style="width: 36px; height: 36px; border-radius: 10px; background: var(--blue-bg); color: var(--blue); display: flex; align-items: center; justify-content: center;">
                  <i data-lucide="layers" style="width: 20px; height: 20px;"></i>
                </div>
                <div>
                  <h3 id="list-panel-title">Bandeja de Tickets e Incidencias</h3>
                  <p id="list-panel-subtitle">Seguimiento en tiempo real de solicitudes de soporte</p>
                </div>
              </div>

              <div id="admin-header-actions" style="display: none; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="btn-secondary-custom" id="btn-admin-add-user" onclick="openNewUserModal()" title="Registrar nuevo usuario de Guatemala o Centroamérica">
                  <i data-lucide="user-plus" style="width: 14px; height: 14px;"></i> Agregar Usuario
                </button>
                <button type="button" class="btn-secondary-custom" onclick="syncFromServer(true)" title="Actualizar bandeja de tickets">
                  <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> Actualizar
                </button>
                <button type="button" class="btn-secondary-custom" onclick="exportTicketsCSV()">
                  <i data-lucide="download" style="width: 15px; height: 15px;"></i> Exportar CSV
                </button>
              </div>
            </div>

            <div class="card-body">
              <!-- UX QUICK TABS & VIEW MODE SWITCHER -->
              <div class="toolbar-ux-row">
                <div class="quick-tabs-bar">
                  <button type="button" class="quick-tab-btn active" data-qtab="ALL" onclick="setQuickTabFilter('ALL')">
                    Todos <span class="quick-tab-count" id="qcount-all">0</span>
                  </button>
                  <button type="button" class="quick-tab-btn" data-qtab="OPEN" onclick="setQuickTabFilter('OPEN')">
                    Abiertos <span class="quick-tab-count" id="qcount-open">0</span>
                  </button>
                  <button type="button" class="quick-tab-btn" data-qtab="PROGRESS" onclick="setQuickTabFilter('PROGRESS')">
                    En Proceso <span class="quick-tab-count" id="qcount-progress">0</span>
                  </button>
                  <button type="button" class="quick-tab-btn" id="qtab-btn-critical" data-qtab="CRITICAL" onclick="setQuickTabFilter('CRITICAL')" style="display: none;">
                    Críticos <span class="quick-tab-count" id="qcount-critical">0</span>
                  </button>
                  <button type="button" class="quick-tab-btn" data-qtab="RESOLVED" onclick="setQuickTabFilter('RESOLVED')">
                    Resueltos <span class="quick-tab-count" id="qcount-resolved">0</span>
                  </button>
                </div>

                <div class="view-switcher-bar" id="admin-view-switcher" style="display: none;">
                  <button type="button" class="view-mode-btn active" id="btn-view-table" onclick="switchViewMode('table')">
                    <i data-lucide="table-2" style="width: 14px; height: 14px;"></i> Tabla
                  </button>
                  <button type="button" class="view-mode-btn" id="btn-view-kanban" onclick="switchViewMode('kanban')">
                    <i data-lucide="kanban" style="width: 14px; height: 14px;"></i> Tablero Kanban
                  </button>
                </div>
              </div>

              <!-- FILTER BAR -->
              <div class="filter-bar">
                <input type="text" class="form-input-custom" id="filter-search" placeholder="Buscar por número de ticket (TKT-...)..." oninput="renderTicketsView()" style="flex: 2; min-width: 220px;">

                <select class="form-select-custom" id="filter-status" onchange="renderTicketsView()" style="display: none; flex: 1; min-width: 150px;">
                  <option value="ALL">Todos los Estados</option>
                  <option value="Abierto">Abierto</option>
                  <option value="En Proceso">En Proceso</option>
                  <option value="En Espera">En Espera</option>
                  <option value="Resuelto">Resuelto</option>
                  <option value="Cerrado">Cerrado</option>
                </select>

                <select class="form-select-custom" id="filter-priority" onchange="renderTicketsView()" style="display: none; flex: 1; min-width: 140px;">
                  <option value="ALL">Toda Prioridad</option>
                  <option value="Crítica">Crítica</option>
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>

                <select class="form-select-custom" id="filter-category" onchange="renderTicketsView()" style="display: none; flex: 1; min-width: 170px;">
                  <option value="ALL">Todas las Categorías</option>
                </select>
              </div>

              <!-- VIEW 1: ENTERPRISE TABLE -->
              <div class="table-responsive" id="tickets-table-wrapper">
                <table class="enterprise-table">
                  <thead>
                    <tr>
                      <th>Código / SLA</th>
                      <th>Asunto & Categoría</th>
                      <th>Sucursal / Solicitante</th>
                      <th id="th-priority-col" style="display: none;">Prioridad</th>
                      <th>Estado</th>
                      <th>Técnico Asignado</th>
                      <th style="text-align: right;">Acción</th>
                    </tr>
                  </thead>
                  <tbody id="tickets-tbody"></tbody>
                </table>
              </div>

              <!-- VIEW 2: KANBAN BOARD -->
              <div id="tickets-kanban-wrapper" style="display: none;">
                <div class="kanban-board" id="kanban-board-container"></div>
              </div>
            </div>
          </div>

        </div>
      </section>

    </main>

    <!-- ===================================================================
         MODAL: TICKET DETAILS, COMMENTS & ADMIN RESOLUTION
         =================================================================== -->
    <div class="modal-backdrop" id="modal-ticket-detail">
      <div class="modal-dialog">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="badge badge-status-abierto" id="mdl-code-badge" style="font-size: 13px; padding: 6px 12px;">TKT-000</span>
            <h3 id="mdl-title" style="font-size: 17px; font-weight: 800;">Detalle del Ticket</h3>
          </div>
          <button type="button" class="btn-secondary-custom" onclick="closeTicketModal()" style="padding: 6px 10px;">✕</button>
        </div>

        <div class="modal-body" id="printable-ticket-area">
          <!-- Ticket Metadata Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; background: var(--bg-card-subtle); padding: 14px; border-radius: 12px; border: 1px solid var(--border-light); margin-bottom: 16px;">
            <div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Solicitante</div>
              <div id="mdl-requester" style="font-size: 13px; font-weight: 800;">—</div>
              <div id="mdl-contact" style="font-size: 11px; color: var(--text-secondary);">—</div>
            </div>
            <div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Sucursal / País</div>
              <div id="mdl-branch" style="font-size: 13px; font-weight: 800;">—</div>
              <div id="mdl-country" style="font-size: 11px; color: var(--text-secondary);">—</div>
            </div>
            <div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Categoría & Equipo</div>
              <div id="mdl-category" style="font-size: 13px; font-weight: 800;">—</div>
              <div id="mdl-asset" style="font-size: 11px; color: var(--text-secondary);">—</div>
            </div>
            <div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Fecha Reporte & SLA</div>
              <div id="mdl-date" style="font-size: 13px; font-weight: 800;">—</div>
              <div id="mdl-priority-badge" style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center;"></div>
            </div>
          </div>

          <!-- Description -->
          <div style="margin-bottom: 16px;">
            <label class="form-label-custom">Descripción Reportada</label>
            <div id="mdl-description" style="background: #fff; border: 1px solid var(--border-light); border-radius: 10px; padding: 12px 14px; font-size: 13.5px; margin-top: 6px; white-space: pre-wrap;"></div>
          </div>

          <!-- Evidence Image if attached -->
          <div id="mdl-evidence-container" style="display: none; margin-bottom: 16px;">
            <label class="form-label-custom">Evidencia Fotográfica Adjunta</label>
            <div style="margin-top: 6px;">
              <img id="mdl-evidence-img" src="" alt="Evidencia del ticket" style="max-width: 100%; max-height: 260px; border-radius: 10px; border: 1px solid var(--border-light); object-fit: contain;">
            </div>
          </div>

          <!-- ADMIN / IT MANAGEMENT CONTROLS -->
          <div id="mdl-admin-controls" style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 12px; padding: 16px; margin-bottom: 18px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 8px; color: var(--primary); font-weight: 800; font-size: 13px;">
                <i data-lucide="sliders" style="width: 16px; height: 16px;"></i> Gestión Técnica del Ticket (Soporte IT)
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <button type="button" class="btn-secondary-custom" id="btn-modal-claim-ticket" onclick="claimTicket(activeModalTicketId)" style="padding: 6px 12px; font-size: 12px; background: #10b981; color: #ffffff; border-color: #059669; font-weight: 800;">
                  <i data-lucide="hand" style="width: 14px; height: 14px;"></i> Tomar Ticket
                </button>
                <button type="button" class="btn-secondary-custom" id="btn-modal-release-ticket" onclick="releaseTicket(activeModalTicketId)" style="padding: 6px 12px; font-size: 12px; background: #fffbeb; color: #b45309; border-color: #fde68a; font-weight: 800; display: none;">
                  <i data-lucide="user-minus" style="width: 14px; height: 14px;"></i> Dejar Ticket
                </button>
                <button type="button" class="btn-secondary-custom" id="btn-modal-reopen-ticket" onclick="reopenTicketByMainAdmin(activeModalTicketId)" style="padding: 6px 12px; font-size: 12px; background: #eef2ff; color: #4338ca; border-color: #a5b4fc; font-weight: 800; display: none;">
                  <i data-lucide="rotate-ccw" style="width: 14px; height: 14px;"></i> Reabrir Ticket
                </button>
                <span id="mdl-locked-banner" style="display: none; align-items: center; gap: 5px; padding: 6px 11px; font-size: 12px; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 800;"></span>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px;">
              <div class="form-field">
                <label class="form-label-custom">Estado del Ticket</label>
                <select class="form-select-custom" id="mdl-status-select">
                  <option value="Abierto">Abierto</option>
                  <option value="En Proceso">En Proceso</option>
                  <option value="En Espera">En Espera (Repuesto / Proveedor)</option>
                  <option value="Resuelto">Resuelto</option>
                  <option value="Cerrado">Cerrado</option>
                </select>
              </div>

              <div class="form-field">
                <label class="form-label-custom">Técnico Responsable</label>
                <select class="form-select-custom" id="mdl-tech-select"></select>
              </div>

              <div class="form-field">
                <label class="form-label-custom">Prioridad</label>
                <select class="form-select-custom" id="mdl-prio-select">
                  <option value="Baja">Baja</option>
                  <option value="Media">Media</option>
                  <option value="Alta">Alta</option>
                  <option value="Crítica">Crítica</option>
                </select>
              </div>
            </div>

            <div class="form-field">
              <label class="form-label-custom">Diagnóstico Técnico / Notas de Resolución</label>
              <textarea class="form-textarea-custom" id="mdl-resolution-notes" style="min-height: 70px;" placeholder="Documenta la solución aplicada, cambio de repuesto o configuración realizada..."></textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
              <button type="button" class="btn-primary-lg" id="btn-save-admin-changes" onclick="saveTicketAdminChanges()" style="width: auto; padding: 9px 18px; font-size: 13px;">
                <i data-lucide="save" style="width: 15px; height: 16px;"></i> Guardar Cambios de Soporte
              </button>
            </div>
          </div>

          <!-- FOLLOW-UP COMMENTS TIMELINE -->
          <div>
            <label class="form-label-custom">Bitácora de Seguimiento y Comentarios</label>
            <div class="comments-box" id="mdl-comments-list" style="margin-top: 6px;"></div>

            <div id="mdl-comment-input-row" style="display: flex; gap: 8px; margin-top: 10px;">
              <input type="text" class="form-input-custom" id="mdl-new-comment" placeholder="Escribe un comentario o actualización (presiona Enter para enviar)...">
              <button type="button" class="btn-secondary-custom" id="btn-send-comment" onclick="addTicketComment()" style="white-space: nowrap; background: var(--dark-slate); color: #fff; border-color: var(--dark-slate);">
                <i data-lucide="message-square-plus" style="width: 15px; height: 15px;"></i> Enviar
              </button>
            </div>
            <div id="mdl-comment-closed-notice" style="display: none; align-items: center; gap: 8px; margin-top: 10px; padding: 10px 14px; border-radius: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; font-size: 12.5px; font-weight: 700;">
              <i data-lucide="lock" style="width: 15px; height: 15px; color: #64748b; flex-shrink: 0;"></i>
              <span id="mdl-comment-closed-text">Este ticket ya fue finalizado y cerrado para nuevos comentarios. Solo el Administrador General puede reabrirlo.</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-secondary-custom" id="btn-delete-ticket" onclick="deleteCurrentTicket()" style="color: #e11d48; border-color: #fecdd3; background: #fff1f2;">
            <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i> Eliminar Ticket
          </button>

          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-secondary-custom" onclick="downloadTicketPDF()">
              <i data-lucide="file-text" style="width: 15px; height: 15px;"></i> Descargar Orden PDF
            </button>
            <button type="button" class="btn-secondary-custom" onclick="closeTicketModal()">Cerrar Ventana (Esc)</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===================================================================
         MODAL: REGISTRAR O MODIFICAR USUARIO (GUATEMALA & CENTROAMÉRICA)
         =================================================================== -->
    <div class="modal-backdrop" id="modal-new-user">
      <div class="modal-dialog" style="max-width: 600px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 34px; height: 34px; border-radius: 10px; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center;">
              <i data-lucide="user-plus" style="width: 18px; height: 18px;"></i>
            </div>
            <h3 id="modal-user-form-title" style="font-size: 16px; font-weight: 800;">Registrar Usuario / Encargado de Tienda</h3>
          </div>
          <button type="button" class="btn-secondary-custom" onclick="closeNewUserModal()" style="padding: 6px 10px;">✕</button>
        </div>

        <form id="form-new-user" onsubmit="handleCreateUserSubmit(event)">
          <input type="hidden" id="nu-edit-id" value="">
          <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px; max-height: 75vh; overflow-y: auto;">
            <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 10px;">
              <div class="form-field">
                <label class="form-label-custom">Nombre del Usuario / Tienda *</label>
                <input type="text" class="form-input-custom" id="nu-name" required placeholder="Ej. TRX Coban o IT3">
              </div>

              <div class="form-field">
                <label class="form-label-custom">Rol en el Sistema *</label>
                <select class="form-select-custom" id="nu-role" onchange="handleNewUserRoleChange()">
                  <option value="solicitante">Tienda / Sucursal</option>
                  <option value="soporte_it">Soporte Técnico IT</option>
                  <option value="admin_general">Administrador General</option>
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-field">
                <label class="form-label-custom">País *</label>
                <select class="form-select-custom" id="nu-country" required onchange="handleNewUserCountryChange()">
                  <option value="Guatemala">Guatemala</option>
                  <option value="El Salvador">El Salvador</option>
                  <option value="Honduras">Honduras</option>
                  <option value="Nicaragua">Nicaragua</option>
                  <option value="Costa Rica">Costa Rica</option>
                  <option value="Belice">Belice</option>
                </select>
              </div>

              <div class="form-field">
                <label class="form-label-custom">Sucursal / Área *</label>
                <select class="form-select-custom" id="nu-branch" required></select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 0.8fr; gap: 10px;">
              <div class="form-field">
                <label class="form-label-custom">Correo Electrónico</label>
                <input type="email" class="form-input-custom" id="nu-email" placeholder="usuario@tiendastrofex.com">
              </div>

              <div class="form-field">
                <label class="form-label-custom">Teléfono</label>
                <input type="text" class="form-input-custom" id="nu-phone" placeholder="+502 0000-0000">
              </div>

              <div class="form-field">
                <label class="form-label-custom">Contraseña *</label>
                <input type="text" class="form-input-custom" id="nu-pin" required value="1" placeholder="1">
              </div>
            </div>

            <!-- PANEL DE ADMINISTRACIÓN DE ROL Y ACCIONES PERMITIDAS -->
            <div id="nu-permissions-box" style="background: #f8fafc; border: 1px solid var(--border-light); border-radius: 12px; padding: 14px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 7px;">
                  <i data-lucide="shield-check" style="width: 16px; height: 16px; color: var(--primary);"></i>
                  <span style="font-size: 12.5px; font-weight: 800; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.03em;">
                    Acciones Permitidas en el Sistema
                  </span>
                </div>
                <span id="nu-permissions-summary-badge" style="font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: var(--primary-light); color: var(--primary);">
                  Permisos según Rol
                </span>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #ffffff; border: 1px solid var(--border-light); border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text-primary); cursor: pointer;">
                  <input type="checkbox" id="perm-create_tickets" onchange="updatePermissionsSummaryBadge()" style="width: 15px; height: 15px; accent-color: var(--primary);">
                  <span>Crear tickets de soporte</span>
                </label>

                <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #ffffff; border: 1px solid var(--border-light); border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text-primary); cursor: pointer;">
                  <input type="checkbox" id="perm-attend_tickets" onchange="updatePermissionsSummaryBadge()" style="width: 15px; height: 15px; accent-color: var(--primary);">
                  <span>Tomar / Dejar tickets y estados</span>
                </label>

                <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #ffffff; border: 1px solid var(--border-light); border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text-primary); cursor: pointer;">
                  <input type="checkbox" id="perm-change_priority" onchange="updatePermissionsSummaryBadge()" style="width: 15px; height: 15px; accent-color: var(--primary);">
                  <span>Cambiar prioridad de tickets</span>
                </label>

                <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #ffffff; border: 1px solid var(--border-light); border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text-primary); cursor: pointer;">
                  <input type="checkbox" id="perm-delete_tickets" onchange="updatePermissionsSummaryBadge()" style="width: 15px; height: 15px; accent-color: var(--primary);">
                  <span>Eliminar tickets del sistema</span>
                </label>

                <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #ffffff; border: 1px solid var(--border-light); border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text-primary); cursor: pointer;">
                  <input type="checkbox" id="perm-export_reports" onchange="updatePermissionsSummaryBadge()" style="width: 15px; height: 15px; accent-color: var(--primary);">
                  <span>Descargar PDF y exportar Excel</span>
                </label>

                <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #ffffff; border: 1px solid var(--border-light); border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text-primary); cursor: pointer;">
                  <input type="checkbox" id="perm-view_stats" onchange="updatePermissionsSummaryBadge()" style="width: 15px; height: 15px; accent-color: var(--primary);">
                  <span>Ver panel de Estadísticas IT</span>
                </label>

                <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #ffffff; border: 1px solid var(--border-light); border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text-primary); cursor: pointer;">
                  <input type="checkbox" id="perm-create_users" onchange="updatePermissionsSummaryBadge()" style="width: 15px; height: 15px; accent-color: var(--primary);">
                  <span>Agregar nuevos usuarios</span>
                </label>

                <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #ffffff; border: 1px solid var(--border-light); border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text-primary); cursor: pointer;">
                  <input type="checkbox" id="perm-manage_users" onchange="updatePermissionsSummaryBadge()" style="width: 15px; height: 15px; accent-color: var(--primary);">
                  <span>Modificar y bloquear usuarios</span>
                </label>
              </div>
              <div id="nu-permissions-note" style="font-size: 11px; color: var(--text-muted); margin-top: 8px; font-weight: 500;">
                Al cambiar el rol se marcan sus permisos predeterminados. El Administrador General puede personalizar cada acción.
              </div>
            </div>
          </div>

          <div class="modal-footer" style="justify-content: flex-end;">
            <button type="button" class="btn-secondary-custom" onclick="closeNewUserModal()">Cancelar</button>
            <button type="submit" class="btn-primary-lg" style="width: auto; padding: 10px 20px;">
              <i data-lucide="check" style="width: 16px; height: 16px;"></i> Guardar Usuario y Permisos
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ===================================================================
         MODAL: GESTIÓN DE USUARIOS (MODIFICAR O ELIMINAR)
         =================================================================== -->
    <div class="modal-backdrop" id="modal-manage-users">
      <div class="modal-dialog" style="max-width: 860px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 34px; height: 34px; border-radius: 10px; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center;">
              <i data-lucide="users" style="width: 18px; height: 18px;"></i>
            </div>
            <div>
              <h3 id="modal-manage-users-title" style="font-size: 16px; font-weight: 800;">Gestión de Usuarios, Roles y Permisos</h3>
              <p id="modal-manage-users-subtitle" style="font-size: 12px; color: var(--text-secondary);">Administra roles, acciones permitidas y accesos de tiendas y Soporte IT</p>
            </div>
          </div>
          <button type="button" class="btn-secondary-custom" onclick="closeManageUsersModal()" style="padding: 6px 10px;">✕</button>
        </div>

        <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <input type="text" class="form-input-custom" id="manage-users-search" placeholder="Buscar usuario por nombre, sucursal o país..." oninput="renderManageUsersTable()" style="flex: 1; min-width: 220px;">
            <button type="button" class="btn-primary-lg" onclick="closeManageUsersModal(); openNewUserModal();" style="width: auto; padding: 9px 16px; font-size: 12.5px;">
              <i data-lucide="user-plus" style="width: 15px; height: 15px;"></i> + Agregar Nuevo Usuario
            </button>
          </div>

          <div class="table-responsive" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border-light); border-radius: 10px;">
            <table class="enterprise-table">
              <thead>
                <tr>
                  <th>Usuario / Perfil</th>
                  <th>Sucursal & País</th>
                  <th>Rol & Acciones Permitidas</th>
                  <th>Contraseña</th>
                  <th style="text-align: right;">Acciones</th>
                </tr>
              </thead>
              <tbody id="manage-users-tbody"></tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer" style="justify-content: flex-end;">
          <button type="button" class="btn-secondary-custom" onclick="closeManageUsersModal()">Cerrar</button>
        </div>
      </div>
    </div>

    <!-- ===================================================================
         MODAL: ESTADÍSTICAS Y RENDIMIENTO DE SOPORTE IT
         =================================================================== -->
    <div class="modal-backdrop" id="modal-admin-stats">
      <div class="modal-dialog" style="max-width: 760px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: var(--emerald-bg); color: var(--emerald); display: flex; align-items: center; justify-content: center;">
              <i data-lucide="bar-chart-3" style="width: 20px; height: 20px;"></i>
            </div>
            <div>
              <h3 style="font-size: 16.5px; font-weight: 800;">Estadísticas de Tickets Resueltos</h3>
              <p style="font-size: 12px; color: var(--text-secondary);">Comparativa de productividad y tickets solucionados por integrante de Soporte IT</p>
            </div>
          </div>
          <button type="button" class="btn-secondary-custom" onclick="closeStatsModal()" style="padding: 6px 10px;">✕</button>
        </div>

        <div class="modal-body" id="stats-modal-body" style="display: flex; flex-direction: column; gap: 18px;"></div>

        <div class="modal-footer" style="justify-content: flex-end;">
          <button type="button" class="btn-secondary-custom" onclick="closeStatsModal()">Cerrar</button>
        </div>
      </div>
    </div>

    <!-- TOAST CONTAINER -->
    <div class="toast-stack" id="toast-container"></div>

  </div>

  <script src="js/data.js?v=<?= time() ?>"></script>
  <script src="js/app.js?v=<?= time() ?>"></script>
</body>

</html>

