# Sistema de Tickets & Mesa de Ayuda IT — Mundi Trofeos · Tiendas Trofex · Premia

Sistema corporativo de gestión de tickets de soporte técnico y mesa de ayuda IT para Centroamérica (Guatemala, El Salvador, Honduras, Nicaragua y Costa Rica), desarrollado en **PHP 8+ (PDO + MySQL)** con interfaz moderna de alto rendimiento (**UI/UX Enterprise**).

## Características Principales
- **Backend en PHP + MySQL (`config/database.php` y `api/tickets.php`):**
  - Auto-instalación automática de la base de datos `sistema_tickets_db` y sus tablas (`categorias`, `usuarios`, `tickets`) al iniciar.
  - Sincronización bidireccional en tiempo real y modo de respaldo local (*Offline Fallback*).
- **Experiencia de Usuario (UI/UX):**
  - **Indicadores KPI interactivos** y **pestañas de filtrado rápido** con contadores en vivo.
  - **Doble vista de trabajo:** Tabla empresarial detallada y **Tablero Kanban** interactivo por estados (`Abierto`, `En Proceso`, `En Espera`, `Resuelto`).
  - **Control de SLA en tiempo real:** Semáforo automático por categoría (`En tiempo`, `Por vencer`, `SLA Vencido`, `Cumplido`).
  - **Exportación a PDF y CSV** de órdenes de soporte y reportes.

## Instalación en XAMPP
1. Clonar este repositorio dentro de `C:\xampp\htdocs\sistema_de_tickets`.
2. Iniciar **Apache** y **MySQL** en el panel de control de XAMPP.
3. Abrir en el navegador: `http://localhost/sistema_de_tickets/`

