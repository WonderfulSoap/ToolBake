FROM alpine:latest

ARG TARGETOS
ARG TARGETARCH
ARG VERSION

COPY bin/toolbake-${TARGETOS}-${TARGETARCH}-${VERSION} /app/toolbake

RUN chmod +x /app/toolbake

EXPOSE 8080

ENTRYPOINT ["/app/toolbake"]
