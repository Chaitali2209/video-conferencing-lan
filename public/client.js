const socket = io();
const startBtn = document.getElementById("start");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("messageInput");
const fileInput = document.getElementById("fileInput");
const fileStatus = document.getElementById("fileStatus");

let localStream;
let peerConnection;

const config = {
  iceServers: [] // no STUN/TURN needed on LAN
};

startBtn.onclick = async () => {
  startBtn.disabled = true;

  // Get local media
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  // Create peer connection
  peerConnection = new RTCPeerConnection(config);

  // Add local tracks
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Handle remote stream
  peerConnection.ontrack = event => {
    if (!remoteVideo.srcObject) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("candidate", event.candidate);
    }
  };

  // Initiate offer if first to start
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", offer);
};

// Handle incoming signaling
socket.on("offer", async offer => {
  if (!peerConnection) startBtn.click(); // auto-start if not started

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", answer);
});

socket.on("answer", async answer => {
  await peerConnection.setRemoteDescription(answer);
});

socket.on("candidate", async candidate => {
  try {
    await peerConnection.addIceCandidate(candidate);
  } catch (e) {
    console.error("Error adding ICE candidate:", e);
  }
});

// Chat
function sendMessage() {
  const msg = messageInput.value.trim();
  if (msg) {
    appendMessage("You", msg);
    socket.emit("chat-message", msg);
    messageInput.value = "";
  }
}

socket.on("chat-message", msg => {
  appendMessage("Peer", msg);
});

function appendMessage(sender, msg) {
  chatBox.value += `${sender}: ${msg}\n`;
  chatBox.scrollTop = chatBox.scrollHeight;
}

// File transfer
function sendFile() {
  const file = fileInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      socket.emit("file-transfer", {
        fileName: file.name,
        fileData: reader.result
      });
      fileStatus.innerText = `Sent file: ${file.name}`;
    };
    reader.readAsDataURL(file);
  }
}

socket.on("file-transfer", data => {
  const link = document.createElement("a");
  link.href = data.fileData;
  link.download = data.fileName;
  link.textContent = `Download ${data.fileName}`;
  link.style.display = "block";
  document.body.appendChild(link);
  fileStatus.innerText = `Received file: ${data.fileName}`;
});
