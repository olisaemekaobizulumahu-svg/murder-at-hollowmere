# For hosts that run containers (Koyeb, Fly.io, Railway, a home server...). No dependencies to install.
FROM node:22-alpine
WORKDIR /app
COPY server.js package.json ./
COPY public ./public
ENV PORT=8080 DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 8080
USER node
CMD ["node", "server.js"]
