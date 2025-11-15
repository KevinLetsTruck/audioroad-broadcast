# Dockerfile for LiveKit SIP Service
# Uses LiveKit's official pre-built image

FROM livekit/sip:latest

# Expose SIP ports
# 5060: SIP signaling (TCP/UDP)
# 10000-20000: RTP media (UDP)
EXPOSE 5060/tcp 5060/udp
EXPOSE 10000-20000/udp

# Health check port
EXPOSE 8080

# The official image already has the binary
# Environment variables will be provided by Railway:
# - LIVEKIT_API_KEY
# - LIVEKIT_API_SECRET  
# - LIVEKIT_WS_URL
# - REDIS_URL
# - etc.

# Run the SIP service
CMD ["livekit-sip"]
