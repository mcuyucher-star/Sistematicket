/**
 * Data Store & Sync Manager (PHP + MySQL Live API + LocalStorage Fallback)
 * Sistema de Gestión de Tickets y Mesa de Ayuda IT
 * Mundi Trofeos · Tiendas Trofex · Premia
 */

const TICKET_STORAGE_KEYS = {
  TICKETS: 'sistematickets_tickets_v2',
  CATEGORIES: 'sistematickets_categories_v2',
  USERS: 'sistematickets_users_v2',
  SESSION: 'sistematickets_session_v1'
};

const DEFAULT_CATEGORIES = [
  { id: 'cat_pos', name: 'Sistema POS / Facturación FEL', slaHours: 4, icon: 'monitor' },
  { id: 'cat_hw', name: 'Hardware / Equipos de Cómputo', slaHours: 12, icon: 'cpu' },
  { id: 'cat_red', name: 'Redes, Internet y VPN', slaHours: 6, icon: 'wifi' },
  { id: 'cat_imp', name: 'Impresoras y Etiquetadoras', slaHours: 8, icon: 'printer' },
  { id: 'cat_acc', name: 'Accesos, Correo y Cuentas', slaHours: 4, icon: 'key' },
  { id: 'cat_inf', name: 'Infraestructura / Tienda', slaHours: 24, icon: 'building-2' }
];

const DEFAULT_USERS = [
  // Solicitantes (Tiendas / Operaciones)
  { id: 'u1', name: 'Andrea Morales', role: 'solicitante', branch: 'Tienda Trofex Zona 9', country: 'Guatemala', email: 'andrea.morales@munditrofeos.com', phone: '+502 5511-2233', pin: '1234' },
  { id: 'u2', name: 'Carlos Pérez', role: 'solicitante', branch: 'Bodega & Logística Central', country: 'Guatemala', email: 'carlos.perez@munditrofeos.com', phone: '+502 5544-1234', pin: '1234' },
  { id: 'u3', name: 'Gabriela Castillo', role: 'solicitante', branch: 'Tienda Premia San Salvador', country: 'El Salvador', email: 'gabriela.castillo@munditrofeos.com', phone: '+503 7711-8899', pin: '1234' },
  { id: 'u4', name: 'Jorge Valladares', role: 'solicitante', branch: 'Tienda Mundi Trofeos San Pedro Sula', country: 'Honduras', email: 'jorge.valladares@munditrofeos.com', phone: '+504 9900-1122', pin: '1234' },
  { id: 'u5', name: 'Valeria Solís', role: 'solicitante', branch: 'Tienda Trofex San José', country: 'Costa Rica', email: 'valeria.solis@munditrofeos.com', phone: '+506 8833-4455', pin: '1234' },

  // Técnicos / Administradores IT
  { id: 't1', name: 'Ing. Diego Ramírez (Soporte IT Nivel 2)', role: 'admin', branch: 'Sede Central IT', country: 'Guatemala', email: 'it.soporte@munditrofeos.com', phone: '+502 4400-9900', pin: 'admin123' },
  { id: 't2', name: 'Kevin Hernández (Redes & Equipos)', role: 'admin', branch: 'Sede Central IT', country: 'Guatemala', email: 'kevin.it@munditrofeos.com', phone: '+502 4400-9911', pin: 'admin123' },
  { id: 't3', name: 'Sofía Méndez (Sistemas POS & ERP)', role: 'admin', branch: 'Soporte Regional CA', country: 'El Salvador', email: 'sofia.sistemas@munditrofeos.com', phone: '+503 7100-2200', pin: 'admin123' }
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
    assignedTechName: 'Kevin Hernández (Redes & Equipos)',
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
        author: 'Kevin Hernández (Redes & Equipos)',
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
    assignedTechName: 'Sofía Méndez (Sistemas POS & ERP)',
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
    assignedTechName: 'Ing. Diego Ramírez (Soporte IT Nivel 2)',
    attachmentBase64: null,
    resolutionNotes: 'Cuenta creada en Microsoft 365 y credenciales enviadas al encargado de tienda.',
    comments: [
      {
        author: 'Ing. Diego Ramírez (Soporte IT Nivel 2)',
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
      return JSON.parse(raw);
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
      return JSON.parse(raw);
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
