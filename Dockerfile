FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --production
COPY bin/ bin/
ENTRYPOINT ["node", "bin/cli.js"]
