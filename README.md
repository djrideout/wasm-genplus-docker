# wasm-genplus

![](https://github.com/h1romas4/wasm-genplus/workflows/Emscripten%20CI/badge.svg)

[Genesis-Plus-GX](https://github.com/ekeeke/Genesis-Plus-GX) WebAssembly porting

![](https://github.com/h1romas4/wasm-genplus/blob/master/assets/ipad-wasm.jpg)

### Build with Docker

**Setting**

Optionally set environment variables in .env

```
# Title for the page. Default is "wasm-genplus"
TITLE="wasm-genplus"

# Default is "PROD" when using Dockerfile alone, "DEV" when using docker compose
ENVIRONMENT="DEV"

# ROM endpoint to load game in the browser. Default is "roms/game.bin" in both cases
ROM_PATH="roms/game.bin"

# Default is 80 when using Dockerfile alone, 9000 when using docker compose
PORT=9000
```

**Docker**

```
# For development
docker compose up --build

# For production
# Ideally use the Dockerfile as a service in another docker-compose file in production instead of these commands.
# With arguments
source .env # Set local variables from .env file
docker build --build-arg "ENVIRONMENT=${ENVIRONMENT}" --build-arg "TITLE=${TITLE}" --build-arg "ROM_PATH=${ROM_PATH}" --build-arg "PORT=${PORT}" -t wasm-genplus .
docker run -p 127.0.0.1:${PORT}:${PORT} wasm-genplus
# Without arguments
docker build -t wasm-genplus .
docker run -p 127.0.0.1:80:80 wasm-genplus
```

**Play**

(recommended) Firefox or Safari

```
http://localhost:9000
```

## Build with Gitpod

**Open in Gitpod**

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/h1romas4/wasm-genplus)

**Gitpod terminal:**

```
mkdir build && cd build
emcmake cmake ..
emmake make
```

**Setting**

`.env`

```
ROM_PATH="rom/sonic2.bin"
PORT=9000
```

**Play**

```
cd ..
npm run server
```

![](https://github.com/h1romas4/wasm-genplus/blob/master/assets/gitpod-01.jpg)

## License

[Genesis-Plus-GX](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/LICENSE.txt) License

## Thanks!

[Genesis-Plus-GX](https://github.com/ekeeke/Genesis-Plus-GX)
