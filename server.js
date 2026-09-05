const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// 1. SERVE THE HTML FRONTEND & CANVAS DIRECTLY FROM THE ROOT ROUTE
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stream Drawing Canvas</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
</head>
<body class="bg-transparent m-0 overflow-hidden min-h-screen flex flex-col items-center justify-center touch-none">

  <!-- UI Controls (Auto-hidden inside OBS) -->
  <div id="controls" class="fixed top-4 z-20 flex gap-4 bg-slate-900/90 border border-slate-700 p-3 rounded-xl shadow-xl backdrop-blur">
    <input type="color" id="colorPicker" value="#ef4444" class="w-8 h-8 rounded cursor-pointer bg-transparent border-0">
    <input type="range" id="lineWidth" min="2" max="25" value="6" class="accent-indigo-500 cursor-pointer">
    <button id="clearBtn" class="bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold px-3 py-1 rounded transition">Clear Screen</button>
  </div>

  <!-- Drawing Canvas -->
  <canvas id="canvas" class="w-full h-full cursor-crosshair absolute inset-0"></canvas>

  <script>
    // Connect auto-detects host (works on Render automatically)
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
      const pos = getPos(e);
      draw(pos.x, pos.y, colorPicker.value, lineWidth.value, true);
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
      draw(pos.x, pos.y, colorPicker.value, lineWidth.value, true);
    }

    function draw(x, y, color, size, emit = false) {
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;

      ctx.lineTo(x * canvas.width, y * canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x * canvas.width, y * canvas.height);

      if (emit && socket.connected) {
        socket.emit('draw', { x, y, color, size });
      }
    }

    // Input Listeners
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

    // Receive incoming drawing data from other viewers/streamer
    socket.on('draw', (data) => {
      if (data.isEnd) {
        ctx.beginPath();
      } else {
        draw(data.x, data.y, data.color, data.size, false);
      }
    });

    socket.on('clear', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
    });

    // Hide controls if opened inside OBS overlay mode
    if (window.location.search.includes('obs=true')) {
      document.getElementById('controls').style.display = 'none';
    }
  </script>
</body>
</html>
  `);
});

// 2. SOCKET.IO REAL-TIME WEBSOCKET HANDLERS
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
