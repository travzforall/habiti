#!/bin/bash

# 🤖 Habiti Task Automation Startup Script
# This script starts the complete task management and automation system

echo "🚀 Starting Habiti Task Automation System..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the habiti directory."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🔧 Starting Angular development server..."

# Start the development server in background
npm start &
SERVER_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
sleep 10

# Check if server is running
if curl -s http://localhost:4200 >/dev/null; then
    echo "✅ Server is running on http://localhost:4200"
    
    echo "🎯 Opening Queue Manager..."
    if command -v open >/dev/null 2>&1; then
        # macOS
        open http://localhost:4200/secret-task-manager-queue
        sleep 2
        open http://localhost:4200/secret-task-manager-x9z2k
    elif command -v xdg-open >/dev/null 2>&1; then
        # Linux
        xdg-open http://localhost:4200/secret-task-manager-queue
        sleep 2
        xdg-open http://localhost:4200/secret-task-manager-x9z2k
    else
        echo "🌐 Please manually open:"
        echo "   Queue Manager: http://localhost:4200/secret-task-manager-queue"
        echo "   Approval System: http://localhost:4200/secret-task-manager-x9z2k"
    fi
    
    echo ""
    echo "🎉 Habiti Task Automation System is ready!"
    echo ""
    echo "📋 Quick Start:"
    echo "   1. Queue Manager: http://localhost:4200/secret-task-manager-queue"
    echo "      - Click 'Load Tasks & Create Queues'"  
    echo "      - Set concurrent agents (recommended: 3-5)"
    echo "      - Click 'Start Execution'"
    echo ""
    echo "   2. Approval System: http://localhost:4200/secret-task-manager-x9z2k"
    echo "      - Click 'Start Sync' to begin monitoring"
    echo "      - Review and approve completed feature groups"
    echo ""
    echo "   3. Task Execution:"
    echo "      - Mark tasks complete with [x] in markdown files"
    echo "      - System auto-detects changes within 2 seconds"
    echo "      - Approve via web interface to commit to git"
    echo ""
    echo "🛑 Press Ctrl+C to stop the system"
    
    # Keep script running and handle cleanup
    trap "echo '🛑 Stopping system...'; kill $SERVER_PID 2>/dev/null; exit 0" INT TERM
    
    # Keep alive
    while kill -0 $SERVER_PID 2>/dev/null; do
        sleep 5
    done
    
else
    echo "❌ Failed to start server. Check for errors above."
    kill $SERVER_PID 2>/dev/null
    exit 1
fi