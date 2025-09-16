// server/config/db.js
const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not set');

  console.log('>>> [db] Connecting:', uri);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000, // fail fast
    family: 4,                      // prefer IPv4 (matches server)
  });
  console.log('>>> [db] Connected');
}

async function disconnectDB() {
  await mongoose.disconnect();
  console.log('>>> [db] Disconnected');
}

module.exports = { connectDB, disconnectDB };