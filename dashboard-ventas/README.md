# Honey Whale - Dashboard de Campaña VIP

Este proyecto es un **Dashboard Gerencial** diseñado con altos estándares de UI/UX (Glassmorphism, Dark Mode) para visualizar en tiempo real métricas clave, evolución temporal y perfiles de prospectos B2B (Contactos VIP).

## Características Principales

1. **Diseño Premium (Glassmorphism)**
   - Paneles translúcidos con efecto de desenfoque de fondo.
   - Interfaz limpia, oscura ("Dark Mode") con acentos en color institucional (Amarillo Honey Whale).
   - Tipografía moderna (Inter) orientada a la legibilidad financiera y de KPIs.

2. **Responsividad Total**
   - **Móviles**: Menú colapsable tipo "Hamburguesa", diseño de barra superior optimizado, botones anclados (sticky) para una interacción nativa, reubicación inteligente de columnas en la tabla de contactos VIP.
   - **Escritorio**: Grillas distribuidas para aprovechar todo el ancho de pantalla.

3. **Métricas en Tiempo Real**
   - KPI's inteligentes que comparan el desempeño contra el día anterior.
   - Gráficos interactivos generados con `Chart.js`:
     - Evolución temporal de canjes (Líneas suavizadas).
     - Desempeño de sucursales (Barras horizontales).
     - Preferencias de productos (Anillos/Doughnut).
     - Mapa de Calor de Horarios Pico (Heatmap renderizado dinámicamente).
     - Preferencias cruzadas Novatos vs Expertos (Radar Chart).

4. **Filtros Avanzados (Flatpickr)**
   - Filtro de fecha predefinido (Hoy, Últimos 7 Días, Este Mes, Histórico).
   - Calendario personalizado (Rango) adaptado al tema Glassmorphism para una experiencia sin costuras.

5. **Expansión B2B (Módulo de Distribuidores)**
   - Identificación automática de clientes con potencial de franquicia.
   - Tabla interactiva con opción de contactar directamente vía WhatsApp con un mensaje predefinido.

## Arquitectura Técnica

El proyecto sigue una arquitectura **Frontend Vanilla** limpia y sin dependencias pesadas de compilación.

- **HTML5:** Estructura semántica `index.html`.
- **CSS:** Utiliza Tailwind CSS (vía CDN) para utilidades rápidas y `css/styles.css` para reglas avanzadas (Animaciones, Glassmorphism avanzado, Override del Calendario).
- **JavaScript:** `js/app.js` centraliza la lógica del negocio, el renderizado de gráficos y las interacciones del DOM. `js/config.js` maneja los tokens y endpoints.
- **Datos:** Conexión vía Webhook/API (Fetch API). Incluye un generador de Mock Data robusto para trabajar sin conexión o cuando la API no responde.

## Cómo Ejecutarlo

1. Clona o descarga el repositorio.
2. Abre el archivo `index.html` en cualquier navegador web moderno (Chrome, Firefox, Safari, Edge).
3. (Opcional) Usa un servidor local ligero como Live Server (Extensión de VSCode) para evitar restricciones de CORS si cambias el origen del Webhook.

## Configuración (Webhooks)

Para apuntar a tu propio Webhook real de Make, n8n o Zapier, edita el archivo `js/config.js`:

```javascript
const CONFIG = {
  webhookUrl: "TU_URL_DE_WEBHOOK_AQUI",
  webhookToken: "TOKEN_OPCIONAL_SI_APLICA"
};
```

## Estructura de Carpetas

```
dashboard-ventas/
├── index.html           # Vista principal
├── README.md            # Documentación
├── assets/
│   └── hw.jpg           # Logo de la empresa
├── css/
│   └── styles.css       # Estilos personalizados, keyframes y scrollbars
└── js/
    ├── config.js        # Configuración de URLs y credenciales
    └── app.js           # Lógica principal, gráficas y procesamiento
```

---
*Diseñado para convertir datos en decisiones estratégicas de forma elegante.*
