const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 3000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Servidor AgroSmart corriendo en http://localhost:${PORT}`);
  });
};

start();