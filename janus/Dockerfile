# Janus Gateway Docker Configuration for AudioRoad Broadcast
# Using official Janus Gateway image

FROM atyenoria/janus-gateway-audiobridge:latest

# Expose ports
# 8188: WebSocket for Janus API
# 8088: HTTP/REST API
# 7088: HTTPS API
# 8089: WebSocket Secure
# 10000-10200: RTP ports for media
EXPOSE 8088 8188 7088 8089
EXPOSE 10000-10200/udp

# Environment variables
ENV JANUS_WS_PORT=8188
ENV JANUS_HTTP_PORT=8088

# Run Janus Gateway
CMD ["/usr/local/bin/janus"]

