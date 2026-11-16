const express = require('express');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());

// Ruta raíz ("Hola mundo")
app.get('/', (req, res) => {
  res.json({ message: 'Hola mundo - API AgroSmart activa', ok: true });
});

// Ruta pública de salud exigida por la guía
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    ts: new Date().toISOString()
  });
});

module.exports = app;