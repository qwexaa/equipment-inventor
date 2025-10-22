import dotenv from 'dotenv';
dotenv.config();
import http from 'http';
import app from './web/app.js';
import { seedAdmin } from './web/bootstrap/seedAdmin.js';
import { seedEquipment } from './web/bootstrap/seedEquipment.js';
import { seedUsers } from './web/bootstrap/seedUsers.js';
import { seedWarehouse } from './web/bootstrap/seedWarehouse.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

async function start() {
  try {
    await seedAdmin();
    await seedEquipment();
    await seedUsers();
    await seedWarehouse();
  } catch (e) {
    console.error('Admin seed failed', e);
  }
  const server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

start();
