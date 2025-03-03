require('dotenv').config();
const express = require('express');
const http = require('http'); // Import the HTTP module
const { initializePinecone } = require('./services/pineconeService.js');
const { initializeSignaling } = require('./signaling/signalServer.js');
const userRoute = require('./routes/userRoute.js');
const cors = require('cors');
// const { getIndex } = require('./services/pineconeService.js')
const app = express();
const PORT = process.env.PORT || 3000;

const startApp = async () => {
  try {
    await initializePinecone(); // Initialize Pinecone client
    // console.log('Index after initialization:', getIndex());

    // Setup middleware
    app.use(express.json());
    app.use(cors({
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true, // if you need to pass cookies or auth headers
    }));
    app.use('/', userRoute);

    // Create an HTTP server and attach Express
    const server = http.createServer(app);

    // Initialize the Socket.IO signaling server by attaching it to the HTTP server
    initializeSignaling(server);

    // Start the server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running at port: ${PORT}`);
    });
  } catch (error) {
    console.error('Error initializing Pinecone:', error);
  }
};

startApp();
