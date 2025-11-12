# Janus Gateway Docker Configuration for AudioRoad Broadcast
# Optimized for audio-only WebRTC with Twilio Media Streams integration

FROM canyan/janus-gateway:latest

# Copy custom configuration
COPY ./janus/config/ /opt/janus/etc/janus/

# Expose ports
# 8188: WebSocket for Janus API
# 8088: HTTP/REST API (optional)
# 20000-20100: RTP ports for media
EXPOSE 8188 8088
EXPOSE 20000-20100/udp

# Environment variables
ENV JANUS_WS_PORT=8188
ENV JANUS_HTTP_PORT=8088

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8088/janus/info || exit 1

CMD ["/opt/janus/bin/janus", "-F", "/opt/janus/etc/janus"]

