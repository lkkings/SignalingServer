const WebSocket = require("ws");
const { v4: uuidv4 } = require('uuid');
const http =  require('http');

server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server boot success!\n');
});
// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server });
// 房间连接名单
//{"roomId":{"userId":socket}}
const rooms = {};
// 用户房间名单
// 结构{"userId": "roomId"}
let userRoomMap = {};
// 管理员房间名单
//结构{"roomId":"userId"}
const roomAdminMap = {};
//管理员连接管理
//{"userId":socket}
const admins = {}
//空间换时间
const adminRoomMap = {};

wss.on('connection', (socket)=>{
  const userId = uuidv4();
  console.log("user:",userId);
  socket.on('message', (message)=>{
      try{
        const data = JSON.parse(message);
        const { type, room,from, sender, offer, answer, candidate } = data;
        switch (type) {
            case 'create':
                const roomIds = Object.keys(rooms);
                const roomId = generateRandomNumberString(6,roomIds);
                rooms[roomId] = {};
                roomAdminMap[roomId] = userId;
                adminRoomMap[userId] = roomId;
                admins[userId] = socket;
                sendTo(socket,JSON.stringify({ type: 'created', room: roomId}))
                break;
            case 'join':
                if (rooms[room]) {
                    //判断在此之前用户是否创建了房间,如果创建了房间但是进入另一个房间，则销毁原来的房间再进入
                    const roomId = adminRoomMap[userId];
                    if(roomId && roomId!==room){
                        delete rooms[roomId];
                        delete roomAdminMap[roomId];
                        delete adminRoomMap[userId];
                    }
                    //给当前用户颁发id，同时发送房间所有用户id
                    const users = Object.keys(rooms[room]);
                    sendTo(socket,JSON.stringify({type: 'joined',users,newUser:userId,first:true}));
                    //广播当前房间有新用户加入
                    sendToRoom(room,JSON.stringify({ type: 'joined', newUser:userId,first:false})); 
                    //通知管理员
                    const adminId = roomAdminMap[room];
                    const admin = admins[adminId];
                    sendTo(admin,JSON.stringify({type: 'wake'}))
                    //加入房间
                    rooms[room][userId] = socket;
                    userRoomMap[userId] = room;
                } else {
                    //房间不存在
                    sendTo(socket,JSON.stringify({ type: 'error', message: 'Room not found!' }))
                }
                break; 
            case 'offer':
                console.log(userId, ' Sending offer to: ', sender);
                const oroom = userRoomMap[userId];
                const oconn = rooms[oroom][sender];
                if (oconn) {
                    sendTo(oconn, JSON.stringify({type: 'offer',offer,user:userId}));
                } else {
                    sendTo(socket, JSON.stringify({ type: 'error', message: 'User not found or close connect!' }));
                }
                break;
            case 'answer':
                console.log(userId, ' Sending answer to: ', sender);
                const aroom = userRoomMap[userId];
                const aconn = rooms[aroom][sender];
                if (aconn) {
                    sendTo(aconn, JSON.stringify({ type: 'answer',answer, user:userId}));
                }else {
                    sendTo(socket, JSON.stringify({ type: 'error', message: 'User not found or close connect!' }));
                }
                break;
    
            case 'candidate':
                console.log(from, ' Sending candidate to: ', userId);
                const croom = userRoomMap[userId];
                const cconn = rooms[croom][from];
                if (cconn) {
                    sendTo(cconn, JSON.stringify({ type: 'candidate',candidate, user:userId}));
                }else {
                    sendTo(socket,JSON.stringify({ type: 'error', message: 'User not found or close connect!' }));
                }
                break;
            case 'ping':
                sendTo(socket,JSON.stringify({type:'pong'}));
                break;
        }
      }catch(error){
        if (error instanceof SyntaxError) {
          console.error('JSON parsing error:', error.message);
        } else {
          console.error('An unexpected error occurred:', error.message);
        }
      }
     
  });
  
  socket.on('close',()=>{
      console.log('Disconnecting from ', userId);
      let roomId = adminRoomMap[userId];
      if(roomId){
        sendToRoom(roomId,JSON.stringify({type: 'left',user:userId,admin:true}));
        //如果是管理员则解散房间
        delete roomAdminMap[roomId];
        delete adminRoomMap[userId];
        delete admins[userId];
        delete rooms[roomId]; 
        //清除该房间的所有用户
        userRoomMap = Object.fromEntries(
          Object.entries(userRoomMap).filter(([key, value]) => value !== roomId)
        );
      }else{
        //不是管理员
        roomId = userRoomMap[userId];
        if(!roomId){
          console.log("free user left!");
          return;
        }
        sendToRoom(roomId,JSON.stringify({type: 'left',user:userId,admin:false}));
        delete rooms[roomId][userId];
        delete userRoomMap[userId];
      }
      console.log(`user: ${userId} left from room: ${roomId}`);
  });
});

function sendTo(connection, message) {
  connection.send(message);
}
function sendToRoom(room,message){
  console.log('message channel ' + room + ': ' + message);
  const users=Object.keys(rooms[room]);
  console.log("room users: "+users);
  console.log("user count: "+users.length)
  users.forEach(userId=>{
    const conn = rooms[room][userId];
    conn.send(message)
  });
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
// 启动 HTTP 服务器监听端口
server.listen(3000, () => {
  console.log(`Server is listening on port 3000`);
});