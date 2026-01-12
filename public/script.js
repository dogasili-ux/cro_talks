const socket = io('/');
const videoGrid = document.getElementById('video-grid');
// PeerJS Bulut Sunucusu ve Google STUN Sunucuları
const myPeer = new Peer(undefined, {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  }
  // host, port ve path satırlarını SİLDİK. Artık otomatiğe bağlandı.
});

let myVideoStream;
let myVideo = document.createElement('video');
myVideo.muted = true; // Kendi sesini duyma
const peers = {};

// Kullanıcıdan İsim İste
let USER_NAME = prompt("Lütfen adınızı girin:", "Misafir") || "Misafir";

// 1. Kamera ve Mikrofon İzni Al
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  myVideoStream = stream;
  addVideoStream(myVideo, stream, USER_NAME + " (Sen)");

  // Biri aradığında yanıtla
  myPeer.on('call', call => {
    call.answer(stream);
    const video = document.createElement('video');
    // Karşı tarafın adını veri akışından almak zor, şimdilik "Kullanıcı" diyoruz
    call.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream, "Kullanıcı");
    });
  });

  // Yeni kullanıcı gelince
  socket.on('user-connected', (userId, userName) => {
    connectToNewUser(userId, stream, userName);
    alert(userName + " odaya katıldı!");
  });
});

// Kullanıcı çıkınca
socket.on('user-disconnected', userId => {
  if (peers[userId]) peers[userId].close();
});

// Peer Bağlantısı Açılınca
myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID, id, USER_NAME);
});

// --- FONKSİYONLAR ---

function connectToNewUser(userId, stream, userName) {
  const call = myPeer.call(userId, stream);
  const video = document.createElement('video');
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream, userName);
  });
  call.on('close', () => {
    video.parentElement.remove(); // Kutuyu tamamen sil
  });
  peers[userId] = call;
}

function addVideoStream(video, stream, name) {
  const container = document.createElement('div');
  container.className = 'video-container';
  
  const nameTag = document.createElement('div');
  nameTag.className = 'user-tag';
  nameTag.innerText = name;

  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });

  container.append(video);
  container.append(nameTag);
  videoGrid.append(container);
}

// --- KONTROLLER (Mute/Video/Share) ---

const muteButton = document.getElementById('muteButton');
const stopVideoButton = document.getElementById('stopVideoButton');
const screenShareButton = document.getElementById('screenShareButton');

// Ses Aç/Kapat
muteButton.addEventListener('click', () => {
  const enabled = myVideoStream.getAudioTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getAudioTracks()[0].enabled = false;
    muteButton.classList.add('active');
    muteButton.innerText = "🔇";
  } else {
    myVideoStream.getAudioTracks()[0].enabled = true;
    muteButton.classList.remove('active');
    muteButton.innerText = "🎤";
  }
});

// Video Aç/Kapat
stopVideoButton.addEventListener('click', () => {
  const enabled = myVideoStream.getVideoTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getVideoTracks()[0].enabled = false;
    stopVideoButton.classList.add('active');
    stopVideoButton.innerText = "🚫";
  } else {
    myVideoStream.getVideoTracks()[0].enabled = true;
    stopVideoButton.classList.remove('active');
    stopVideoButton.innerText = "📷";
  }
});

// Ekran Paylaşımı
screenShareButton.addEventListener('click', () => {
  navigator.mediaDevices.getDisplayMedia({
    video: { cursor: "always" },
    audio: { echoCancellation: true, noiseSuppression: true }
  }).then(screenStream => {
    let videoTrack = screenStream.getVideoTracks()[0];
    let audioTrack = screenStream.getAudioTracks()[0];

    // İzleri değiştir
    for (let peerId in peers) {
      let sender = peers[peerId].peerConnection.getSenders().find(s => s.track.kind === "video");
      if(sender) sender.replaceTrack(videoTrack);
    }
    
    // Kendi görüntümüzü güncelle
    myVideo.srcObject = screenStream;
    
    // Paylaşım bitince kameraya dön
    videoTrack.onended = () => {
      let camTrack = myVideoStream.getVideoTracks()[0];
      for (let peerId in peers) {
        let sender = peers[peerId].peerConnection.getSenders().find(s => s.track.kind === "video");
        if(sender) sender.replaceTrack(camTrack);
      }
      myVideo.srcObject = myVideoStream;
    };
  });
});

// --- SOHBET SİSTEMİ ---

let text = document.querySelector("#chat_message");
let messagesList = document.querySelector(".messages");

// Enter'a basınca mesaj at
text.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && text.value.length !== 0) {
    socket.emit("message", text.value);
    text.value = "";
  }
});

// Mesaj gelince ekrana yaz
socket.on("createMessage", (message, senderName) => {
  let li = document.createElement("li");
  li.className = 'message-item';
  li.innerHTML = `<b>${senderName}:</b> ${message}`;
  messagesList.append(li);
  // Otomatik aşağı kaydır
  let window = document.querySelector(".chat-window");
  window.scrollTop = window.scrollHeight;

});
