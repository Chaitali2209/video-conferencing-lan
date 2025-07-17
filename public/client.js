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
let isCaller = false;

const config = {
  iceServers: [] // no STUN/TURN for local network
};

startBtn.onclick = async () => {
  startBtn.disabled = true;
  isCaller = true;
  await startPeerConnection();
};

/* ---------- Local video / mic toggles ---------- */
const toggleVideoBtn = document.getElementById('toggleVideo');
const toggleAudioBtn = document.getElementById('toggleAudio');

toggleVideoBtn.onclick = () => {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  toggleVideoBtn.textContent = videoTrack.enabled ? 'Video Off' : 'Video On';
};

toggleAudioBtn.onclick = () => {
  if (!localStream) return;
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  toggleAudioBtn.textContent = audioTrack.enabled ? 'Mic Off' : 'Mic On';
};

/* Enable buttons once we have a stream */
function enableMediaToggles() {
  toggleVideoBtn.disabled = false;
  toggleAudioBtn.disabled = false;
}


async function startPeerConnection() {
  // Get local media
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  
  localVideo.srcObject = localStream;

  // Create RTCPeerConnection
  peerConnection = new RTCPeerConnection(config);

  // Add local tracks
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Handle remote track
  peerConnection.ontrack = event => {
    if (!remoteVideo.srcObject) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  // ICE candidate handling
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("candidate", event.candidate);
    }
  };

  // If this peer is initiating the call, create and send offer
  if (isCaller) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("offer", offer);
  }
}

// Handle offer
socket.on("offer", async offer => {
  if (!peerConnection) {
    await startPeerConnection();
  }

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", answer);
});

// Handle answer
socket.on("answer", async answer => {
  await peerConnection.setRemoteDescription(answer);
});

// Handle ICE candidates
socket.on("candidate", async candidate => {
  try {
    await peerConnection.addIceCandidate(candidate);
  } catch (err) {
    console.error("Error adding received ICE candidate", err);
  }
});


// --- Chat ---
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


// --- File Transfer ---
function sendFile() {
  const file = fileInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      const fileData = {
        fileName: file.name,
        fileData: reader.result
      };
      socket.emit("file-transfer", fileData);
      fileStatus.innerText = `Sent file: ${file.name}`;
      appendFileLink("You", fileData); // Add to list immediately
    };
    reader.readAsDataURL(file);
  }
}

socket.on("file-transfer", data => {
  fileStatus.innerText = `Received file: ${data.fileName}`;
  appendFileLink("Peer", data);
});

function appendFileLink(sender, data) {
  const fileList = document.getElementById("fileList");
  const item = document.createElement("div");
  item.className = "file-item";
  item.innerHTML = `
    <strong>${sender}:</strong>
    <a href="${data.fileData}" download="${data.fileName}">
      ${data.fileName}
    </a>
  `;
  fileList.appendChild(item);
}
