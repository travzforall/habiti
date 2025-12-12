#!/bin/bash
# MediaMTX Startup Script for Habiti

cd "$(dirname "$0")"

echo "=========================================="
echo "  MediaMTX RTSP to HLS Proxy"
echo "=========================================="
echo ""
echo "Starting MediaMTX..."
echo ""
echo "Your camera streams will be available at:"
echo ""
echo "  HLS Stream:    http://localhost:8888/ipcam/stream.m3u8"
echo "  WebRTC:        http://localhost:8889/ipcam"
echo "  API Status:    http://localhost:9997/v3/paths/list"
echo ""
echo "To add more cameras, edit mediamtx-custom.yml"
echo ""
echo "Press Ctrl+C to stop"
echo "=========================================="
echo ""

./mediamtx mediamtx-custom.yml
