FROM golang:1.23-alpine AS build
WORKDIR /src
COPY apps/replay-parser/go.mod apps/replay-parser/go.sum ./
RUN go mod download
COPY apps/replay-parser/ .
RUN CGO_ENABLED=0 go build -o /replay-parser .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=build /replay-parser /replay-parser
EXPOSE 8081
ENTRYPOINT ["/replay-parser"]
