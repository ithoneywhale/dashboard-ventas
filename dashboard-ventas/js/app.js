// app.js

// Chart instances para poder destruirlas antes de re-renderizar
let charts = {};
let globalData = []; // Almacena todos los datos históricos parseados

// Paleta de colores (Amarillo y Negro)
const colors = {
  yellow: '#FDCB09',
  black: '#000000',
  darkGray: '#111111',
  white: '#ffffff',
  textMuted: '#9ca3af',
  glassBorder: 'rgba(253, 203, 9, 0.2)',
  gridLines: 'rgba(255, 255, 255, 0.05)',
  // Paleta vibrante de alto contraste (sin naranja para evitar confusión con el amarillo)
  palette: ['#FDCB09', '#4361EE', '#E71D36', '#2EC4B6', '#7209B7', '#4ADE80', '#F72585']
};

// Configurar defaults globales de Chart.js para Dark Theme
Chart.defaults.color = colors.textMuted;
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(0, 0, 0, 0.9)';
Chart.defaults.plugins.tooltip.titleColor = colors.yellow;
Chart.defaults.plugins.tooltip.bodyColor = '#e2e8f0';
Chart.defaults.plugins.tooltip.borderColor = colors.glassBorder;
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.scale.grid.color = colors.gridLines;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('campaign-title').textContent = CONFIG.campañaNombre || "Dashboard de Campaña";

  init();

  document.getElementById('btn-refresh').addEventListener('click', init);

  // Cerrar el dropdown al hacer click afuera
  document.addEventListener('click', (event) => {
    const container = document.getElementById('date-dropdown-container');
    if (container && !container.contains(event.target)) {
      document.getElementById('date-dropdown-menu').classList.add('hidden');
    }
  });

  // Auto refresh
  if (CONFIG.refreshInterval > 0) {
    setInterval(() => {
      init();
    }, CONFIG.refreshInterval * 1000);
  }

  // Inicializar Flatpickr (Calendario)
  const dateInput = document.getElementById('flatpickr-input');
  if (dateInput) {
    fpInstance = flatpickr(dateInput, {
      mode: "range",
      locale: "es",
      dateFormat: "Y-m-d",
      theme: "dark",
      position: "auto right",
      onOpen: function () {
        const bd = document.getElementById('calendar-backdrop');
        if (bd) {
          bd.classList.remove('hidden');
          setTimeout(() => bd.classList.remove('opacity-0'), 10);
        }
      },
      onClose: function (selectedDates, dateStr, instance) {
        const bd = document.getElementById('calendar-backdrop');
        if (bd) {
          bd.classList.add('opacity-0');
          setTimeout(() => bd.classList.add('hidden'), 300);
        }

        if (selectedDates.length === 2) {
          customDateRange = selectedDates;
          const startStr = selectedDates[0].toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
          const endStr = selectedDates[1].toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
          document.getElementById('date-filter-label').textContent = `${startStr} - ${endStr}`;
          applyFilters();
        } else if (selectedDates.length === 1) {
          customDateRange = [selectedDates[0], selectedDates[0]];
          const startStr = selectedDates[0].toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
          document.getElementById('date-filter-label').textContent = `${startStr}`;
          applyFilters();
        } else {
          // Si cierran sin seleccionar nada y estaban en custom, los mandamos a "all"
          if (currentFilter === 'custom') {
            selectDateFilter('all', 'Histórico Total');
          }
        }
      }
    });
  }
});

// Lógica del Menú Móvil (Hamburguesa / Drawer)
window.toggleMobileMenu = function () {
  const menu = document.getElementById('mobile-menu');
  const drawer = document.getElementById('mobile-drawer');

  if (menu.classList.contains('hidden')) {
    menu.classList.remove('hidden', 'pointer-events-none');
    setTimeout(() => {
      menu.classList.remove('opacity-0');
      if (drawer) drawer.classList.remove('translate-x-full');
    }, 10);
    document.body.style.overflow = 'hidden'; // Bloquear scroll de fondo
  } else {
    menu.classList.add('opacity-0');
    if (drawer) drawer.classList.add('translate-x-full');
    document.body.style.overflow = ''; // Restaurar scroll
    setTimeout(() => {
      menu.classList.add('hidden', 'pointer-events-none');
    }, 300); // Igual a duration-300
  }
};

