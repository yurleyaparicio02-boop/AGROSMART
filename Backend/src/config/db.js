const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.DATA_MONGODB_URI;
    await mongoose.connect(uri);
    console.log('✅ Conectado a MongoDB exitosamente');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1); // Detiene el servidor si la base de datos falla
  }
};

module.exports = connectDB;