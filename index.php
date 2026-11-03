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
  <link rel="stylesheet" href="css/styles.css?v=2.0">
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

      <!-- Live Status & PHP/MySQL Connection Badges -->
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
        <div class="system-status-pill">
          <span class="status-dot"></span>
          <span id="status-pill-text">Mesa de Ayuda Activa</span>
        </div>

        <div class="db-sync-pill <?php echo $isDbConnected ? 'online' : 'offline'; ?>" id="db-status-pill" title="Estado del motor de base de datos MySQL en XAMPP">
          <i data-lucide="database" style="width: 13px; height: 13px;"></i>
          <span id="db-status-text"><?php echo $isDbConnected ? 'PHP + MySQL Conectado' : 'Modo Local (Sin MySQL)'; ?></span>
        </div>
      </div>

      <div class="nav-user-controls">
        <!-- Role Switcher Nav -->
        <div class="role-switcher-nav" id="nav-role-switcher">
          <button type="button" class="nav-role-btn active" id="nbtn-solicitante" onclick="switchWorkspaceRole('solicitante')">
            <i data-lucide="life-buoy" style="width: 14px; height: 14px;"></i> Modo Solicitante / Tienda
          </button>
          <button type="button" class="nav-role-btn" id="nbtn-admin" onclick="switchWorkspaceRole('admin')">
            <i data-lucide="shield-check" style="width: 14px; height: 14px;"></i> Panel Soporte IT / Admin
          </button>
        </div>

        <!-- User Badge -->
        <div class="user-profile-badge">
          <div class="user-avatar-circle" id="user-avatar-text">U</div>
          <div style="display: flex; flex-direction: column;">
            <span class="user-name-text" id="user-display-name">Usuario</span>
            <span class="user-role-text" id="user-display-role">Solicitante</span>
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
            <div style="margin-top: 10px;">
              <span class="db-sync-pill <?php echo $isDbConnected ? 'online' : 'offline'; ?>">
                <i data-lucide="server" style="width: 12px; height: 12px;"></i>
                <?php echo $isDbConnected ? 'Motor PHP ' . PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . ' + MySQL Activo' : 'Modo Respaldo Local'; ?>
              </span>
            </div>
          </div>

          <!-- Role Selector -->
          <div class="login-role-tabs">
            <button type="button" class="role-tab-item active" id="tab-login-solicitante" onclick="switchLoginTab('solicitante')">
              <i data-lucide="store" style="width: 16px; height: 16px;"></i> Solicitante / Tienda
            </button>
            <button type="button" class="role-tab-item" id="tab-login-admin" onclick="switchLoginTab('admin')">
              <i data-lucide="cpu" style="width: 16px; height: 16px;"></i> Soporte IT / Admin
            </button>
          </div>

          <form id="form-login" onsubmit="handleLoginSubmit(event)" style="display: flex; flex-direction: column; gap: 16px;">
            <div class="form-field">
              <label class="form-label-custom" id="lbl-login-user">Seleccionar Usuario / Encargado de Tienda</label>
              <select class="form-select-custom" id="login-user-select" onchange="updateLoginBranchPreview()"></select>
            </div>

            <div id="login-branch-preview" style="background: var(--bg-card-subtle); border: 1px solid var(--border-light); padding: 10px 14px; border-radius: 8px; font-size: 12px; color: var(--text-secondary); font-weight: 600;">
              Sucursal: <strong id="preview-branch-name" style="color: var(--text-primary);">—</strong>
            </div>

            <div class="form-field" id="group-admin-pin" style="display: none;">
              <label class="form-label-custom">Contraseña / PIN de Soporte IT</label>
              <input type="password" class="form-input-custom" id="login-pin-input" placeholder="Ingresa admin123 (o deja vacío en demo)">
            </div>

            <button type="submit" class="btn-primary-lg">
              <i data-lucide="log-in" style="width: 18px; height: 18px;"></i> Ingresar al Sistema de Tickets
            </button>
          </form>
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

          <div class="kpi-card clickable" data-qtab="CRITICAL" onclick="setQuickTabFilter('CRITICAL')" title="Haz clic para filtrar tickets críticos activos">
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
        <div class="workspace-grid">

          <!-- LEFT PANEL: CREATE NEW TICKET -->
          <div class="card-panel">
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

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div class="form-field">
                    <label class="form-label-custom">Categoría (SLA) *</label>
                    <select class="form-select-custom" id="tkt-category" required></select>
                  </div>

                  <div class="form-field">
                    <label class="form-label-custom">País *</label>
                    <select class="form-select-custom" id="tkt-country" required>
                      <option value="Guatemala">Guatemala</option>
                      <option value="El Salvador">El Salvador</option>
                      <option value="Honduras">Honduras</option>
                      <option value="Nicaragua">Nicaragua</option>
                      <option value="Costa Rica">Costa Rica</option>
                    </select>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div class="form-field">
                    <label class="form-label-custom">Sucursal / Tienda / Área *</label>
                    <input type="text" class="form-input-custom" id="tkt-branch" required placeholder="Ej. Tienda Trofex Zona 9">
                  </div>

                  <div class="form-field">
                    <label class="form-label-custom">Equipo / Serie / AnyDesk</label>
                    <input type="text" class="form-input-custom" id="tkt-asset" placeholder="Ej. PC-CAJA1 / AnyDesk 123 456">
                  </div>
                </div>

                <div class="form-field">
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
                    <div style="font-size: 11px; color: var(--text-muted);">Formatos JPG, PNG (evidencia del error o equipo)</div>
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
                  <p id="list-panel-subtitle">Seguimiento en tiempo real con control de SLA y sincronización MySQL</p>
                </div>
              </div>

              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="btn-secondary-custom" onclick="syncFromServer(true)" title="Sincronizar datos desde MySQL">
                  <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> Sincronizar MySQL
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
                  <button type="button" class="quick-tab-btn" data-qtab="CRITICAL" onclick="setQuickTabFilter('CRITICAL')">
                    Críticos <span class="quick-tab-count" id="qcount-critical">0</span>
                  </button>
                  <button type="button" class="quick-tab-btn" data-qtab="RESOLVED" onclick="setQuickTabFilter('RESOLVED')">
                    Resueltos <span class="quick-tab-count" id="qcount-resolved">0</span>
                  </button>
                </div>

                <div class="view-switcher-bar">
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
                <input type="text" class="form-input-custom" id="filter-search" placeholder="Buscar por código (TKT-...), asunto, tienda, técnico o solicitante..." oninput="renderTicketsView()" style="flex: 2; min-width: 220px;">

                <select class="form-select-custom" id="filter-status" onchange="renderTicketsView()" style="flex: 1; min-width: 150px;">
                  <option value="ALL">Todos los Estados</option>
                  <option value="Abierto">Abierto</option>
                  <option value="En Proceso">En Proceso</option>
                  <option value="En Espera">En Espera</option>
                  <option value="Resuelto">Resuelto</option>
                  <option value="Cerrado">Cerrado</option>
                </select>

                <select class="form-select-custom" id="filter-priority" onchange="renderTicketsView()" style="flex: 1; min-width: 140px;">
                  <option value="ALL">Toda Prioridad</option>
                  <option value="Crítica">Crítica</option>
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>

                <select class="form-select-custom" id="filter-category" onchange="renderTicketsView()" style="flex: 1; min-width: 170px;">
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
                      <th>Prioridad</th>
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
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--primary); font-weight: 800; font-size: 13px;">
              <i data-lucide="sliders" style="width: 16px; height: 16px;"></i> Gestión Técnica del Ticket (Soporte IT)
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
              <button type="button" class="btn-primary-lg" onclick="saveTicketAdminChanges()" style="width: auto; padding: 9px 18px; font-size: 13px;">
                <i data-lucide="save" style="width: 15px; height: 15px;"></i> Guardar Cambios en MySQL
              </button>
            </div>
          </div>

          <!-- FOLLOW-UP COMMENTS TIMELINE -->
          <div>
            <label class="form-label-custom">Bitácora de Seguimiento y Comentarios</label>
            <div class="comments-box" id="mdl-comments-list" style="margin-top: 6px;"></div>

            <div style="display: flex; gap: 8px; margin-top: 10px;">
              <input type="text" class="form-input-custom" id="mdl-new-comment" placeholder="Escribe un comentario o actualización (presiona Enter para enviar)...">
              <button type="button" class="btn-secondary-custom" onclick="addTicketComment()" style="white-space: nowrap; background: var(--dark-slate); color: #fff; border-color: var(--dark-slate);">
                <i data-lucide="message-square-plus" style="width: 15px; height: 15px;"></i> Enviar
              </button>
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

    <!-- TOAST CONTAINER -->
    <div class="toast-stack" id="toast-container"></div>

  </div>

  <script src="js/data.js?v=2.0"></script>
  <script src="js/app.js?v=2.0"></script>
</body>

</html>