// Lógica del Filtro de Fechas Custom
let currentFilter = 'all';
let fpInstance = null;
let customDateRange = [];

window.toggleDateMenu = function () {
  document.getElementById('date-dropdown-menu').classList.toggle('hidden');
};

window.selectDateFilter = function (filterValue, filterLabel) {
  if (filterValue === 'custom') {
    document.getElementById('date-dropdown-menu').classList.add('hidden');
    currentFilter = 'custom';
    // Usamos setTimeout para evitar que el click actual sea detectado por flatpickr como "click fuera" y lo cierre al instante
    setTimeout(() => {
      if (fpInstance) fpInstance.open();
    }, 50);
    return;
  }

  currentFilter = filterValue;
  document.getElementById('date-filter-label').textContent = filterLabel;
  document.getElementById('date-dropdown-menu').classList.add('hidden');
  applyFilters();
};

function applyFilters() {
  let filtered = globalData;
  const now = new Date();

  if (currentFilter === 'today') {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    filtered = globalData.filter(d => d.dateStr === todayStr);
  } else if (currentFilter === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    filtered = globalData.filter(d => d.dateObj >= weekAgo);
  } else if (currentFilter === 'month') {
    const month = now.getMonth();
    const year = now.getFullYear();
    filtered = globalData.filter(d => d.dateObj.getMonth() === month && d.dateObj.getFullYear() === year);
  } else if (currentFilter === 'custom' && customDateRange.length > 0) {
    const start = new Date(customDateRange[0]);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customDateRange[1] || customDateRange[0]);
    end.setHours(23, 59, 59, 999);
    filtered = globalData.filter(d => d.dateObj >= start && d.dateObj <= end);
  }

  // Actualizar UI
  renderAll(filtered);
}

