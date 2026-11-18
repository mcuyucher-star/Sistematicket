/**
 * Data Store & Sync Manager (PHP + MySQL Live API + LocalStorage Fallback)
 * Sistema de Gestión de Tickets y Mesa de Ayuda IT
 * Mundi Trofeos · Tiendas Trofex · Premia
 */

const TICKET_STORAGE_KEYS = {
  TICKETS: 'sistematickets_tickets_v3',
  CATEGORIES: 'sistematickets_categories_v3',
  USERS: 'sistematickets_users_v6',
  SESSION: 'sistematickets_session_v1'
};

const GUATEMALA_BRANCHES = [
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

const CENTRAL_AMERICA_COUNTRIES = [
  'Guatemala',
  'El Salvador',
  'Honduras',
  'Nicaragua',
  'Costa Rica',
  'Belice'
];

const DEFAULT_CATEGORIES = [
  { id: 'cat_imp', name: 'Impresoras', slaHours: 12, priority: 'Baja', icon: 'printer' },
  { id: 'cat_red', name: 'Red', slaHours: 8, priority: 'Media', icon: 'wifi' },
  { id: 'cat_inst', name: 'Instalación de Equipos', slaHours: 4, priority: 'Alta', icon: 'cpu' },
  { id: 'cat_mant', name: 'Mantenimiento y Respaldo de Datos', slaHours: 8, priority: 'Media', icon: 'hard-drive' },
  { id: 'cat_comp', name: 'Compras de Nuevos Equipos', slaHours: 4, priority: 'Alta', icon: 'shopping-cart' }
];

const DEFAULT_USERS = [
  // Guatemala (Mundi Trofeos, Premia Zona 13 y sucursales TRX)
  { id: 'u_01_mundi', name: 'Mundi Trofeos', role: 'solicitante', branch: 'Mundi Trofeos', country: 'Guatemala', email: 'munditrofeos@munditrofeos.com', phone: '+502 2200-0001', pin: '1' },
  { id: 'u_02_premia13', name: 'Premia Zona 13', role: 'solicitante', branch: 'Premia Zona 13', country: 'Guatemala', email: 'premiazona13@munditrofeos.com', phone: '+502 2200-0002', pin: '1' },
  { id: 'u_03_coban', name: 'TRX Coban', role: 'solicitante', branch: 'TRX Coban', country: 'Guatemala', email: 'coban@tiendastrofex.com', phone: '+502 2200-0003', pin: '1' },
  { id: 'u_04_peten', name: 'TRX Peten', role: 'solicitante', branch: 'TRX Peten', country: 'Guatemala', email: 'peten@tiendastrofex.com', phone: '+502 2200-0004', pin: '1' },
  { id: 'u_05_pbarrios', name: 'TRX Puertos Barrios', role: 'solicitante', branch: 'TRX Puertos Barrios', country: 'Guatemala', email: 'puertosbarrios@tiendastrofex.com', phone: '+502 2200-0005', pin: '1' },
  { id: 'u_06_chiquimula', name: 'TRX Chiquimula', role: 'solicitante', branch: 'TRX Chiquimula', country: 'Guatemala', email: 'chiquimula@tiendastrofex.com', phone: '+502 2200-0006', pin: '1' },
  { id: 'u_07_jutiapa', name: 'TRX Jutiapa', role: 'solicitante', branch: 'TRX Jutiapa', country: 'Guatemala', email: 'jutiapa@tiendastrofex.com', phone: '+502 2200-0007', pin: '1' },
  { id: 'u_08_zona3', name: 'TRX Zona 3', role: 'solicitante', branch: 'TRX Zona 3', country: 'Guatemala', email: 'zona3@tiendastrofex.com', phone: '+502 2200-0008', pin: '1' },
  { id: 'u_09_sanjuan', name: 'TRX San Juan', role: 'solicitante', branch: 'TRX San Juan', country: 'Guatemala', email: 'sanjuan@tiendastrofex.com', phone: '+502 2200-0009', pin: '1' },
  { id: 'u_10_sanmarcos', name: 'TRX San Marcos', role: 'solicitante', branch: 'TRX San Marcos', country: 'Guatemala', email: 'sanmarcos@tiendastrofex.com', phone: '+502 2200-0010', pin: '1' },
  { id: 'u_11_chimal', name: 'TRX Chimaltenango', role: 'solicitante', branch: 'TRX Chimaltenango', country: 'Guatemala', email: 'chimaltenango@tiendastrofex.com', phone: '+502 2200-0011', pin: '1' },
  { id: 'u_12_escuintla', name: 'TRX Escuintla', role: 'solicitante', branch: 'TRX Escuintla', country: 'Guatemala', email: 'escuintla@tiendastrofex.com', phone: '+502 2200-0012', pin: '1' },
  { id: 'u_13_huehue', name: 'TRX Huehuetenango', role: 'solicitante', branch: 'TRX Huehuetenango', country: 'Guatemala', email: 'huehuetenango@tiendastrofex.com', phone: '+502 2200-0013', pin: '1' },
  { id: 'u_14_mazate', name: 'TRX Mazatenango', role: 'solicitante', branch: 'TRX Mazatenango', country: 'Guatemala', email: 'mazatenango@tiendastrofex.com', phone: '+502 2200-0014', pin: '1' },
  { id: 'u_15_villanueva', name: 'TRX Villa Nueva', role: 'solicitante', branch: 'TRX Villa Nueva', country: 'Guatemala', email: 'villanueva@tiendastrofex.com', phone: '+502 2200-0015', pin: '1' },
  { id: 'u_16_xela', name: 'TRX Xela', role: 'solicitante', branch: 'TRX Xela', country: 'Guatemala', email: 'xela@tiendastrofex.com', phone: '+502 2200-0016', pin: '1' },

  // Centroamérica (solo el nombre del país)
  { id: 'u_17_sv', name: 'El Salvador', role: 'solicitante', branch: 'El Salvador', country: 'El Salvador', email: 'elsalvador@munditrofeos.com', phone: '+503 7711-8899', pin: '1' },
  { id: 'u_18_hn', name: 'Honduras', role: 'solicitante', branch: 'Honduras', country: 'Honduras', email: 'honduras@munditrofeos.com', phone: '+504 9900-1122', pin: '1' },
  { id: 'u_19_ni', name: 'Nicaragua', role: 'solicitante', branch: 'Nicaragua', country: 'Nicaragua', email: 'nicaragua@munditrofeos.com', phone: '+505 8811-2233', pin: '1' },
  { id: 'u_20_cr', name: 'Costa Rica', role: 'solicitante', branch: 'Costa Rica', country: 'Costa Rica', email: 'costarica@munditrofeos.com', phone: '+506 8833-4455', pin: '1' },
  { id: 'u_21_bz', name: 'Belice', role: 'solicitante', branch: 'Belice', country: 'Belice', email: 'belice@munditrofeos.com', phone: '+501 610-1122', pin: '1' },

  // Técnicos / Administradores IT
  { id: 't1', name: 'Maynor Cuyuche', role: 'admin', branch: 'Sede Central IT', country: 'Guatemala', email: 'maynor.cuyuche@munditrofeos.com', phone: '+502 4400-9900', pin: '1' },
  { id: 't2', name: 'IT1', role: 'admin', branch: 'Sede Central IT', country: 'Guatemala', email: 'it1@munditrofeos.com', phone: '+502 4400-9911', pin: '1' },
  { id: 't3', name: 'IT2', role: 'admin', branch: 'Sede Central IT', country: 'Guatemala', email: 'it2@munditrofeos.com', phone: '+502 4400-9922', pin: '1' }
];

const DEFAULT_TICKETS = [
  {
    id: 'tkt_1001',
    code: 'TKT-2026-001',
    title: 'Impresora térmica de caja 1 no corta papel y marca luz roja',
    description: 'Al emitir factura FEL en mostrador principal la impresora Epson TM-T20III se queda con el LED de error parpadeando y no imprime el comprobante.',
    categoryId: 'cat_imp',
    categoryName: 'Impresoras y Etiquetadoras',
    priority: 'Alta',
    status: 'En Proceso',
    requesterId: 'u1',
    requesterName: 'Andrea Morales',
    requesterEmail: 'andrea.morales@munditrofeos.com',
    requesterPhone: '+502 5511-2233',
    branch: 'Tienda Trofex Zona 9',
    country: 'Guatemala',
    assetCode: 'IMP-Z9-01 / Epson TM-T20',
    assignedTechId: 't2',
    assignedTechName: 'IT1',
    attachmentBase64: null,
    resolutionNotes: 'Se revisó vía AnyDesk la cola de impresión y se programó limpieza de cabezal térmico.',
    comments: [
      {
        author: 'Andrea Morales',
        role: 'Solicitante',
        date: '03/11/2026 07:45',
        text: 'Adjunto reporte, tenemos clientes en fila esperando factura.'
      },
      {
        author: 'IT1',
        role: 'Soporte IT',
        date: '03/11/2026 08:02',
        text: 'Recibido Andrea, me conecto por AnyDesk en 3 minutos para desviar la impresión a Caja 2 mientras destrabamos la cuchilla.'
      }
    ],
    createdAtDisplay: '03/11/2026 07:45',
    createdAtSql: '2026-11-03 07:45:00'
  },
  {
    id: 'tkt_1002',
    code: 'TKT-2026-002',
    title: 'Error de conexión con certificador FEL al facturar con NIT',
    description: 'El sistema POS muestra mensaje "Timeout Certificador" cuando intentamos facturar pedidos mayores a Q2,500.',
    categoryId: 'cat_pos',
    categoryName: 'Sistema POS / Facturación FEL',
    priority: 'Crítica',
    status: 'Abierto',
    requesterId: 'u3',
    requesterName: 'Gabriela Castillo',
    requesterEmail: 'gabriela.castillo@munditrofeos.com',
    requesterPhone: '+503 7711-8899',
    branch: 'Tienda Premia San Salvador',
    country: 'El Salvador',
    assetCode: 'POS-SV-CAJA01',
    assignedTechId: '',
    assignedTechName: 'Sin asignar',
    attachmentBase64: null,
    resolutionNotes: '',
    comments: [
      {
        author: 'Gabriela Castillo',
        role: 'Solicitante',
        date: '03/11/2026 08:10',
        text: 'Urge apoyo por favor, tenemos dos pedidos corporativos pendientes de facturar.'
      }
    ],
    createdAtDisplay: '03/11/2026 08:10',
    createdAtSql: '2026-11-03 08:10:00'
  },
  {
    id: 'tkt_1003',
    code: 'TKT-2026-003',
    title: 'Solicitud de creación de correo y acceso para nuevo asesor de ventas',
    description: 'Solicito crear cuenta de correo corporativo y usuario de sistema para el nuevo integrante de sala de ventas.',
    categoryId: 'cat_acc',
    categoryName: 'Accesos, Correo y Cuentas',
    priority: 'Baja',
    status: 'Resuelto',
    requesterId: 'u4',
    requesterName: 'Jorge Valladares',
    requesterEmail: 'jorge.valladares@munditrofeos.com',
    requesterPhone: '+504 9900-1122',
    branch: 'Tienda Mundi Trofeos San Pedro Sula',
    country: 'Honduras',
    assetCode: 'PC-VENTAS-SPS03',
    assignedTechId: 't1',
    assignedTechName: 'Maynor Cuyuche',
    attachmentBase64: null,
    resolutionNotes: 'Cuenta creada en Microsoft 365 y credenciales enviadas al encargado de tienda.',
    comments: [
      {
        author: 'Maynor Cuyuche',
        role: 'Soporte IT',
        date: '02/11/2026 16:30',
        text: 'Cuenta activada y permisos asignados en módulo de facturación.'
      }
    ],
    createdAtDisplay: '02/11/2026 14:20',
    createdAtSql: '2026-11-02 14:20:00'
  }
];

const TicketStorage = {
  dbConnected: false,
  phpVersion: null,
  _memoryTickets: null,
  _lastLocalWriteMs: 0,

  normalizeTicketList(list) {
    if (!Array.isArray(list)) return DEFAULT_TICKETS;
    return list.map(t => {
      const noTech =
        !t.assignedTechId ||
        t.assignedTechId === '0' ||
        !t.assignedTechName ||
        t.assignedTechName === 'Sin asignar' ||
        t.status === 'Abierto';
      return {
        ...t,
        assignedTechId: noTech ? '' : t.assignedTechId,
        assignedTechName: noTech ? 'Sin asignar' : t.assignedTechName,
        comments: Array.isArray(t.comments) ? t.comments : []
      };
    });
  },

  getCategories() {
    const defaultPrioMap = {
      cat_imp: 'Baja',
      cat_red: 'Media',
      cat_inst: 'Alta',
      cat_mant: 'Media',
      cat_comp: 'Alta'
    };
    const normalizeCats = list =>
      (Array.isArray(list) ? list : DEFAULT_CATEGORIES).map(c => ({
        ...c,
        slaHours: Number(c.slaHours) || 8,
        priority: c.priority || defaultPrioMap[c.id] || 'Media',
        icon: c.icon || 'tag'
      }));

    try {
      const raw = localStorage.getItem(TICKET_STORAGE_KEYS.CATEGORIES);
      if (!raw) {
        const initial = normalizeCats(DEFAULT_CATEGORIES);
        localStorage.setItem(TICKET_STORAGE_KEYS.CATEGORIES, JSON.stringify(initial));
        return initial;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const initial = normalizeCats(DEFAULT_CATEGORIES);
        localStorage.setItem(TICKET_STORAGE_KEYS.CATEGORIES, JSON.stringify(initial));
        return initial;
      }
      return normalizeCats(parsed);
    } catch (e) {
      return normalizeCats(DEFAULT_CATEGORIES);
    }
  },

  saveCategories(list) {
    this._lastLocalWriteMs = Date.now();
    try {
      localStorage.setItem(TICKET_STORAGE_KEYS.CATEGORIES, JSON.stringify(list));
    } catch (e) {
      console.warn('Error guardando categorías en localStorage:', e);
    }
  },

  async saveCategoryToBackend(catObj) {
    try {
      const res = await fetch('api/tickets.php?action=save_category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catObj)
      });
      return await res.json();
    } catch (e) {
      return { ok: false, mode: 'local_only' };
    }
  },

  async deleteCategoryFromBackend(catId) {
    try {
      const res = await fetch('api/tickets.php?action=delete_category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: catId })
      });
      return await res.json();
    } catch (e) {
      return { ok: false, mode: 'local_only' };
    }
  },

  getUsers() {
    try {
      const raw = localStorage.getItem(TICKET_STORAGE_KEYS.USERS);
      if (!raw) {
        localStorage.setItem(TICKET_STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
        return DEFAULT_USERS;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return DEFAULT_USERS;

      const hasLegacyAdmins = parsed.some(u => u.id === 't1' && String(u.name || '').includes('Diego'));
      if (hasLegacyAdmins) {
        const officialAdmins = DEFAULT_USERS.filter(u => u.role === 'admin');
        const nonAdmins = parsed.filter(u => u.role !== 'admin');
        const merged = [...nonAdmins, ...officialAdmins];
        localStorage.setItem(TICKET_STORAGE_KEYS.USERS, JSON.stringify(merged));
        return merged;
      }
      return parsed;
    } catch (e) {
      return DEFAULT_USERS;
    }
  },

  getTickets() {
    try {
      const raw = localStorage.getItem(TICKET_STORAGE_KEYS.TICKETS);
      if (!raw) {
        const initial = this.normalizeTicketList(DEFAULT_TICKETS);
        this._memoryTickets = initial;
        localStorage.setItem(TICKET_STORAGE_KEYS.TICKETS, JSON.stringify(initial));
        return initial;
      }
      const parsed = JSON.parse(raw);
      const normalized = this.normalizeTicketList(Array.isArray(parsed) ? parsed : DEFAULT_TICKETS);
      this._memoryTickets = normalized;
      return normalized;
    } catch (e) {
      return this._memoryTickets || DEFAULT_TICKETS;
    }
  },

  saveTickets(list) {
    const normalized = this.normalizeTicketList(list);
    this._memoryTickets = normalized;
    this._lastLocalWriteMs = Date.now();
    try {
      localStorage.setItem(TICKET_STORAGE_KEYS.TICKETS, JSON.stringify(normalized));
    } catch (e) {
      // Si localStorage excede cuota por imágenes Base64 grandes, guardar versión ligera sin romper la ejecución
      try {
        const lightList = normalized.map(t => ({ ...t, attachmentBase64: null, resolutionAttachmentBase64: null }));
        localStorage.setItem(TICKET_STORAGE_KEYS.TICKETS, JSON.stringify(lightList));
      } catch (err2) {
        // Mantener en _memoryTickets
      }
    }
  },

  saveUsers(list) {
    try {
      localStorage.setItem(TICKET_STORAGE_KEYS.USERS, JSON.stringify(list));
    } catch (e) {
      console.warn('Error guardando usuarios en localStorage:', e);
    }
  },

  async saveUserToBackend(userObj) {
    try {
      const res = await fetch('api/tickets.php?action=save_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userObj)
      });
      return await res.json();
    } catch (e) {
      return { ok: false, mode: 'local_only' };
    }
  },

  async deleteUserFromBackend(userId) {
    try {
      const res = await fetch('api/tickets.php?action=delete_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId })
      });
      return await res.json();
    } catch (e) {
      return { ok: false, mode: 'local_only' };
    }
  },

  /**
   * Sincroniza desde PHP + MySQL al iniciar o refrescar la aplicación
   */
  async loadFromBackend() {
    // Si hubo un cambio local hace menos de 2.5 segundos, respetar el estado local reciente
    if (Date.now() - this._lastLocalWriteMs < 2500) {
      return { ok: this.dbConnected, mode: 'local_recent', count: (this._memoryTickets || []).length };
    }
    try {
      const res = await fetch('api/tickets.php?action=bootstrap', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      const data = await res.json();
      if (data && data.ok) {
        if (Date.now() - this._lastLocalWriteMs < 2500) {
          return { ok: true, mode: 'local_recent', count: (this._memoryTickets || []).length };
        }
        this.dbConnected = true;
        this.phpVersion = data.phpVersion || null;

        if (Array.isArray(data.categories) && data.categories.length > 0) {
          localStorage.setItem(TICKET_STORAGE_KEYS.CATEGORIES, JSON.stringify(data.categories));
        }
        if (Array.isArray(data.users) && data.users.length > 0) {
          localStorage.setItem(TICKET_STORAGE_KEYS.USERS, JSON.stringify(data.users));
        }
        if (Array.isArray(data.tickets)) {
          const normalized = this.normalizeTicketList(data.tickets);
          this._memoryTickets = normalized;
          try {
            localStorage.setItem(TICKET_STORAGE_KEYS.TICKETS, JSON.stringify(normalized));
          } catch (errStorage) {
            // Ignorar si excede cuota
          }
        }
        return { ok: true, mode: 'mysql_live', count: (data.tickets || []).length };
      }
      this.dbConnected = false;
      return { ok: false, mode: 'local_fallback' };
    } catch (e) {
      this.dbConnected = false;
      return { ok: false, mode: 'local_fallback' };
    }
  },

  async syncTicketToBackend(ticket) {
    try {
      const res = await fetch('api/tickets.php?action=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticket)
      });
      const json = await res.json();
      this.dbConnected = Boolean(json && json.ok);
      return json;
    } catch (e) {
      this.dbConnected = false;
      return { ok: false, mode: 'local_only' };
    }
  },

  async deleteTicketFromBackend(ticketId) {
    try {
      const res = await fetch('api/tickets.php?action=delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ticketId })
      });
      const json = await res.json();
      this.dbConnected = Boolean(json && json.ok);
      return json;
    } catch (e) {
      this.dbConnected = false;
      return { ok: false };
    }
  },

  parseAnyDateToMs(raw) {
    if (!raw) return NaN;
    const str = String(raw).trim();
    // Si viene en formato SQL: YYYY-MM-DD HH:MM(:SS)
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const ms = new Date(str.replace(' ', 'T')).getTime();
      if (!isNaN(ms)) return ms;
    }
    // Si viene en formato DD/MM/YYYY HH:MM
    const parts = str.split(' ');
    const dmy = (parts[0] || '').split('/');
    if (dmy.length === 3) {
      const hm = (parts[1] || '00:00').split(':');
      const dt = new Date(
        Number(dmy[2]),
        Number(dmy[1]) - 1,
        Number(dmy[0]),
        Number(hm[0] || 0),
        Number(hm[1] || 0)
      );
      if (!isNaN(dt.getTime())) return dt.getTime();
    }
    return NaN;
  },

  formatDurationMinutes(totalMins) {
    const mins = Math.max(1, Math.round(Number(totalMins) || 1));
    if (mins < 60) {
      return `${mins} min`;
    }
    if (mins < 1440) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h} h ${m} min` : `${h} h`;
    }
    const d = Math.floor(mins / 1440);
    const remH = Math.floor((mins % 1440) / 60);
    return remH > 0 ? `${d} d ${remH} h` : `${d} d`;
  },

  computeResolutionDuration(ticket) {
    if (!ticket || (ticket.status !== 'Resuelto' && ticket.status !== 'Cerrado')) {
      return null;
    }
    const startMs =
      this.parseAnyDateToMs(ticket.createdAtSql) ||
      this.parseAnyDateToMs(ticket.createdAtDisplay);
    if (isNaN(startMs)) return null;

    const comments = Array.isArray(ticket.comments) ? ticket.comments : [];
    const lastCommentDate = comments.length > 0 ? comments[comments.length - 1].date : null;
    const endMs =
      this.parseAnyDateToMs(ticket.resolvedAtSql) ||
      this.parseAnyDateToMs(ticket.resolvedAtDisplay) ||
      this.parseAnyDateToMs(lastCommentDate) ||
      this.parseAnyDateToMs(ticket.updatedAtSql) ||
      startMs + 60000;

    const diffMins = Math.max(1, Math.round((endMs - startMs) / 60000));
    return {
      minutes: diffMins,
      text: this.formatDurationMinutes(diffMins)
    };
  },

  /**
   * Calcula el estado de SLA de un ticket según su categoría y estado
   */
  computeSLA(ticket) {
    const categories = this.getCategories();
    const cat = categories.find(c => c.id === ticket.categoryId);
    const slaHours = cat ? Number(cat.slaHours) || 8 : 8;

    if (ticket.status === 'Resuelto' || ticket.status === 'Cerrado') {
      const dur = this.computeResolutionDuration(ticket);
      return {
        cssClass: 'sla-done',
        label: dur ? `⏱️ Resuelto en ${dur.text}` : `SLA ${slaHours}h · Cumplido`
      };
    }

    const createdMs = ticket.createdAtSql
      ? new Date(ticket.createdAtSql.replace(' ', 'T')).getTime()
      : Date.now();

    if (isNaN(createdMs)) {
      return { cssClass: 'sla-ok', label: `SLA ${slaHours}h` };
    }

    const deadlineMs = createdMs + slaHours * 3600 * 1000;
    const diffHours = (deadlineMs - Date.now()) / (3600 * 1000);

    if (diffHours < 0) {
      const overdue = Math.abs(Math.round(diffHours));
      return {
        cssClass: 'sla-expired',
        label: `SLA Vencido (${overdue || 1}h)`
      };
    }
    if (diffHours <= 1.5) {
      const mins = Math.max(5, Math.round(diffHours * 60));
      return {
        cssClass: 'sla-warn',
        label: `Por vencer · ${mins}m`
      };
    }
    return {
      cssClass: 'sla-ok',
      label: `En tiempo · ${Math.round(diffHours)}h rest.`
    };
  }
};
