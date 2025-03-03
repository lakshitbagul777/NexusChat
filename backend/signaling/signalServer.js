// src/signaling/signalServer.js
const socketIo = require('socket.io');
const { removeUserVector } = require('../services/pineconeService')
// Store connected users in a module-level object so that it persists across connections.
const connectedUsers = {};

// This function attaches Socket.IO to your HTTP server
function initializeSignaling(server) {
  const io = socketIo(server, {
    cors: {
      origin: "*", // allow your frontend origin
      methods: ["GET", "POST"],
    },
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('incall-call-declined', ({ userId, senderSocketId }) => {
      io.to(senderSocketId).emit('incall-call-declined', { senderSocketId: userId });
    })

    socket.on('make-available', ({ userId }) => {
      updateUserStatus(userId, { available: false, inCallWith: null })
    })

    socket.on('end-call', async ({ userId, targetSocketId }) => {

      updateUserStatus(userId, { available: false, inCallWith: null });
      updateUserStatus(targetSocketId, { available: false, inCallWith: null });

      io.to(targetSocketId).emit('end-call');
    });

    socket.on('match-found', async (data) => {
      const { callerId, calleeId } = data;

      updateUserStatus(callerId, { inCallWith: calleeId, available: false });
      updateUserStatus(calleeId, { inCallWith: callerId, available: false });

      if (callerId && calleeId) {
        console.log('Caller is: ', callerId);
        io.to(callerId).emit('call-started');
        io.to(callerId).emit('start-call', { targetSocketId: calleeId, isCaller: true });
        io.to(calleeId).emit('start-call', { targetSocketId: callerId, isCaller: false });
      } else {
        console.error(`Match error: missing socket for callerId: ${callerId} or calleeId: ${calleeId}`);
      }
    });

    // Relay WebRTC signaling messages
    socket.on('offer', (offer, targetSocketId) => {
      io.to(targetSocketId).emit('offer', offer, socket.id);
    });

    socket.on('answer', (answer, targetSocketId) => {
      io.to(targetSocketId).emit('answer', answer, socket.id);
    });

    socket.on('ice-candidate', (candidate, targetSocketId) => {
      io.to(targetSocketId).emit('ice-candidate', candidate, socket.id);
    });

    // Cleanup on disconnect
    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);
      const user = connectedUsers[socket.id];

      if (user) {
        const { inCallWith } = user;

        if (inCallWith && connectedUsers[inCallWith]) {
          updateUserStatus(inCallWith, { available: false, inCallWith: null });
          if (io.sockets.sockets.get(inCallWith)) {
            io.to(inCallWith).emit('end-call');
          }
        }

        await removeUserVector(socket.id);
        delete connectedUsers[socket.id];
        console.log(`User ${socket.id} removed from connected users`);
      }
    });

  });

  return io;
}

// Export a method to get online user IDs.
// This returns an array of keys from the connectedUsers object.
async function getOnlineUsers(currentUserId) {
  // console.log(connectedUsers);

  return Object.keys(connectedUsers)
    .filter(userId => userId !== currentUserId && connectedUsers[userId].available === true);
}

function updateUserStatus(userId, updates) {
  if (!connectedUsers[userId]) {
    connectedUsers[userId] = { available: false, inCallWith: null }; // Default values
  }
  Object.assign(connectedUsers[userId], updates);
}


module.exports = {
  initializeSignaling,
  getOnlineUsers,
  updateUserStatus
};
