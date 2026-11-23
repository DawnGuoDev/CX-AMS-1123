FROM node:20-alpine

WORKDIR /opt/application

COPY package.json package-lock.json ./

RUN npm config set registry https://registry.npmmirror.com && \
    npm install --omit=dev --no-audit --no-fund && \
    ls node_modules/express/package.json

COPY . .

RUN printf '#!/bin/sh\ncd /opt/application\nexec node server.js\n' > /opt/application/run.sh && \
    chmod +x /opt/application/run.sh

EXPOSE 3000

CMD ["/opt/application/run.sh"]
