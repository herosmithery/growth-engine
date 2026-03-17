#!/usr/bin/env python3
"""
Parallel Optimize Orchestrator
===================================
Runs multiple autonomous optimization agents in parallel, each optimizing
a different component of the Growth Engine simultaneously.

Inspired by optimize's "swarm" concept - multiple agents working in parallel
to optimize the entire system while you sleep.

Usage:
    python parallel_orchestrator.py                    # Run all agents
    python parallel_orchestrator.py --agents backend frontend  # Run specific agents
    python parallel_orchestrator.py --duration 8h      # Run for 8 hours
"""

import os
import sys
import time
import json
import signal
import logging
import subprocess
import multiprocessing as mp
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s - %(message)s'
)
logger = logging.getLogger("Orchestrator")

@dataclass
class AgentConfig:
    """Configuration for an autonomous agent"""
    name: str
    target_type: str  # "backend", "frontend", "agent"
    agent_name: Optional[str] = None  # For agent type
    branch: Optional[str] = None
    max_iterations: Optional[int] = None
    enabled: bool = True

@dataclass
class AgentStatus:
    """Status of a running agent"""
    name: str
    pid: int
    started_at: str
    iterations: int = 0
    improvements: int = 0
    last_metric: float = 0.0
    status: str = "running"  # "running", "stopped", "crashed"