async function init() {
  setLoading(true);
  try {
    let rawData;
    // Intentar webhook si está configurado
    if (CONFIG.webhookUrl && CONFIG.webhookUrl.trim() !== "") {
      try {
        const fetchOptions = {
          method: 'GET', // Cambiado a GET ya que no hay body
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        };

        // Agregar token si existe en la configuración
        if (CONFIG.webhookToken && CONFIG.webhookToken.trim() !== "") {
          fetchOptions.headers['x-api-key'] = CONFIG.webhookToken;
        }

        // Añadir timestamp para evitar que el navegador cachee la respuesta (Cache-Busting)
        const url = new URL(CONFIG.webhookUrl);
        url.searchParams.append('t', new Date().getTime());

        const response = await fetch(url.toString(), { ...fetchOptions, cache: 'no-store' });
        if (!response.ok) throw new Error(`Webhook falló con estado ${response.status}`);
        rawData = await response.json();
        document.getElementById('error-toast').classList.add('hidden');
      } catch (e) {
        showError("Error de conexión con el Webhook. Usando datos de prueba (Mock Data).");
        rawData = generateMockData();
      }
    } else {
      // Usar mock data si no hay webhook
      rawData = generateMockData();
    }

    globalData = parseData(rawData);
    applyFilters();

    document.getElementById('last-updated').textContent = `Actualizado: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch (error) {
    console.error(error);
    showError("Error crítico procesando los datos.");
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  const loader = document.getElementById('loader');
  if (isLoading) {
    loader.classList.remove('hidden');
  } else {
    loader.classList.add('hidden');
  }
}

function showError(msg) {
  const toast = document.getElementById('error-toast');
  document.getElementById('error-message').textContent = msg;
  toast.classList.remove('hidden');
}

// ------------------------------------------------------------------
// PARSEO Y AGRUPACIÓN DE DATOS
// ------------------------------------------------------------------

function parseData(rawData) {
  let dataArray = rawData;
  // Si n8n devuelve un objeto con un arreglo adentro en vez del arreglo directo
  if (!Array.isArray(dataArray)) {
    if (dataArray.data && Array.isArray(dataArray.data)) dataArray = dataArray.data;
    else if (dataArray.items && Array.isArray(dataArray.items)) dataArray = dataArray.items;
    else if (dataArray.json) {
      if (Array.isArray(dataArray.json)) dataArray = dataArray.json;
      else dataArray = [dataArray.json];
    }
    else dataArray = [dataArray];
  }

  // Parseo de fechas ultra-robusto
  const parseDateRobust = (val) => {
    if (!val) return new Date();

    // Si es un número (Timestamp UNIX), procesar directo
    if (typeof val === 'number') return new Date(val);

    // Si es un string numérico puro (ej. "1780920000000")
    if (typeof val === 'string' && /^\d{13}$/.test(val)) return new Date(parseInt(val, 10));

    // Si es un string con formato DD/MM/YYYY HH:mm:ss
    if (typeof val === 'string') {
      const parts = val.split(' ');
      const dPart = parts[0];
      const tPart = parts[1] || "00:00:00";

      if (dPart.includes('/')) {
        const dParts = dPart.split('/');
        if (dParts.length === 3) {
          let day = parseInt(dParts[0], 10);
          let month = parseInt(dParts[1], 10);
          let year = parseInt(dParts[2], 10);

          // Si el año viene en 2 dígitos
          if (year < 100) year += 2000;

          // Asumir DD/MM/YYYY, pero si mes > 12 significa que vino MM/DD/YYYY
          if (month > 12) {
            const temp = day;
            day = month;
            month = temp;
          }

          return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${tPart}`);
        }
      }
    }
    const fallback = new Date(val);
    return isNaN(fallback.getTime()) ? new Date() : fallback;
  };

  // N8n suele envolver los datos en una propiedad "json" internamente
  dataArray = dataArray.map(item => item.json ? item.json : item);

  // Filtrar objetos vacíos o que no tengan Marca temporal para evitar fallos en sort
  dataArray = dataArray.filter(row => row["Marca temporal"] || row["Fecha"]);

  // Ordenar cronológicamente (más antiguo a más nuevo) para la línea de tiempo
  dataArray.sort((a, b) => parseDateRobust(a["Marca temporal"] || a["Fecha"]) - parseDateRobust(b["Marca temporal"] || b["Fecha"]));

  // Función para encontrar columnas dando prioridad al orden de las keywords
  const getFuzzy = (row, keywords) => {
    const keys = Object.keys(row);
    // 1. Prioridad máxima: Coincidencia exacta
    for (const kw of keywords) {
      for (const key of keys) {
        if (key.toLowerCase().trim() === kw.toLowerCase().trim()) return row[key];
      }
    }
    // 2. Prioridad media: La columna incluye la keyword (respetando orden de keywords)
    for (const kw of keywords) {
      for (const key of keys) {
        if (key.toLowerCase().includes(kw.toLowerCase())) return row[key];
      }
    }
    return null;
  };

  const parsed = dataArray.map(row => {
    // Obtener la fecha. Prioridad absoluta: 'fecha' (Timestamp), luego 'marca temporal'
    const rawDate = row["Fecha"] || getFuzzy(row, ["fecha", "timestamp", "marca temporal"]) || row["Marca temporal"];
    const d = parseDateRobust(rawDate);

    const rawStatus = getFuzzy(row, ["ruedas en eléctrico", "rodamos con", "ruedas", "eléctrico", "futuro"]);
    const rawName = getFuzzy(row, ["nombre", "name"]);
    const rawPhone = getFuzzy(row, ["número de celular", "numero de celular", "celular", "teléfono", "telefono"]);
    const rawEmail = getFuzzy(row, ["correo", "email", "electrónico", "electronico"]);

    // BÚSQUEDA POR VALOR (Garantiza 100% de precisión sin importar el título de la columna)
    let rawBranch = null;
    let rawProduct = null;
    let rawFranquicia = null;

    for (const key of Object.keys(row)) {
      const v = String(row[key]).toLowerCase().trim();

      // Si el valor contiene alguna sucursal conocida
      if (v.includes("vallarta") || v.includes("juárez") || v.includes("juarez") ||
        v.includes("colón") || v.includes("colon") || v.includes("obregón") ||
        v.includes("obregon") || v.includes("punto sur") || v.includes("puebla")) {
        rawBranch = row[key];
      }

      // Si el valor contiene algún producto conocido
      else if (v.includes("scooter") || v.includes("bicicleta") || v.includes("moto") || v.includes("trimoto")) {
        rawProduct = row[key];
      }

      // Si el valor es exactamente "sí", "(sí)", "si", "(si)", "no" o "(no)"
      // Dado que el resto de las preguntas tienen respuestas largas, el único "Sí/No" puro es el de Emprender
      else if (v === "sí" || v === "si" || v === "(sí)" || v === "(si)" || v === "no" || v === "(no)") {
        rawFranquicia = row[key];
      }
    }

    const valFranquicia = String(rawFranquicia || "").toLowerCase().trim();
    const valStatus = String(rawStatus || "").toLowerCase().trim();

    // Limpieza de nombre de sucursal
    let cleanBranch = "Online";
    if (rawBranch) {
      const bLow = String(rawBranch).toLowerCase();
      if (bLow.includes("vallarta")) cleanBranch = "Vallarta";
      else if (bLow.includes("juárez") || bLow.includes("juarez")) cleanBranch = "Juárez";
      else if (bLow.includes("colón") || bLow.includes("colon")) cleanBranch = "Colón";
      else if (bLow.includes("obregón") || bLow.includes("obregon")) cleanBranch = "Obregón";
      else if (bLow.includes("punto sur")) cleanBranch = "Plaza Punto Sur";
      else if (bLow.includes("puebla")) cleanBranch = "Puebla";
      else cleanBranch = String(rawBranch).replace(/\s*\d+\.?$/, "").trim();
    }

    const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    return {
      dateObj: d,
      dateStr: localDateStr,
      hour: d.getHours(),
      dayOfWeek: d.getDay(), // 0 = Dom, 1 = Lun...
      name: rawName || "Anónimo",
      phone: rawPhone || "",
      email: rawEmail || "",
      isNewInElectric: valStatus.includes("todavía no") || valStatus.includes("todavia no") || valStatus.includes("no me subo") || valStatus === "no",
      status: rawStatus || "No respondido",
      franchise: valFranquicia.includes('sí') || valFranquicia.includes('si') || valFranquicia === 'yes' || rawFranquicia === true,
      branch: cleanBranch,
      product: rawProduct || "Aún no decido"
    };
  });

  return parsed;
}

