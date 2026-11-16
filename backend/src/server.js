
import 'dotenv/config';

import app from './app.js';
import { isSupabaseConfigured } from './config/supabase.js';

const PORT = process.env.PORT || 5000;

// Start HTTP Server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================================');
  console.log(`🚀 DataStraw Backend Server listening on port: ${PORT}`);
  console.log(`📡 Health Check URL: http://localhost:${PORT}/api/health`);
  console.log(`🗄️ Supabase Status: ${isSupabaseConfigured() ? 'Connected' : 'Pending Credentials (.env)'}`);
  console.log('========================================================');
});

// Handle Server Startup Errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Fatal] Port ${PORT} is already in use.`);
  } else {
    console.error('[Fatal] Server failed to start:', err.message);
  }
  process.exit(1);
});

// Handle Unhandled Promise Rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection] at:', promise, 'reason:', reason);
});

// Handle Uncaught Exceptions
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception] thrown:', err);
  process.exit(1);
});

export default server;
