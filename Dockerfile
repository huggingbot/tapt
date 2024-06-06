FROM --platform=linux/amd64 node:20-alpine

WORKDIR /app

COPY package*.json ./

COPY zksync-web3-nova-* ./

ENV NODE_OPTIONS --max-old-space-size=4096

RUN apk add --no-cache --virtual .gyp \
        python3 \
        make \
        g++ \
        && npm install && apk del .gyp

COPY . .

EXPOSE 80

CMD npm run build && npm run prod
