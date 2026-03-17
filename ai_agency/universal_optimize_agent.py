#!/usr/bin/env python3
"""
Universal Optimize Agent
============================
Autonomous agent that optimizes ANY component of the Growth Engine using
the optimize methodology: experiment, evaluate, keep/discard, repeat.

This is a generalized version inspired by optimize-macos that can be
deployed for different subsystems (backend, frontend, agents, database).

Usage:
    python universal_optimize_agent.py --target backend
    python universal_optimize_agent.py --target frontend
    python universal_optimize_agent.py --target agent --agent-name outreach_agent
"""

import os
import sys
import git
import time
import json
import subprocess
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger("UniversalAgent")

@dataclass
class ExperimentResult:
    """Result of a single experiment"""
    commit_hash: str
    metric_value: float
    status: str  # "keep", "discard", "crash"
    description: str
    timestamp: str
    metadata: Dict = None

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()


class OptimizeTarget(ABC):
    """Abstract base class for optimize targets"""

    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.target_file: Optional[Path] = None
        self.results_file: Optional[Path] = None
        self.baseline_metric: Optional[float] = None
        self.best_metric: Optional[float] = None

    @abstractmethod
    def run_experiment(self) -> float:
        """
        Run the experiment and return the metric value.
        Lower is better for some metrics (latency, error rate),
        higher is better for others (UX score, conversion rate).
        """
        pass

    @abstractmethod
    def generate_modification(self) -> str:
        """
        Generate a modification idea to test.
        Returns a description of what will be changed.
        """
        pass

    @abstractmethod
    def apply_modification(self, idea: str) -> bool:
        """
        Apply the modification to the target file.
        Returns True if successful, False otherwise.
        """
        pass

    @abstractmethod
    def is_better(self, new_metric: float, old_metric: float) -> bool:
        """
        Determine if the new metric is better than the old one.
        """
        pass


