#!/bin/bash

# Make emscripten commands available in this bash instance
source $HOME/.emsdk/emsdk_env.sh
mkdir build

if [ ${ENVIRONMENT} = "DEV" ]; then
  npx webpack-dev-server --config webpack.dev.js --port ${PORT} --env TITLE=${TITLE} --env ROM_PATH=${ROM_PATH}
  # You may need to run build_wasm_dev.sh if the emulator is not built in your local src folder
else
  # Build WASM for production
  cd build
  emcmake cmake ..
  emmake make
  cd ..
  # Build and copy files to be served from nginx
  npx webpack --config webpack.config.js
  # On Ubuntu, the default nginx html directory is /var/www/html.
  # When using the nginx or node Docker image, it is /usr/share/nginx/html.
  cp --recursive ./docs/. /var/www/html
  # Change nginx listening port to ${PORT} environment variable from Dockerfile
  # sed = Stream EDitor
  # -i = in-place (i.e. save back to the original file)
  # The command string:
  #     s = the substitute command
  #     80 = a regular expression describing the word to replace (or just the word itself)
  #     ${PORT} = the text to replace it with
  #     g = global (i.e. replace all and not just the first occurrence)
  # /etc/nginx/sites-enabled/default = the file name
  sed -i "s/80/${PORT}/g" /etc/nginx/sites-enabled/default
  # Run nginx in foreground to prevent container from exiting in prod
  /usr/sbin/nginx -g 'daemon off;'
fi
