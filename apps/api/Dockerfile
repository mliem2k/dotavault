# Go replay parser (apps/replay-parser), invoked by the Bun API as a
# subprocess when /matches/:id has nothing parsed yet for a match.
FROM golang:1.23-alpine AS goparser
WORKDIR /src
COPY apps/replay-parser/go.mod apps/replay-parser/go.sum ./
RUN go mod download
COPY apps/replay-parser/ .
RUN CGO_ENABLED=0 go build -o /replay-parser .

FROM oven/bun:1.3.14-alpine
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/

RUN bun install --frozen-lockfile --production

COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/
COPY packages/types/src ./packages/types/src

COPY --from=goparser /replay-parser /usr/local/bin/replay-parser

WORKDIR /app/apps/api

EXPOSE 3000
CMD ["bun", "src/index.ts"]
