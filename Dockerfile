FROM node:20-alpine

RUN apk add --no-cache bash

WORKDIR /opt/application

COPY package*.json ./
RUN npm install --production

COPY . .

RUN echo '#!/bin/bash' > /opt/application/run.sh && \
    echo 'cd /opt/application' >> /opt/application/run.sh && \
    echo 'exec node server.js' >> /opt/application/run.sh && \
    chmod +x /opt/application/run.sh

EXPOSE 3000

CMD ["/opt/application/run.sh"]