// ------------------------------------------------------------------
// RENDERIZADO
// ------------------------------------------------------------------

let globalFranchiseLeads = [];

function renderAll(data) {
  if (!data || data.length === 0) return;

  // Guardar los prospectos VIP globalmente para el Modal
  globalFranchiseLeads = data.filter(d => d.franchise).sort((a, b) => b.dateObj - a.dateObj);

  renderKPIs(data);

  // Agrupaciones
  const byBranch = countBy(data, 'branch');
  const byProduct = countBy(data, 'product');
  const timeline = aggregateTimeline(data);
  const hourly = countBy(data, 'hour');

  renderBranchesChart(byBranch);
  renderProductsChart(byProduct);
  renderTimelineChart(timeline);
  renderHourlyChart(hourly);
  renderProfileChart(data);
  renderHeatmap(data);
}

function renderKPIs(data) {
  const total = data.length;

  // Fechas (Hoy y Ayer en hora local)
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const todayCount = data.filter(d => d.dateStr === todayStr).length;
  const yesterdayCount = data.filter(d => d.dateStr === yesterdayStr).length;

  // Tendencia
  let trendText = "--";
  let trendClass = "bg-white/10 text-gray-300";
  if (yesterdayCount > 0) {
    const pct = Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100);
    if (pct > 0) {
      trendText = `+${pct}% vs ayer`;
      trendClass = "bg-green-500/20 text-green-400";
    } else if (pct < 0) {
      trendText = `${pct}% vs ayer`;
      trendClass = "bg-red-500/20 text-red-400";
    } else {
      trendText = `Igual que ayer`;
      trendClass = "bg-gray-500/20 text-gray-300";
    }
  } else if (todayCount > 0) {
    trendText = `+100% vs ayer`;
    trendClass = "bg-green-500/20 text-green-400";
  }

  const trendEl = document.getElementById("kpi-trend");
  if (trendEl) {
    trendEl.textContent = trendText;
    trendEl.className = `text-[10px] sm:text-xs whitespace-nowrap font-semibold px-1.5 sm:px-2 py-0.5 rounded mb-0.5 ${trendClass}`;
  }

  // Nuevos en Eléctrico
  const newElectricCount = data.filter(d => d.isNewInElectric).length;
  const newElectricPercent = total > 0 ? Math.round((newElectricCount / total) * 100) : 0;

  // Potenciales Distribuidores
  const distCount = data.filter(d => d.franchise).length;
  const distPercent = total > 0 ? Math.round((distCount / total) * 100) : 0;

  // Sucursal líder
  const byBranch = countBy(data, 'branch');
  let topBranch = "--";
  let maxBranch = 0;
  for (const [branch, count] of Object.entries(byBranch)) {
    if (count > maxBranch) {
      maxBranch = count;
      topBranch = branch;
    }
  }

  // Animación para contadores
  animateValue("kpi-total", 0, total, 1000);
  animateValue("kpi-today", 0, todayCount, 1000);
  animateValue("kpi-franchise", 0, newElectricPercent, 1000, "%");

  if (document.getElementById("kpi-distributors")) {
    animateValue("kpi-distributors", 0, distCount, 1000);
    document.getElementById("kpi-distributors-pct").textContent = `(${distPercent}%)`;
  }

  // Sucursal Líder
  const branches = countBy(data, 'branch');
  delete branches['Online'];
  if (Object.keys(branches).length > 0) {
    const topBranch = Object.keys(branches).reduce((a, b) => branches[a] > branches[b] ? a : b);
    document.getElementById('kpi-branch').textContent = topBranch;
    const el = document.getElementById('kpi-branch-count');
    if (el) el.textContent = branches[topBranch];
  } else {
    document.getElementById('kpi-branch').textContent = "N/A";
    const el = document.getElementById('kpi-branch-count');
    if (el) el.textContent = "0";
  }
}

