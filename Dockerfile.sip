# Dockerfile for LiveKit SIP Service
# This bridges phone calls from Twilio into LiveKit rooms

FROM golang:alpine AS builder

# Install git and build dependencies
RUN apk add --no-cache git build-base

# Set working directory
WORKDIR /workspace

# Clone LiveKit SIP repository
RUN git clone https://github.com/livekit/sip.git .

# Download dependencies
RUN go mod download

# Build the SIP service
RUN go build -o livekit-sip .

# Runtime stage
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache ca-certificates

# Copy binary from builder
COPY --from=builder /workspace/livekit-sip /usr/local/bin/livekit-sip

# Expose SIP ports
# 5060: SIP signaling (TCP/UDP)
# 10000-20000: RTP media (UDP)
EXPOSE 5060/tcp 5060/udp
EXPOSE 10000-20000/udp

# Create config directory
RUN mkdir -p /etc/livekit

# Run the SIP service
ENTRYPOINT ["/usr/local/bin/livekit-sip"]
CMD ["--config", "/etc/livekit/config.yaml"]

