FROM node:20-slim

WORKDIR /app

# 依存関係
COPY package.json package-lock.json* ./
RUN npm install
RUN npm install react-router-dom

# アプリコード
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
