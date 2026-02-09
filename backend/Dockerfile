FROM alpine:latest

ARG TARGETOS
ARG TARGETARCH
ARG VERSION

RUN addgroup -S toolbake && adduser -S -G toolbake -h /app -s /sbin/nologin toolbake

WORKDIR /app

COPY --chown=toolbake:toolbake bin/toolbake-${TARGETOS}-${TARGETARCH}-${VERSION} /app/toolbake

RUN chmod 0755 /app/toolbake

EXPOSE 8080

USER toolbake:toolbake

ENTRYPOINT ["./toolbake"]
