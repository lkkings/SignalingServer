const WebSocket = require("ws")
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const cfg = {
  ssl: false,
  port: 8080,
  ssl_key: 'ssl/cert.key',
  ssl_cert: 'ssl/cert.crt'
};

const httpServ = (cfg.ssl) ? require('https') : require('http');
let server = null;
if (cfg.ssl) {
  server = httpServ.createServer({
      key: fs.readFileSync(path.join(__dirname,cfg.ssl_key)),
      cert: fs.readFileSync(path.join(__dirname,cfg.ssl_cert))
  });
} else {
  server = httpServ.createServer();
}
// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server });
// 房间连接名单
// 格式{"roomId":{"user": socket}}
const rooms = {};
// 用户房间名单
// 格式{"user": "roomId"}
const userRoomMap = {};

wss.on('connection', (socket)=>{
  const user = uuidv4();
  console.log("user:",user);
  socket.on('message', (message)=>{
      if (message instanceof ArrayBuffer) {
        const buffer = Buffer.from(message); // 将ArrayBuffer转换为Buffer
        // 将Buffer对象转换为字符串
        message = buffer.toString('utf8');
        console.log('收到二进制消息并转换为字符串: ', message);
      }
      const data = JSON.parse(message);
      const { type, room,from, sender, offer, answer, candidate } = data;
      switch (type) {
          case 'create':
              const roomIds = Object.keys(rooms);
              const roomId = generateRandomNumberString(6,roomIds);
              rooms[roomId] = {};
              //加入房间
              rooms[roomId][user] = socket;
              userRoomMap[user] = roomId;

              sendTo(socket,JSON.stringify({ type: 'created', room: roomId, user}))
              break;
          case 'join':
              if (rooms[room]) {
                  //加入房间
                  rooms[room][user] = socket;
                  userRoomMap[user] = room;
                  //这里先做简单点的处理，单有新用户加入时直接返回当前房间所有用户
                  const users =  Object.keys(rooms[room]); 
                  sendToRoom(room,JSON.stringify({ type: 'joined', users, user}));    
              } else {
                  //房间不存在
                  sendTo(socket,JSON.stringify({ type: 'error', message: 'Room not found!' }))
              }
              break; 
          case 'offer':
              console.log(user, ' Sending offer to: ', sender);
              const oroom = userRoomMap[user];
              const oconn = rooms[oroom][sender];
              if (oconn) {
                  sendTo(oconn, JSON.stringify({type: 'offer',offer,user}));
              } else {
                  sendTo(socket, JSON.stringify({ type: 'error', message: 'User not found or close connect!' }));
              }
              break;
          case 'answer':
              console.log(user, ' Sending answer to: ', sender);
              const aroom = userRoomMap[user];
              const aconn = rooms[aroom][sender];
              if (aconn) {
                  sendTo(aconn, JSON.stringify({ type: 'answer',answer, user}));
              }else {
                  sendTo(socket, JSON.stringify({ type: 'error', message: 'User not found or close connect!' }));
              }
              break;
  
          case 'candidate':
              console.log(from, ' Sending candidate to: ', user);
              const croom = userRoomMap[user];
              const cconn = rooms[croom][from];
              if (cconn) {
                  sendTo(cconn, JSON.stringify({ type: 'candidate',candidate, user}));
              }else {
                  sendTo(socket,JSON.stringify({ type: 'error', message: 'User not found or close connect!' }));
              }
              break;
      }
  });
  
  socket.on('close',()=>{
      console.log('Disconnecting from ', user);
      const room = userRoomMap[user];
      if(!room){
        console.log("Not join room user left!");
        return;
      }
      console.log(`user: ${user} left from room: ${room}`);
      delete rooms[room][user];
      delete userRoomMap[user];
  
      sendToRoom(room,JSON.stringify({type: 'left',user}));
      if(rooms[room].length === 0){
          delete rooms[room];  
      }
  });
});

function sendTo(connection, message) {
  connection.send(message);
}
function sendToRoom(room,message){
  console.log('message channel ' + room + ': ' + message);
  console.log("room users: "+Object.keys(rooms[room]));
  Object.values(rooms[room]).forEach(conn=>conn.send(message));
}

function generateRandomNumberString(length, arr) {
  let result = '';
  const characters = '0123456789'; // 可以包含的数字字符

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  if (arr.includes(result)){
    return generateRandomNumberString(length, arr);
  }
  return result;
}
// 启动HTTPS服务器并监听指定端口
server.listen(cfg.port,"0.0.0.0", () => {
  console.log(`WebSocket服务器已启动，监听端口${cfg.port}`);
});