// ------------------------------------------------------------------
// GRÁFICAS (Chart.js)
// ------------------------------------------------------------------

function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
  }
}

function renderBranchesChart(byBranch) {
  destroyChart('branchesChart');
  const ctx = document.getElementById('branchesChart').getContext('2d');

  // Ordenar descendente
  const sorted = Object.entries(byBranch).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(i => i[0]);
  const data = sorted.map(i => i[1]);

  charts['branchesChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Leads',
        data: data,
        backgroundColor: colors.yellow,
        borderRadius: 4,
        barPercentage: 0.6
      }]
    },
    options: {
      indexAxis: 'y', // barras horizontales
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { beginAtZero: true, grid: { color: colors.gridLines } },
        y: { grid: { display: false } }
      }
    }
  });
}

function renderProductsChart(byProduct) {
  destroyChart('productsChart');
  const ctx = document.getElementById('productsChart').getContext('2d');

  const sorted = Object.entries(byProduct).sort((a, b) => b[1] - a[1]);

  charts['productsChart'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(i => i[0]),
      datasets: [{
        data: sorted.map(i => i[1]),
        backgroundColor: colors.palette,
        borderWidth: 1,
        borderColor: colors.darkGray,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } }
      }
    }
  });
}

function renderTimelineChart(timelineMap) {
  destroyChart('timelineChart');
  const ctx = document.getElementById('timelineChart').getContext('2d');

  const dates = Object.keys(timelineMap).sort();
  if (dates.length === 0) return;

  const start = new Date(dates[0]);
  const end = new Date(dates[dates.length - 1]);

  const labels = [];
  const data = [];

  // Rellenar días faltantes con 0
  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    const dStr = dt.toISOString().split('T')[0];
    labels.push(dStr);
    data.push(timelineMap[dStr] || 0);
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(253, 203, 9, 0.4)'); // amarillo con opacidad
  gradient.addColorStop(1, 'rgba(253, 203, 9, 0.0)');

  charts['timelineChart'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Leads por Día',
        data: data,
        borderColor: colors.yellow,
        backgroundColor: gradient,
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: colors.black,
        pointBorderColor: colors.yellow,
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: colors.gridLines } }
      }
    }
  });
}

