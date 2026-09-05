const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

io.on('connection', (socket) => {
  // Relay drawing coordinates to all connected clients (including OBS)
  socket.on('draw', (data) => {
    socket.broadcast.emit('draw', data);
  });

  // Relay clear screen command
  socket.on('clear', () => {
    io.emit('clear');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));