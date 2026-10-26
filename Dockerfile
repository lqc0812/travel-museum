FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# 持久化目录（部署时用 volume 挂载到 /data）
RUN mkdir -p /data/uploads
ENV DB_PATH=/data/museum.json
ENV UPLOADS_DIR=/data/uploads
ENV NODE_ENV=production

EXPOSE 3000
CMD ["npm", "start"]
