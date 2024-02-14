# Rebuild the emulator WASM within the docker container for development
docker compose exec --workdir /app/build wasm-genplus bash -c "source ~/.emsdk/emsdk_env.sh \
  && emcmake cmake .. \
  && emmake make"
