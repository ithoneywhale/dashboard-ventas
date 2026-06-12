const CONFIG = {
  // Configuración de Pusher (Tiempo Real)
  pusherKey: "da1c97bf769b5abdf3e2", // Llave de Pusher
  pusherCluster: "us2",

  // Configuraciones del Dashboard
  webhookUrl: "https://flows.honey-whale.com/webhook/sheets", // URL de donde lee los datos completos
  webhookToken: "0eWWWKL45SDzLxf9isf9hdQRKgVOi6WAkbxYF5kSUK4l97S0biaRgk4IpWHEyfTW",
  campañaNombre: "Bono Verde",
  refreshInterval: 0, // Apagamos el polling (antes en 60), ahora usamos tiempo real
  sucursales: [],
};
