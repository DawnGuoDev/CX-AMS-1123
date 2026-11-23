FROM node:20-alpine

WORKDIR /opt/application

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

COPY . .

RUN printf '#!/bin/sh\ncd /opt/application\nexec node server.js\n' > /opt/application/run.sh && \
    chmod +x /opt/application/run.sh

EXPOSE 3000

CMD ["/opt/application/run.sh"]
