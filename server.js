const fs = require("fs");
const express = require("express");
const https = require("https"); // for HTTPS (optional)
const http = require("http");   // for fallback
const socketIo = require("socket.io");

const useHttps = false; // change to true if using HTTPS with certs

const app = express();
app.use(express.static("public"));

let server;
if (useHttps) {
  const options = {
    key: fs.readFileSync("key.pem"),
    cert: fs.readFileSync("cert.pem")
  };
  server = https.createServer(options, app);
} else {
  server = http.createServer(app);
}

const io = socketIo(server, { maxHttpBufferSize: 5 * 1024 * 1024});

io.on("connection", socket => {
  console.log("A user connected");

  socket.on("offer", data => socket.broadcast.emit("offer", data));
  socket.on("answer", data => socket.broadcast.emit("answer", data));
  socket.on("candidate", data => socket.broadcast.emit("candidate", data));
  socket.on("chat-message", msg => socket.broadcast.emit("chat-message", msg));
  socket.on("file-transfer", data => socket.broadcast.emit("file-transfer", data));

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http${useHttps ? "s" : ""}://localhost:${PORT}`);
});