function renderHourlyChart(hourlyMap) {
  destroyChart('hourlyChart');
  const ctx = document.getElementById('hourlyChart').getContext('2d');

  const labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
  const data = Array.from({ length: 24 }, (_, i) => hourlyMap[i] || 0);

  // Encontrar la Hora Pico
  let maxVal = 0;
  let peakH = 0;
  data.forEach((val, i) => {
    if (val > maxVal) { maxVal = val; peakH = i; }
  });

  document.getElementById('peak-hour').textContent = `${peakH}:00 - ${peakH + 1}:00`;

  // Resaltar la hora pico
  const bgColors = data.map((val, i) => i === peakH ? colors.yellow : 'rgba(253, 203, 9, 0.15)');

  charts['hourlyChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Leads',
        data: data,
        backgroundColor: bgColors,
        borderRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, display: false }
      }
    }
  });
}

function renderProfileChart(data) {
  destroyChart('profileChart');
  const ctx = document.getElementById('profileChart');
  if (!ctx) return;

  const novatos = data.filter(d => d.isNewInElectric);
  const expertos = data.filter(d => !d.isNewInElectric);

  // Actualizar conteos
  const elNewCount = document.getElementById('profile-new-count');
  const elExpCount = document.getElementById('profile-exp-count');
  if (elNewCount) elNewCount.textContent = novatos.length;
  if (elExpCount) elExpCount.textContent = expertos.length;

  // Obtener productos únicos, excluyendo 'Aún no decido' u organizarlos mejor
  let products = [...new Set(data.map(d => d.product))].filter(Boolean);

  const novatosData = products.map(p => novatos.filter(d => d.product === p).length);
  const expertosData = products.map(p => expertos.filter(d => d.product === p).length);

  charts['profileChart'] = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: products,
      datasets: [
        {
          label: 'Novatos (1ra vez)',
          data: novatosData,
          backgroundColor: '#eab308',
          borderRadius: 4
        },
        {
          label: 'Expertos (Ya ruedan)',
          data: expertosData,
          backgroundColor: '#4b5563',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, color: '#9ca3af' } },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { stepSize: 1, color: '#9ca3af' } }
      }
    }
  });
}

