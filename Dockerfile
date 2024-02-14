FROM ubuntu:latest
# Setting these arguments as environment variables using ENV makes them available when the container is running
ARG ENVIRONMENT="PROD"
ENV ENVIRONMENT=${ENVIRONMENT}
ARG PORT=80
ENV PORT=${PORT}
ARG ROM_PATH="roms/game.bin"
ENV ROM_PATH=${ROM_PATH}
SHELL ["/bin/bash", "-c"]
RUN apt-get -y update && apt-get -y install nginx cmake curl git python3 build-essential
RUN curl -fsSL https://deb.nodesource.com/setup_21.x | bash - \
    && apt-get -y install nodejs
RUN git clone "https://github.com/emscripten-core/emsdk.git" $HOME/.emsdk \
    && cd $HOME/.emsdk \
    && ./emsdk install latest \
    && ./emsdk activate latest
COPY . $HOME/app
WORKDIR $HOME/app
RUN npm install
EXPOSE ${PORT}
ENTRYPOINT ["./start.sh"]