class ParallelOrchestrator:
    """Orchestrates multiple optimize agents running in parallel"""

    def __init__(self, duration_hours: Optional[float] = None):
        self.project_root = Path(__file__).parent.parent
        self.ai_agency_dir = Path(__file__).parent
        self.duration_hours = duration_hours
        self.start_time = datetime.now()
        self.processes: Dict[str, subprocess.Popen] = {}
        self.agent_statuses: Dict[str, AgentStatus] = {}
        self.stop_requested = False

        # Default agent configurations
        self.agent_configs = [
            AgentConfig(
                name="backend-optimizer",
                target_type="backend",
                branch="optimize-backend",
                enabled=True
            ),
            AgentConfig(
                name="frontend-optimizer",
                target_type="frontend",
                branch="optimize-frontend",
                enabled=True
            ),
            AgentConfig(
                name="outreach-optimizer",
                target_type="agent",
                agent_name="outreach_agent",
                branch="optimize-outreach",
                enabled=True
            ),
            AgentConfig(
                name="design-optimizer",
                target_type="agent",
                agent_name="design_agent",
                branch="optimize-design",
                enabled=True
            ),
            AgentConfig(
                name="close-optimizer",
                target_type="agent",
                agent_name="close_agent",
                branch="optimize-close",
                enabled=True
            ),
        ]

        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        """Handle Ctrl+C gracefully"""
        logger.info("\n🛑 Stop signal received. Shutting down agents...")
        self.stop_requested = True
        self.stop_all_agents()
        sys.exit(0)

    def start_agent(self, config: AgentConfig) -> Optional[subprocess.Popen]:
        """Start a single optimize agent"""
        if not config.enabled:
            logger.info(f"⏭  Skipping disabled agent: {config.name}")
            return None

        logger.info(f"🚀 Starting agent: {config.name}")

        # Build command
        cmd = [
            "python3",
            "universal_optimize_agent.py",
            "--target", config.target_type,
        ]

        if config.agent_name:
            cmd.extend(["--agent-name", config.agent_name])

        if config.branch:
            cmd.extend(["--branch", config.branch])

        if config.max_iterations:
            cmd.extend(["--max-iterations", str(config.max_iterations)])

        # Start process
        try:
            proc = subprocess.Popen(
                cmd,
                cwd=str(self.ai_agency_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            # Track status
            self.processes[config.name] = proc
            self.agent_statuses[config.name] = AgentStatus(
                name=config.name,
                pid=proc.pid,
                started_at=datetime.now().isoformat()
            )

            logger.info(f"   ✅ Started {config.name} (PID: {proc.pid})")
            return proc

        except Exception as e:
            logger.error(f"   ❌ Failed to start {config.name}: {e}")
            return None

    def start_auto_heal(self) -> Optional[subprocess.Popen]:
        """Start the auto-heal system"""
        logger.info("🏥 Starting auto-heal system...")

        try:
            proc = subprocess.Popen(
                ["python3", "auto_heal_system.py", "--interval", "300"],
                cwd=str(self.ai_agency_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            self.processes["auto-heal"] = proc
            logger.info(f"   ✅ Auto-heal started (PID: {proc.pid})")
            return proc

        except Exception as e:
            logger.error(f"   ❌ Failed to start auto-heal: {e}")
            return None

    def monitor_agents(self):
        """Monitor running agents and collect status"""
        for name, proc in list(self.processes.items()):
            # Check if process is still running
            if proc.poll() is not None:
                # Process terminated
                if name in self.agent_statuses:
                    self.agent_statuses[name].status = "stopped"
                logger.warning(f"⚠️  Agent {name} stopped (exit code: {proc.returncode})")

                # Read final output
                stdout, stderr = proc.communicate()
                if stderr:
                    logger.error(f"   Error output: {stderr[:200]}")

    def print_status(self):
        """Print current status of all agents"""
        elapsed = datetime.now() - self.start_time
        elapsed_str = str(elapsed).split('.')[0]  # Remove microseconds

        print("\n" + "="*80)
        print(f"🤖 PARALLEL OPTIMIZE SWARM STATUS")
        print("="*80)
        print(f"Elapsed: {elapsed_str}")

        if self.duration_hours:
            remaining = timedelta(hours=self.duration_hours) - elapsed
            remaining_str = str(remaining).split('.')[0]
            print(f"Remaining: {remaining_str}")

        print(f"Active agents: {len([s for s in self.agent_statuses.values() if s.status == 'running'])}")
        print("-"*80)

        for name, status in self.agent_statuses.items():
            status_emoji = {
                "running": "🟢",
                "stopped": "🔴",
                "crashed": "💥"
            }.get(status.status, "⚪")

            print(f"{status_emoji} {status.name:<25} PID:{status.pid:<8} "
                  f"Iterations:{status.iterations:<5} Improvements:{status.improvements}")

        print("="*80 + "\n")

    def generate_summary_report(self) -> str:
        """Generate final summary report"""
        report = []
        report.append("\n" + "="*80)
        report.append("📊 PARALLEL OPTIMIZE - FINAL SUMMARY")
        report.append("="*80)

        total_time = datetime.now() - self.start_time
        report.append(f"Total runtime: {str(total_time).split('.')[0]}")
        report.append(f"Start time: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")

        # Agent summaries
        report.append("Agent Performance:")
        report.append("-"*80)

        total_iterations = 0
        total_improvements = 0

        for name, status in self.agent_statuses.items():
            report.append(f"  {name}:")
            report.append(f"    Status: {status.status}")
            report.append(f"    Iterations: {status.iterations}")
            report.append(f"    Improvements: {status.improvements}")
            report.append(f"    Success rate: {(status.improvements/max(status.iterations,1)*100):.1f}%")
            report.append("")

            total_iterations += status.iterations
            total_improvements += status.improvements

        report.append("-"*80)
        report.append(f"Total iterations: {total_iterations}")
        report.append(f"Total improvements: {total_improvements}")
        report.append(f"Overall success rate: {(total_improvements/max(total_iterations,1)*100):.1f}%")

        # Results files
        report.append("\n📁 Results files:")
        results_files = list(self.ai_agency_dir.glob("*_results.tsv"))
        for rf in results_files:
            report.append(f"  - {rf.name}")

        report.append("\n" + "="*80 + "\n")

        return "\n".join(report)

    def stop_all_agents(self):
        """Stop all running agents"""
        logger.info("🛑 Stopping all agents...")

        for name, proc in self.processes.items():
            try:
                if proc.poll() is None:  # Still running
                    logger.info(f"   Stopping {name}...")
                    proc.terminate()
                    proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                logger.warning(f"   Force killing {name}...")
                proc.kill()
            except Exception as e:
                logger.error(f"   Error stopping {name}: {e}")

        logger.info("✅ All agents stopped")

    def run_parallel_swarm(self, selected_agents: Optional[List[str]] = None):
        """
        Run the parallel optimize swarm.

        This is the main orchestration loop that:
        1. Starts all enabled agents in parallel
        2. Monitors their progress
        3. Runs until duration expires or manual stop
        4. Generates summary report
        """

        logger.info("\n" + "="*80)
        logger.info("🚀 LAUNCHING PARALLEL OPTIMIZE SWARM")
        logger.info("="*80)
        logger.info(f"Project: Growth Engine")
        logger.info(f"Start time: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")

        if self.duration_hours:
            end_time = self.start_time + timedelta(hours=self.duration_hours)
            logger.info(f"Duration: {self.duration_hours} hours")
            logger.info(f"Expected end: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        else:
            logger.info(f"Duration: Infinite (run until stopped)")

        logger.info("="*80 + "\n")

        # Filter agents if specific ones selected
        if selected_agents:
            for config in self.agent_configs:
                if config.name not in selected_agents:
                    config.enabled = False

        # Start auto-heal system first
        self.start_auto_heal()
        time.sleep(2)

        # Start all enabled agents
        for config in self.agent_configs:
            if config.enabled:
                self.start_agent(config)
                time.sleep(2)  # Stagger starts

        logger.info(f"\n✅ {len(self.processes)} agents launched\n")

        # Main monitoring loop
        try:
            while not self.stop_requested:
                # Check if duration expired
                if self.duration_hours:
                    elapsed_hours = (datetime.now() - self.start_time).total_seconds() / 3600
                    if elapsed_hours >= self.duration_hours:
                        logger.info(f"\n⏰ Duration limit reached ({self.duration_hours}h)")
                        break

                # Monitor agents
                self.monitor_agents()

                # Print status every 5 minutes
                if int(time.time()) % 300 < 10:
                    self.print_status()

                time.sleep(10)  # Check every 10 seconds

        except KeyboardInterrupt:
            logger.info("\n\n🛑 Interrupted by user")

        finally:
            # Cleanup
            self.stop_all_agents()

            # Generate summary
            summary = self.generate_summary_report()
            print(summary)

            # Save summary to file
            summary_file = self.ai_agency_dir / f"swarm_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            with open(summary_file, 'w') as f:
                f.write(summary)

            logger.info(f"📄 Summary saved to: {summary_file}")


def parse_duration(duration_str: str) -> float:
    """Parse duration string like '8h', '30m', '2.5h'"""
    if duration_str.endswith('h'):
        return float(duration_str[:-1])
    elif duration_str.endswith('m'):
        return float(duration_str[:-1]) / 60
    else:
        return float(duration_str)


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Parallel Optimize Orchestrator - Run multiple optimization agents simultaneously"
    )
    parser.add_argument(
        "--agents",
        nargs="+",
        help="Specific agents to run (default: all)"
    )
    parser.add_argument(
        "--duration",
        help="How long to run (e.g., '8h', '30m'). Default: infinite"
    )
    parser.add_argument(
        "--list-agents",
        action="store_true",
        help="List available agents and exit"
    )

    args = parser.parse_args()

    # Parse duration
    duration_hours = None
    if args.duration:
        try:
            duration_hours = parse_duration(args.duration)
        except ValueError:
            parser.error(f"Invalid duration format: {args.duration}")

    # Create orchestrator
    orchestrator = ParallelOrchestrator(duration_hours=duration_hours)

    # List agents if requested
    if args.list_agents:
        print("\n📋 Available agents:")
        for config in orchestrator.agent_configs:
            status = "✅ enabled" if config.enabled else "❌ disabled"
            print(f"  - {config.name:<25} {config.target_type:<15} {status}")
        print()
        sys.exit(0)

    # Run swarm
    orchestrator.run_parallel_swarm(selected_agents=args.agents)


if __name__ == "__main__":
    main()