function renderHeatmap(data) {
  const container = document.getElementById('heatmap-container');
  container.innerHTML = '';

  // Matriz: 7 días x 24 horas
  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
  let maxHeat = 0;

  data.forEach(d => {
    // JS getDay(): 0 = Dom, 1 = Lun. Ajustamos para que Lunes sea 0
    let day = d.dayOfWeek - 1;
    if (day < 0) day = 6;

    matrix[day][d.hour]++;
    if (matrix[day][d.hour] > maxHeat) maxHeat = matrix[day][d.hour];
  });

  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-[auto_repeat(24,1fr)] gap-1 text-[10px] items-center';

  // Fila de encabezado (horas)
  grid.appendChild(document.createElement('div')); // Esquina vacía
  for (let i = 0; i < 24; i += 2) {
    const h = document.createElement('div');
    h.className = 'col-span-2 text-center text-gray-500';
    h.textContent = `${i}h`;
    grid.appendChild(h);
  }

  // Filas por día
  for (let d = 0; d < 7; d++) {
    const label = document.createElement('div');
    label.className = 'pr-2 text-right text-gray-400 font-semibold';
    label.textContent = days[d];
    grid.appendChild(label);

    for (let h = 0; h < 24; h++) {
      const val = matrix[d][h];
      const cell = document.createElement('div');

      // Calcular opacidad en base a maxHeat
      let opacity = 0.05;
      if (val > 0) {
        opacity = 0.2 + (0.8 * (val / maxHeat));
      }

      cell.className = 'heatmap-cell aspect-square rounded-[2px] cursor-pointer relative group';
      if (val === 0) {
        cell.style.backgroundColor = `rgba(255, 255, 255, 0.05)`;
      } else {
        cell.style.backgroundColor = `rgba(253, 203, 9, ${opacity})`;
        cell.title = `${days[d]} a las ${h}h: ${val} leads`;
      }

      grid.appendChild(cell);
    }
  }

  container.appendChild(grid);
}

// ------------------------------------------------------------------
// UTILIDADES
// ------------------------------------------------------------------

function countBy(data, key) {
  return data.reduce((acc, row) => {
    const val = row[key];
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

function aggregateTimeline(data) {
  return data.reduce((acc, row) => {
    acc[row.dateStr] = (acc[row.dateStr] || 0) + 1;
    return acc;
  }, {});
}

function animateValue(id, start, end, duration, suffix = "") {
  if (start === end) {
    document.getElementById(id).innerHTML = end + suffix;
    return;
  }
  const obj = document.getElementById(id);
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    // Ease out quad
    const easeProgress = progress * (2 - progress);
    const current = Math.floor(easeProgress * (end - start) + start);
    obj.innerHTML = current + suffix;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.innerHTML = end + suffix;
    }
  };
  window.requestAnimationFrame(step);
}

// ------------------------------------------------------------------
// GENERADOR DE DATOS DE PRUEBA (MOCK DATA)
// ------------------------------------------------------------------

function generateMockData() {
  const sucursales = [
    "Vallarta 1696",
    "Juárez 273",
    "Colón 108",
    "Obregón 236",
    "Plaza Punto Sur Local 116",
    "Puebla, Av. 2 Poniente 1103."
  ];
  const productos = ["Scooter", "Bicicleta y Motonetas", "Moto y Trimoto"];
  const estados = ["Si, ya ruedo en uno.", "No, todavía no me subo."];

  const data = [];
  const totalLeads = 185;
  const now = new Date();

  for (let i = 0; i < totalLeads; i++) {
    const daysAgo = Math.floor(Math.random() * 14);
    const randomDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));

    let hour = Math.floor(Math.random() * 24);
    if (Math.random() > 0.5) hour = 10 + Math.floor(Math.random() * 5); // 10-14
    else if (Math.random() > 0.5) hour = 16 + Math.floor(Math.random() * 5); // 16-20

    randomDate.setHours(hour);
    randomDate.setMinutes(Math.floor(Math.random() * 60));

    data.push({
      "Marca temporal": randomDate.toISOString(),
      "Nombre": `Usuario ${i + 1}`,
      "Número de Celular": `55${Math.floor(10000000 + Math.random() * 90000000)}`,
      "Correo Electrónico": `user${i + 1}@example.com`,
      "¿Ya ruedas en eléctrico o aún no te subes al futuro?": estados[Math.floor(Math.random() * estados.length)],
      "¿Te interesa información para emprender con Honey Whale?": Math.random() > 0.7 ? "Sí" : "No",
      "¿En qué sucursal estás solicitando tu certificado de $1000?": sucursales[Math.floor(Math.random() * sucursales.length)],
      "¿Qué equipo Honey Whale vas a comprar?": productos[Math.floor(Math.random() * productos.length)]
    });
  }

  for (let j = 0; j < 5; j++) {
    const todayDate = new Date();
    todayDate.setHours(10 + j);
    data.push({
      "Marca temporal": todayDate.toISOString(),
      "Nombre": `Cliente Hoy ${j + 1}`,
      "Número de Celular": `559999888${j}`,
      "Correo Electrónico": `nuevo${j}@example.com`,
      "¿Ya ruedas en eléctrico o aún no te subes al futuro?": "No, todavía no me subo.",
      "¿Te interesa información para emprender con Honey Whale?": "Sí",
      "¿En qué sucursal estás solicitando tu certificado de $1000?": "Vallarta 1696",
      "¿Qué equipo Honey Whale vas a comprar?": "Scooter"
    });
  }

  return data;
}

