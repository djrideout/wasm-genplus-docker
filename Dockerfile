FROM ubuntu:latest
SHELL ["/bin/bash", "-c"]
RUN apt-get -y update && apt-get -y install nginx cmake curl git python3 build-essential
RUN curl -fsSL https://deb.nodesource.com/setup_21.x | bash - \
    && apt-get -y install nodejs
RUN git clone "https://github.com/emscripten-core/emsdk.git" $HOME/.emsdk \
    && cd $HOME/.emsdk \
    && ./emsdk install latest \
    && ./emsdk activate latest
# Copy package.json and package-lock.json before the rest of the directory so that npm install doesn't run again if an irrelevant file changes
COPY package.json $HOME/app/package.json
COPY package-lock.json $HOME/app/package-lock.json
WORKDIR $HOME/app
RUN npm install
COPY . $HOME/app
# Setting these arguments as environment variables using ENV makes them available when the container is running
ARG ENVIRONMENT="PROD"
ENV ENVIRONMENT=${ENVIRONMENT}
ARG PORT=80
ENV PORT=${PORT}
ARG ROM_PATH="roms/game.bin"
ENV ROM_PATH=${ROM_PATH}
EXPOSE ${PORT}
ENTRYPOINT ["./start.sh"]
