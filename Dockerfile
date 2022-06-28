FROM node:17.9.0

WORKDIR /app

# Install dependencies
RUN mkdir -p node_server ff-worker tools/texture-pack-compiler

COPY ./node_server/package.json /app/node_server/
COPY ./ff-worker/package.json /app/ff-worker/
COPY ./tools/texture-pack-compiler /app/tools/texture-pack-compiler

RUN cd /app/node_server && \
    npm install && \
    cd /app/ff-worker && \
    npm install && \ 
    cd /app/tools/texture-pack-compiler && \
    npm install

# Copy code
COPY ./node_server /app/node_server
COPY ./ff-worker /app/ff-worker
COPY ./tools /app/tools
COPY ./www /app/www

# Compile texture pack
RUN cd /app/tools/texture-pack-compiler && \
    npm start


CMD cd node_server && npm start