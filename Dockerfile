FROM node:19.7.0-alpine

WORKDIR /app

# Install necessary dependencies
RUN apk add --no-cache git wget fontconfig

# Create folders
RUN mkdir -p \
    /app/webcraft \
    /app/webcraft/node_server \
    /app/webcraft/ff-worker

# Copy package.json files
COPY package.json /app/webcraft/package.json
COPY node_server/package.json /app/webcraft/node_server/package.json
COPY ff-worker/package.json /app/webcraft/ff-worker/package.json 

# Install all dependencies
# TODO: Use npm ci instead of npm install after removing package-lock from .gitignore 
RUN cd /app/webcraft && \
    npm install && \
    cd /app/webcraft/node_server && \
    npm install && \
    cd /app/webcraft/ff-worker && \
    npm install

# Download resourcepacks
RUN mkdir -p /app/resource-packs && \
    wget -q -O /app/resource-packs/depixel.zip https://dl.dropboxusercontent.com/s/vjob09w2pn2gv1m/Depixel.zip && \
    unzip /app/resource-packs/depixel.zip -d /app/resource-packs/depixel && \
    rm /app/resource-packs/depixel.zip && \
    git clone --depth=1 --branch=main https://github.com/sciner/webcraft-texturepack /app/resource-packs/1 && \
    rm -rf /app/resource-packs/1/.git

# Copy all files
COPY . /app/webcraft

# Create music folder
RUN mkdir -p /app/music && \
    cp /app/webcraft/doc/examples/music.json /app/music/music.json

# Compile assets
RUN cd /app/webcraft/node_server && \
    npm run compile-assets

# Compile typescript
RUN cd /app/webcraft && \
    npm run build:www && \
    npm run types:server

# Compile ff_worker
RUN cd /app/webcraft/ff-worker && \
    npm run start

WORKDIR /app/webcraft/node_server

CMD npm run start