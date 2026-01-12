const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const { v4: uuidv4 } = require('uuid');
const { ExpressPeerServer } = require('peer');

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

app.use('/peerjs', peerServer);
app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.redirect(`/${uuidv4()}`);
});

app.get('/:room', (req, res) => {
  res.render('room', { roomId: req.params.room });
});

io.on('connection', socket => {
  socket.on('join-room', (roomId, userId, userName) => {
    socket.join(roomId);
    // Odaya girene hoş geldin de, diğerlerine haber ver
    socket.to(roomId).emit('user-connected', userId, userName);

    // Mesaj gönderildiğinde herkese yay
    socket.on('message', (message) => {
      io.to(roomId).emit('createMessage', message, userName);
    });

    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-disconnected', userId);
    });
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Sunucu çalışıyor.');

});