class BackendLatencyTarget(OptimizeTarget):
    """Optimize backend API latency"""

    def __init__(self, project_root: Path):
        super().__init__(project_root)
        self.target_file = project_root / "ai_agency" / "api_server.py"
        self.results_file = project_root / "ai_agency" / "backend_results.tsv"
        self.api_url = "http://localhost:8000"

    def run_experiment(self) -> float:
        """Measure API response time"""
        logger.info("📊 Measuring API latency...")

        try:
            # Start API server
            proc = subprocess.Popen(
                ["python3", "api_server.py"],
                cwd=str(self.project_root / "ai_agency"),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            time.sleep(5)  # Wait for startup

            # Benchmark
            import requests
            latencies = []

            for _ in range(10):
                start = time.time()
                try:
                    response = requests.get(f"{self.api_url}/health", timeout=5)
                    if response.status_code == 200:
                        latencies.append((time.time() - start) * 1000)  # Convert to ms
                except:
                    pass

            # Stop server
            proc.terminate()
            proc.wait(timeout=5)

            if latencies:
                avg_latency = sum(latencies) / len(latencies)
                logger.info(f"   Average latency: {avg_latency:.2f}ms")
                return avg_latency
            else:
                logger.error("   Failed to measure latency")
                return float('inf')

        except Exception as e:
            logger.error(f"   Experiment failed: {e}")
            return float('inf')

    def generate_modification(self) -> str:
        """Generate API optimization idea"""
        ideas = [
            "Add response caching with @lru_cache",
            "Switch to async endpoints",
            "Optimize database queries with select fields",
            "Add request timeout limits",
            "Enable gzip compression",
            "Add connection pooling",
            "Reduce logging verbosity",
            "Add response streaming for large payloads",
        ]
        import random
        return random.choice(ideas)

    def apply_modification(self, idea: str) -> bool:
        """Apply the modification (placeholder - would use LLM in production)"""
        logger.info(f"🔧 Applying: {idea}")
        # In production, this would call Claude to edit the file
        # For now, return True to simulate success
        return True

    def is_better(self, new_metric: float, old_metric: float) -> bool:
        """Lower latency is better"""
        return new_metric < old_metric


class FrontendUXTarget(OptimizeTarget):
    """Optimize frontend user experience"""

    def __init__(self, project_root: Path):
        super().__init__(project_root)
        self.target_file = project_root / "public" / "admin-dashboard.html"
        self.results_file = project_root / "ai_agency" / "frontend_results.tsv"

    def run_experiment(self) -> float:
        """Evaluate UX score using Gemini"""
        logger.info("📊 Evaluating UX score...")

        try:
            # Use the existing evaluate_ui.py
            result = subprocess.run(
                ["python3", "evaluate_ui.py"],
                cwd=str(self.project_root / "ai_agency"),
                capture_output=True,
                text=True,
                timeout=60
            )

            # Parse UX score from output
            for line in result.stdout.split('\n'):
                if "ux_score:" in line:
                    score = float(line.split(':')[1].strip())
                    logger.info(f"   UX Score: {score}/100")
                    return score

            logger.error("   Could not parse UX score")
            return 0.0

        except Exception as e:
            logger.error(f"   Experiment failed: {e}")
            return 0.0

    def generate_modification(self) -> str:
        """Generate UI improvement idea"""
        ideas = [
            "Improve color contrast for better accessibility",
            "Add micro-interactions on hover",
            "Increase whitespace between components",
            "Add loading skeletons for async data",
            "Improve mobile responsiveness",
            "Add smooth transitions between states",
            "Enhance typography hierarchy",
            "Add visual feedback for user actions",
        ]
        import random
        return random.choice(ideas)

    def apply_modification(self, idea: str) -> bool:
        """Apply the modification"""
        logger.info(f"🔧 Applying: {idea}")
        return True

    def is_better(self, new_metric: float, old_metric: float) -> bool:
        """Higher UX score is better"""
        return new_metric > old_metric


class AgentAccuracyTarget(OptimizeTarget):
    """Optimize AI agent performance"""

    def __init__(self, project_root: Path, agent_name: str):
        super().__init__(project_root)
        self.agent_name = agent_name
        self.target_file = project_root / "ai_agency" / f"{agent_name}.py"
        self.results_file = project_root / "ai_agency" / f"{agent_name}_results.tsv"

    def run_experiment(self) -> float:
        """Measure agent accuracy/quality"""
        logger.info(f"📊 Evaluating {self.agent_name} performance...")

        try:
            # Run agent on test cases and measure quality
            # This is a simplified version - in production would have proper test suite
            from database import supabase

            # Count successful outcomes vs failures
            result = supabase.table("agency_prospects") \
                .select("status") \
                .limit(100) \
                .execute()

            if result.data:
                total = len(result.data)
                successful = sum(1 for r in result.data if r['status'] in ['replied', 'demo_sent', 'closed'])
                accuracy = (successful / total) * 100
                logger.info(f"   Agent Accuracy: {accuracy:.1f}%")
                return accuracy
            else:
                return 0.0

        except Exception as e:
            logger.error(f"   Experiment failed: {e}")
            return 0.0

    def generate_modification(self) -> str:
        """Generate agent improvement idea"""
        ideas = [
            "Improve prompt engineering for better context",
            "Add few-shot examples to prompts",
            "Adjust temperature for more/less creativity",
            "Add validation checks before actions",
            "Improve error handling and retries",
            "Optimize token usage with shorter prompts",
            "Add specialized tools for common tasks",
        ]
        import random
        return random.choice(ideas)

    def apply_modification(self, idea: str) -> bool:
        """Apply the modification"""
        logger.info(f"🔧 Applying: {idea}")
        return True

    def is_better(self, new_metric: float, old_metric: float) -> bool:
        """Higher accuracy is better"""
        return new_metric > old_metric


class UniversalOptimizeAgent:
    """Universal autonomous research agent"""

    def __init__(self, target: OptimizeTarget, branch_name: str = None):
        self.target = target
        self.project_root = target.project_root
        self.branch_name = branch_name or f"optimize-{target.__class__.__name__}-{datetime.now().strftime('%Y%m%d')}"
        self.results: List[ExperimentResult] = []

        # Initialize git repo
        try:
            self.repo = git.Repo(self.project_root)
        except:
            logger.error("Not a git repository. Optimize requires git for version control.")
            sys.exit(1)

    def setup(self):
        """Setup the optimize branch"""
        logger.info(f"🚀 Setting up optimize on branch: {self.branch_name}")

        # Create branch if it doesn't exist
        try:
            self.repo.git.checkout('-b', self.branch_name)
            logger.info(f"✅ Created branch: {self.branch_name}")
        except:
            # Branch exists, check it out
            self.repo.git.checkout(self.branch_name)
            logger.info(f"✅ Switched to branch: {self.branch_name}")

        # Initialize results file if needed
        if not self.target.results_file.exists():
            with open(self.target.results_file, 'w') as f:
                f.write("commit\tmetric_value\tstatus\tdescription\ttimestamp\n")

        # Run baseline
        logger.info("📊 Establishing baseline...")
        baseline = self.target.run_experiment()
        self.target.baseline_metric = baseline
        self.target.best_metric = baseline

        logger.info(f"   Baseline metric: {baseline}")

        # Record baseline
        self.record_result(
            metric_value=baseline,
            status="keep",
            description="baseline"
        )

    def run_experiment_cycle(self) -> bool:
        """
        Run a single experiment cycle:
        1. Generate modification idea
        2. Apply modification
        3. Commit
        4. Run experiment
        5. Evaluate
        6. Keep or discard
        """

        # Generate modification idea
        idea = self.target.generate_modification()
        logger.info(f"\n💡 Idea: {idea}")

        # Get current commit
        current_commit = self.repo.head.commit.hexsha[:7]

        # Apply modification
        success = self.target.apply_modification(idea)
        if not success:
            logger.error("❌ Failed to apply modification")
            return False

        # Commit the change
        try:
            self.repo.git.add(A=True)
            self.repo.git.commit('-m', f"Experiment: {idea}")
            new_commit = self.repo.head.commit.hexsha[:7]
            logger.info(f"✅ Committed: {new_commit}")
        except Exception as e:
            logger.error(f"❌ Failed to commit: {e}")
            return False

        # Run experiment
        try:
            metric_value = self.target.run_experiment()
        except Exception as e:
            logger.error(f"💥 Experiment crashed: {e}")
            self.record_result(0.0, "crash", idea)
            self.repo.git.reset('--hard', 'HEAD~1')
            return False

        # Evaluate
        is_improvement = self.target.is_better(metric_value, self.target.best_metric)

        if is_improvement:
            logger.info(f"✅ IMPROVEMENT! {metric_value} vs {self.target.best_metric}")
            self.target.best_metric = metric_value
            self.record_result(metric_value, "keep", idea)
            return True
        else:
            logger.info(f"❌ No improvement. {metric_value} vs {self.target.best_metric}")
            self.record_result(metric_value, "discard", idea)
            # Revert
            self.repo.git.reset('--hard', 'HEAD~1')
            return False

    def record_result(self, metric_value: float, status: str, description: str):
        """Record experiment result to TSV"""
        commit_hash = self.repo.head.commit.hexsha[:7]
        timestamp = datetime.now().isoformat()

        result = ExperimentResult(
            commit_hash=commit_hash,
            metric_value=metric_value,
            status=status,
            description=description,
            timestamp=timestamp
        )

        self.results.append(result)

        # Append to TSV
        with open(self.target.results_file, 'a') as f:
            f.write(f"{commit_hash}\t{metric_value}\t{status}\t{description}\t{timestamp}\n")

    def autonomous_loop(self, max_iterations: int = None):
        """
        Run autonomous optimization loop.
        Similar to optimize: never stops until manually interrupted.
        """
        logger.info("\n" + "="*60)
        logger.info("🤖 AUTONOMOUS OPTIMIZATION LOOP STARTED")
        logger.info("="*60)
        logger.info(f"Target: {self.target.__class__.__name__}")
        logger.info(f"File: {self.target.target_file}")
        logger.info(f"Baseline: {self.target.baseline_metric}")
        logger.info(f"Max iterations: {'∞' if not max_iterations else max_iterations}")
        logger.info("\nPress Ctrl+C to stop")
        logger.info("="*60 + "\n")

        iteration = 0
        improvements = 0

        try:
            while max_iterations is None or iteration < max_iterations:
                iteration += 1

                logger.info(f"\n{'─'*60}")
                logger.info(f"Iteration #{iteration}")
                logger.info(f"Best so far: {self.target.best_metric}")
                logger.info(f"Improvements: {improvements}/{iteration-1}")
                logger.info(f"{'─'*60}")

                # Run experiment cycle
                improved = self.run_experiment_cycle()
                if improved:
                    improvements += 1

                # Brief pause between iterations
                time.sleep(2)

        except KeyboardInterrupt:
            logger.info("\n\n🛑 Autonomous loop stopped by user")

        # Print summary
        logger.info("\n" + "="*60)
        logger.info("📊 OPTIMIZATION SUMMARY")
        logger.info("="*60)
        logger.info(f"Total iterations: {iteration}")
        logger.info(f"Improvements: {improvements}")
        logger.info(f"Baseline: {self.target.baseline_metric}")
        logger.info(f"Final best: {self.target.best_metric}")

        if self.target.best_metric and self.target.baseline_metric:
            if self.target.is_better(self.target.best_metric, self.target.baseline_metric):
                improvement_pct = abs((self.target.best_metric - self.target.baseline_metric) / self.target.baseline_metric * 100)
                logger.info(f"Total improvement: {improvement_pct:.1f}%")

        logger.info(f"\nResults saved to: {self.target.results_file}")
        logger.info("="*60 + "\n")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Universal Optimize Agent")
    parser.add_argument("--target", required=True, choices=["backend", "frontend", "agent"],
                      help="What to optimize")
    parser.add_argument("--agent-name", help="Agent name (required if target=agent)")
    parser.add_argument("--max-iterations", type=int, help="Max iterations (default: infinite)")
    parser.add_argument("--branch", help="Git branch name")

    args = parser.parse_args()

    # Determine project root
    project_root = Path(__file__).parent.parent

    # Create target
    if args.target == "backend":
        target = BackendLatencyTarget(project_root)
    elif args.target == "frontend":
        target = FrontendUXTarget(project_root)
    elif args.target == "agent":
        if not args.agent_name:
            parser.error("--agent-name required when target=agent")
        target = AgentAccuracyTarget(project_root, args.agent_name)
    else:
        parser.error(f"Unknown target: {args.target}")

    # Create agent
    agent = UniversalOptimizeAgent(target, branch_name=args.branch)

    # Setup and run
    agent.setup()
    agent.autonomous_loop(max_iterations=args.max_iterations)


if __name__ == "__main__":
    main()