// ------------------------------------------------------------------
// MODAL DE PROSPECTOS VIP
// ------------------------------------------------------------------

function openLeadsModal() {
  const modal = document.getElementById('leads-modal');
  const tbody = document.getElementById('modal-table-body');
  if (!modal || !tbody) return;

  tbody.innerHTML = '';

  if (globalFranchiseLeads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-5 py-8 text-center text-gray-500">Aún no hay prospectos registrados.</td></tr>`;
  } else {
    globalFranchiseLeads.forEach(lead => {
      // Formatear teléfono si es posible, o mostrarlo directo
      const phoneDisplay = lead.phone || 'Sin número';
      // Crear botón de WhatsApp
      const cleanPhone = lead.phone ? lead.phone.replace(/\D/g, '') : '';
      let waButton = `<span class="text-xs text-gray-600">No disp.</span>`;
      if (cleanPhone.length >= 10) {
        const waLink = `https://wa.me/52${cleanPhone}?text=Hola%20${encodeURIComponent(lead.name)},%20vimos%20tu%20inter%C3%A9s%20en%20distribuir%20Honey%20Whale.`;
        waButton = `
          <a href="${waLink}" target="_blank" class="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/20 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5 active:scale-95 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span class="hidden sm:inline">Contactar</span>
          </a>
        `;
      }

      const tr = document.createElement('tr');
      tr.className = "hover:bg-brand-yellow/5 transition-colors";
      tr.innerHTML = `
        <td class="px-3 sm:px-5 py-4 text-gray-400 hidden sm:table-cell">
          <div class="text-white">${lead.dateObj.toLocaleDateString()}</div>
          <div class="text-xs">${lead.dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </td>
        <td class="px-3 sm:px-5 py-4 min-w-0">
          <div class="font-medium text-white truncate max-w-[150px] sm:max-w-none">${lead.name}</div>
          <div class="text-sm text-gray-400 mt-0.5">${phoneDisplay}</div>
          <div class="sm:hidden mt-1">
            <span class="bg-brand-yellow/10 text-brand-yellow px-1.5 py-0.5 rounded text-[10px] border border-brand-yellow/20 whitespace-normal break-words">${lead.branch}</span>
          </div>
        </td>
        <td class="px-3 sm:px-5 py-4 hidden sm:table-cell">
          <div class="text-gray-300 font-medium">${lead.product}</div>
          <div class="mt-1">
            <span class="bg-brand-yellow/10 text-brand-yellow px-1.5 py-0.5 rounded text-[10px] border border-brand-yellow/20">${lead.branch}</span>
          </div>
        </td>
        <td class="px-3 sm:px-5 py-4 text-right sm:text-center">
          ${waButton}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Mostrar
  modal.classList.remove('hidden');
  // Pequeño delay para la animación de opacidad
  setTimeout(() => modal.classList.remove('opacity-0'), 10);
}

function closeLeadsModal() {
  const modal = document.getElementById('leads-modal');
  if (!modal) return;

  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

// Cerrar con tecla ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLeadsModal();
});
