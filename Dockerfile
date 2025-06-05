# Stage 1: install deps and run tests
FROM node:lts AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm test

# Stage 2: runtime
FROM node:lts AS runtime
WORKDIR /app
COPY --from=build /app /app
CMD ["npm", "start"]
