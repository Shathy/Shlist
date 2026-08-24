FROM node:18-alpine

# تثبيت wget لفحص الصحة
RUN apk add --no-cache wget

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# فحص صحة مدمج
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

EXPOSE 8080

CMD ["node", "index.js"]