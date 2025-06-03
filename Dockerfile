FROM node:slim

WORKDIR /app

COPY . .

EXPOSE 3000

# 安装 curl，并执行原有命令
RUN apt update -y && \
    apt install -y curl && \
    chmod +x index.js && \
    npm install

CMD ["node", "index.js"]
