FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --no-save --no-package-lock esbuild@0.28.2
COPY src/lib/audio/ src/lib/audio/
COPY cloudflare/container.mjs cloudflare/container.mjs
RUN ./node_modules/.bin/esbuild cloudflare/container.mjs --bundle --platform=node \
    --format=esm --external:onnxruntime-node --outfile=/app/processor.mjs
RUN mkdir -p /opt/models \
    && curl --fail --location --retry 3 --max-time 300 \
    https://huggingface.co/timcsy/demucs-web-onnx/resolve/92e33df/htdemucs_embedded.onnx -o /opt/models/htdemucs.onnx \
    && echo 'e5e425c17683f163a472462eb5f5a4ffcd11c31858d57fbd0833b012d8b88077  /opt/models/htdemucs.onnx' | sha256sum --check

FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --no-save --no-package-lock --omit=dev --onnxruntime-node-install=skip onnxruntime-node@1.31.1
COPY --from=build /app/processor.mjs .
COPY --from=build /opt/models/htdemucs.onnx /opt/models/htdemucs.onnx
USER node
EXPOSE 8080
CMD ["node", "/app/processor.mjs"]
