#!/bin/bash
################################################################################
# Growth Engine Optimize Launcher
################################################################################
# Easy-to-use script to launch the complete optimize system.
#
# Usage:
#   ./run_optimize.sh debug          # Run diagnostics
#   ./run_optimize.sh heal           # Start auto-heal
#   ./run_optimize.sh swarm          # Run parallel swarm (infinite)
#   ./run_optimize.sh overnight      # Run for 8 hours
#   ./run_optimize.sh backend        # Optimize backend only
#   ./run_optimize.sh frontend       # Optimize frontend only
#   ./run_optimize.sh all            # Everything (debug + heal + swarm)
################################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$SCRIPT_DIR"

################################################################################
# Helper Functions
################################################################################

print_banner() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║        GROWTH ENGINE OPTIMIZE SYSTEM v1.0              ║"
    echo "║        Autonomous Self-Optimizing AI Platform              ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_section() {
    echo -e "\n${BLUE}═══ $1 ═══${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

################################################################################
# Commands
################################################################################

cmd_debug() {
    print_section "Running Diagnostics"
    python3 debug_tool.py --fix
}

cmd_heal() {
    print_section "Starting Auto-Heal System"
    print_info "Auto-heal will run continuously. Press Ctrl+C to stop."
    python3 auto_heal_system.py
}

cmd_swarm() {
    print_section "Launching Parallel Optimize Swarm"
    print_info "Running all optimization agents in parallel (infinite mode)"
    print_info "Press Ctrl+C to stop"
    python3 parallel_optimizer.py
}

cmd_overnight() {
    print_section "Launching Overnight Optimization (8 hours)"
    print_info "Starting parallel swarm for 8 hours..."
    print_info "Estimated: ~480 total experiments"

    # Run in tmux if available, otherwise nohup
    if command -v tmux &> /dev/null; then
        print_info "Running in tmux session 'optimize'"
        print_info "Attach with: tmux attach -t optimize"
        tmux new-session -d -s optimize "python3 parallel_optimizer.py --duration 8h"
        print_success "Swarm launched in background (tmux session: optimize)"
    else
        print_info "Running in background with nohup"
        nohup python3 parallel_optimizer.py --duration 8h > swarm.log 2>&1 &
        echo $! > swarm.pid
        print_success "Swarm launched in background (PID: $(cat swarm.pid))"
        print_info "Check logs with: tail -f swarm.log"
        print_info "Stop with: kill $(cat swarm.pid)"
    fi
}

cmd_backend() {
    print_section "Backend Optimization Only"
    print_info "Optimizing API latency..."
    python3 universal_optimize_agent.py --target backend
}

cmd_frontend() {
    print_section "Frontend Optimization Only"
    print_info "Optimizing UX design..."
    python3 universal_optimize_agent.py --target frontend
}

cmd_agent() {
    if [ -z "$2" ]; then
        print_error "Agent name required. Usage: ./run_optimize.sh agent <agent_name>"
        print_info "Available agents: outreach_agent, design_agent, close_agent"
        exit 1
    fi

    print_section "Optimizing $2"
    python3 universal_optimize_agent.py --target agent --agent-name "$2"
}

cmd_all() {
    print_section "Running Complete Optimize System"

    # Step 1: Debug
    print_info "Step 1/3: Running diagnostics..."
    cmd_debug

    # Step 2: Start auto-heal in background
    print_info "Step 2/3: Starting auto-heal system..."
    nohup python3 auto_heal_system.py > auto_heal.log 2>&1 &
    echo $! > auto_heal.pid
    print_success "Auto-heal running (PID: $(cat auto_heal.pid))"

    # Give auto-heal time to start
    sleep 3

    # Step 3: Start swarm
    print_info "Step 3/3: Launching parallel swarm..."
    cmd_swarm
}

cmd_status() {
    print_section "System Status"

    # Check running processes
    echo "🔍 Running Optimize Processes:"
    ps aux | grep -E "(debug_tool|auto_heal|parallel_optimizer|universal_optimize)" | grep -v grep || echo "  No optimize processes running"

    echo ""
    echo "📊 Recent Results:"

    # Show latest results if they exist
    if [ -f "backend_results.tsv" ]; then
        echo -e "\n  Backend (latest 3):"
        tail -n 3 backend_results.tsv | column -t -s $'\t'
    fi

    if [ -f "frontend_results.tsv" ]; then
        echo -e "\n  Frontend (latest 3):"
        tail -n 3 frontend_results.tsv | column -t -s $'\t'
    fi

    echo ""
    echo "📁 Results Files:"
    ls -lh *_results.tsv 2>/dev/null || echo "  No results files yet"

    echo ""
    echo "📄 Logs:"
    ls -lh *.log 2>/dev/null || echo "  No log files yet"
}

cmd_stop() {
    print_section "Stopping All Optimize Processes"

    # Kill processes
    pkill -f "auto_heal_system" && print_success "Stopped auto-heal" || true
    pkill -f "parallel_optimizer" && print_success "Stopped optimizer" || true
    pkill -f "universal_optimize" && print_success "Stopped agents" || true

    # Kill tmux session if exists
    tmux kill-session -t optimize 2>/dev/null && print_success "Stopped tmux session" || true

    # Remove PID files
    rm -f auto_heal.pid swarm.pid

    print_success "All optimize processes stopped"
}

cmd_help() {
    print_banner

    cat << EOF
${GREEN}Usage:${NC}
  ./run_optimize.sh [command] [options]

${GREEN}Commands:${NC}

  ${YELLOW}Diagnostics & Monitoring:${NC}
    debug              Run diagnostics and auto-fix issues
    status             Show system status and recent results
    heal               Start auto-heal system (continuous)

  ${YELLOW}Optimization (Single Target):${NC}
    backend            Optimize backend API latency
    frontend           Optimize frontend UX design
    agent <name>       Optimize specific AI agent

  ${YELLOW}Parallel Optimization:${NC}
    swarm              Run all agents in parallel (infinite)
    overnight          Run for 8 hours (~480 experiments)
    all                Run everything (debug + heal + swarm)

  ${YELLOW}Control:${NC}
    stop               Stop all optimize processes
    help               Show this help message

${GREEN}Examples:${NC}

  # Quick health check and fix issues
  ./run_optimize.sh debug

  # Optimize backend API while you work
  ./run_optimize.sh backend

  # Run overnight optimization (set and forget)
  ./run_optimize.sh overnight

  # Run complete system
  ./run_optimize.sh all

  # Check status
  ./run_optimize.sh status

  # Stop everything
  ./run_optimize.sh stop

${GREEN}Documentation:${NC}
  See README_OPTIMIZE.md for detailed information

EOF
}

################################################################################
# Main
################################################################################

print_banner

case "${1:-help}" in
    debug)
        cmd_debug
        ;;
    heal)
        cmd_heal
        ;;
    swarm)
        cmd_swarm
        ;;
    overnight)
        cmd_overnight
        ;;
    backend)
        cmd_backend
        ;;
    frontend)
        cmd_frontend
        ;;
    agent)
        cmd_agent "$@"
        ;;
    all)
        cmd_all
        ;;
    status)
        cmd_status
        ;;
    stop)
        cmd_stop
        ;;
    help|--help|-h)
        cmd_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        cmd_help
        exit 1
        ;;
esac

print_success "Done!"
