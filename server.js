const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// 1. VIEWER PAGE (Drawing Interface at '/')
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stream Canvas - Draw</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
</head>
<body class="bg-slate-900 m-0 overflow-hidden min-h-screen flex flex-col items-center justify-center touch-none">

  <div id="controls" class="fixed top-4 z-20 flex gap-4 bg-slate-800/90 border border-slate-700 p-3 rounded-xl shadow-xl backdrop-blur">
    <input type="color" id="colorPicker" value="#ef4444" class="w-8 h-8 rounded cursor-pointer bg-transparent border-0">
    <input type="range" id="lineWidth" min="2" max="25" value="6" class="accent-indigo-500 cursor-pointer">
    <button id="clearBtn" class="bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold px-3 py-1 rounded transition">Clear Screen</button>
  </div>

  <canvas id="canvas" class="w-full h-full cursor-crosshair absolute inset-0"></canvas>

  <script>
    const socket = io();
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const colorPicker = document.getElementById('colorPicker');
    const lineWidth = document.getElementById('lineWidth');
    const clearBtn = document.getElementById('clearBtn');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    let drawing = false;

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) / canvas.width,
        y: (clientY - rect.top) / canvas.height
      };
    }

    function startDraw(e) {
      drawing = true;
      ctx.beginPath();
      const pos = getPos(e);
      drawPoint(pos.x, pos.y, colorPicker.value, lineWidth.value, true, true);
    }

    function stopDraw() {
      if (!drawing) return;
      drawing = false;
      ctx.beginPath();
      if (socket.connected) socket.emit('draw', { isEnd: true });
    }

    function moveDraw(e) {
      if (!drawing) return;
      const pos = getPos(e);
      drawPoint(pos.x, pos.y, colorPicker.value, lineWidth.value, false, true);
    }

    function drawPoint(x, y, color, size, isStart, emit) {
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;

      const px = x * canvas.width;
      const py = y * canvas.height;

      if (isStart) {
        ctx.beginPath();
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
        ctx.stroke();
      }

      if (emit && socket.connected) {
        socket.emit('draw', { x, y, color, size, isStart });
      }
    }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mousemove', moveDraw);

    canvas.addEventListener('touchstart', startDraw);
    canvas.addEventListener('touchend', stopDraw);
    canvas.addEventListener('touchmove', moveDraw);

    clearBtn.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (socket.connected) socket.emit('clear');
    });

    socket.on('draw', (data) => {
      if (data.isEnd) {
        ctx.beginPath();
      } else {
        drawPoint(data.x, data.y, data.color, data.size, data.isStart, false);
      }
    });

    socket.on('clear', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
    });
  </script>
</body>
</html>
  `);
});

// 2. TRANSPARENT OBS OVERLAY PAGE (At '/overlay')
app.get('/overlay', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OBS Overlay</title>
  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: transparent !important;
    }
    canvas {
      display: block;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <canvas id="overlayCanvas"></canvas>

  <script>
    const socket = io();
    const canvas = document.getElementById('overlayCanvas');
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function drawPoint(data) {
      ctx.lineWidth = data.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = data.color;

      const px = data.x * canvas.width;
      const py = data.y * canvas.height;

      if (data.isStart) {
        ctx.beginPath();
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
        ctx.stroke();
      }
    }

    socket.on('draw', (data) => {
      if (data.isEnd) {
        ctx.beginPath();
      } else {
        drawPoint(data);
      }
    });

    socket.on('clear', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
    });
  </script>
</body>
</html>
  `);
});

// 3. SOCKET.IO REAL-TIME EVENT HANDLERS
io.on('connection', (socket) => {
  socket.on('draw', (data) => {
    socket.broadcast.emit('draw', data);
  });

  socket.on('clear', () => {
    io.emit('clear');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
