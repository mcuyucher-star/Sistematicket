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
    assignedTechId: 't3',
    assignedTechName: 'IT2',
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

  getCategories() {
    try {
      const raw = localStorage.getItem(TICKET_STORAGE_KEYS.CATEGORIES);
      if (!raw) {
        localStorage.setItem(TICKET_STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
        return DEFAULT_CATEGORIES;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.some(c => c.id === 'cat_inst')) {
        localStorage.setItem(TICKET_STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
        return DEFAULT_CATEGORIES;
      }
      return parsed;
    } catch (e) {
      return DEFAULT_CATEGORIES;
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
        localStorage.setItem(TICKET_STORAGE_KEYS.TICKETS, JSON.stringify(DEFAULT_TICKETS));
        return DEFAULT_TICKETS;
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : DEFAULT_TICKETS;
    } catch (e) {
      return DEFAULT_TICKETS;
    }
  },

  saveTickets(list) {
    localStorage.setItem(TICKET_STORAGE_KEYS.TICKETS, JSON.stringify(list));
  },

  saveUsers(list) {
    localStorage.setItem(TICKET_STORAGE_KEYS.USERS, JSON.stringify(list));
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
    try {
      const res = await fetch('api/tickets.php?action=bootstrap', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      const data = await res.json();
      if (data && data.ok) {
        this.dbConnected = true;
        this.phpVersion = data.phpVersion || null;

        if (Array.isArray(data.categories) && data.categories.length > 0) {
          localStorage.setItem(TICKET_STORAGE_KEYS.CATEGORIES, JSON.stringify(data.categories));
        }
        if (Array.isArray(data.users) && data.users.length > 0) {
          localStorage.setItem(TICKET_STORAGE_KEYS.USERS, JSON.stringify(data.users));
        }
        if (Array.isArray(data.tickets)) {
          localStorage.setItem(TICKET_STORAGE_KEYS.TICKETS, JSON.stringify(data.tickets));
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

  /**
   * Calcula el estado de SLA de un ticket según su categoría y estado
   */
  computeSLA(ticket) {
    const categories = this.getCategories();
    const cat = categories.find(c => c.id === ticket.categoryId);
    const slaHours = cat ? Number(cat.slaHours) || 8 : 8;

    if (ticket.status === 'Resuelto' || ticket.status === 'Cerrado') {
      return {
        cssClass: 'sla-done',
        label: `SLA ${slaHours}h · Cumplido`
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
