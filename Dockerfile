FROM node:18-slim

COPY package.json /app/

COPY server.js /app/
# 装包
WORKDIR /app
# 如果是国内就设置镜像
# RUN npm set registry http://registry.npm.taobao.org/
RUN npm install
# 暴露 WebSocket 服务的端口
EXPOSE 3000

# 启动 WebSocket 服务
CMD ["node", "server.js"]