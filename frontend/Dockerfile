FROM node:18-alpine

WORKDIR /app

# 安裝依賴
COPY package.json package-lock.json ./
RUN npm install

# 複製源碼
COPY . .

# 啟動開發服務器
CMD ["npm", "start"]

# 生產模式構建和運行
# 第一階段: 建置應用程式
# FROM node:18-alpine AS build
# WORKDIR /app
# COPY package.json package-lock.json* ./
# RUN npm ci
# COPY . .
# RUN npm run build

# 第二階段: 運行階段
# FROM nginx:alpine
# COPY --from=build /app/dist /usr/share/nginx/html
# EXPOSE 80
# CMD ["nginx", "-g", "daemon off;"] 