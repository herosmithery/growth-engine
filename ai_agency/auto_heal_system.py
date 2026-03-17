#!/usr/bin/env python3
"""
Growth Engine Auto-Heal System
===============================
Autonomous self-healing system that continuously monitors the Growth Engine,
detects issues, and automatically fixes them without human intervention.

Inspired by autoresearch's autonomous loop pattern.

Usage:
    python auto_heal_system.py        # Start autonomous healing loop
    python auto_heal_system.py --once # Run one healing cycle
"""

import os
import sys
import time
import json
import logging
import subprocess
import traceback
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s - %(message)s',
    handlers=[
        logging.FileHandler("auto_heal.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("AutoHeal")

@dataclass
class HealthCheck:
    """Health check result"""
    component: str
    status: str  # "healthy", "degraded", "critical"
    message: str
    auto_fixable: bool
    fix_action: Optional[str] = None
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()

class AutoHealSystem:
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.ai_agency_dir = Path(__file__).parent
        self.heal_log_path = self.ai_agency_dir / "heal_history.jsonl"
        self.health_checks: List[HealthCheck] = []

    def check_api_health(self) -> HealthCheck:
        """Check if API servers are running"""
        try:
            import requests
            # Check FastAPI
            response = requests.get("http://localhost:8000/health", timeout=2)
            if response.status_code == 200:
                return HealthCheck(
                    component="FastAPI",
                    status="healthy",
                    message="API server responding",
                    auto_fixable=False
                )
        except Exception as e:
            return HealthCheck(
                component="FastAPI",
                status="critical",
                message=f"API server down: {e}",
                auto_fixable=True,
                fix_action="restart_api_server"
            )

    def check_database_health(self) -> HealthCheck:
        """Check database connectivity"""
        try:
            from database import supabase
            if supabase:
                # Try a simple query
                result = supabase.table("businesses").select("id").limit(1).execute()
                return HealthCheck(
                    component="Database",
                    status="healthy",
                    message="Supabase connected",
                    auto_fixable=False
                )
            else:
                return HealthCheck(
                    component="Database",
                    status="critical",
                    message="Supabase client not initialized",
                    auto_fixable=True,
                    fix_action="check_env_vars"
                )
        except Exception as e:
            return HealthCheck(
                component="Database",
                status="critical",
                message=f"Database connection failed: {e}",
                auto_fixable=True,
                fix_action="check_env_vars"
            )

    def check_file_integrity(self) -> List[HealthCheck]:
        """Check critical files exist and are valid"""
        checks = []

        critical_files = {
            "api_server.py": "API server main file",
            "webhook_server.py": "Webhook server",
            "database.py": "Database connection",
        }

        for file_name, description in critical_files.items():
            file_path = self.ai_agency_dir / file_name
            if file_path.exists():
                # Check if file is valid Python
                try:
                    with open(file_path, 'r') as f:
                        compile(f.read(), file_name, 'exec')
                    checks.append(HealthCheck(
                        component=f"File:{file_name}",
                        status="healthy",
                        message=f"{description} is valid",
                        auto_fixable=False
                    ))
                except SyntaxError as e:
                    checks.append(HealthCheck(
                        component=f"File:{file_name}",
                        status="critical",
                        message=f"Syntax error: {e}",
                        auto_fixable=True,
                        fix_action=f"restore_from_git:{file_name}"
                    ))
            else:
                checks.append(HealthCheck(
                    component=f"File:{file_name}",
                    status="critical",
                    message=f"File missing: {file_name}",
                    auto_fixable=True,
                    fix_action=f"restore_from_git:{file_name}"
                ))

        return checks

    def check_dependencies(self) -> HealthCheck:
        """Check if required Python packages are installed"""
        required_packages = [
            "fastapi",
            "flask",
            "supabase",
            "requests",
            "playwright",
        ]

        missing = []
        for package in required_packages:
            try:
                __import__(package)
            except ImportError:
                missing.append(package)

        if missing:
            return HealthCheck(
                component="Dependencies",
                status="critical",
                message=f"Missing packages: {', '.join(missing)}",
                auto_fixable=True,
                fix_action=f"install_packages:{','.join(missing)}"
            )
        else:
            return HealthCheck(
                component="Dependencies",
                status="healthy",
                message="All packages installed",
                auto_fixable=False
            )

    def check_disk_space(self) -> HealthCheck:
        """Check available disk space"""
        import shutil
        total, used, free = shutil.disk_usage(self.project_root)

        free_gb = free / (1024**3)
        if free_gb < 1:
            return HealthCheck(
                component="DiskSpace",
                status="critical",
                message=f"Low disk space: {free_gb:.2f} GB free",
                auto_fixable=True,
                fix_action="clean_temp_files"
            )
        elif free_gb < 5:
            return HealthCheck(
                component="DiskSpace",
                status="degraded",
                message=f"Disk space warning: {free_gb:.2f} GB free",
                auto_fixable=False
            )
        else:
            return HealthCheck(
                component="DiskSpace",
                status="healthy",
                message=f"Sufficient disk space: {free_gb:.2f} GB free",
                auto_fixable=False
            )

    def check_log_files(self) -> HealthCheck:
        """Check if log files are growing too large"""
        log_dir = self.ai_agency_dir
        log_files = list(log_dir.glob("*.log"))

        large_logs = []
        for log_file in log_files:
            size_mb = log_file.stat().st_size / (1024**2)
            if size_mb > 100:
                large_logs.append(f"{log_file.name} ({size_mb:.1f}MB)")

        if large_logs:
            return HealthCheck(
                component="LogFiles",
                status="degraded",
                message=f"Large log files: {', '.join(large_logs)}",
                auto_fixable=True,
                fix_action="rotate_logs"
            )
        else:
            return HealthCheck(
                component="LogFiles",
                status="healthy",
                message="Log files normal size",
                auto_fixable=False
            )

    # -------------------------------------------------------------------------
    # Auto-Fix Actions
    # -------------------------------------------------------------------------

    def restart_api_server(self) -> bool:
        """Attempt to restart the API server"""
        logger.info("🔧 Attempting to restart API server...")
        try:
            # Start FastAPI server in background
            subprocess.Popen(
                ["python3", "api_server.py"],
                cwd=str(self.ai_agency_dir),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            time.sleep(5)  # Wait for startup

            # Verify it's running
            import requests
            response = requests.get("http://localhost:8000/health", timeout=3)
            if response.status_code == 200:
                logger.info("✅ API server restarted successfully")
                return True
        except Exception as e:
            logger.error(f"❌ Failed to restart API server: {e}")
        return False

    def check_env_vars(self) -> bool:
        """Check and potentially restore environment variables"""
        logger.info("🔧 Checking environment variables...")

        from dotenv import load_dotenv
        load_dotenv(self.project_root / ".env.local")
        load_dotenv(self.project_root / ".env")

        required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
        all_set = all(os.environ.get(var) for var in required)

        if all_set:
            logger.info("✅ Environment variables are set")
            return True
        else:
            logger.error("❌ Missing environment variables")
            # Could potentially restore from backup .env file
            return False

    def restore_from_git(self, file_name: str) -> bool:
        """Restore a file from git"""
        logger.info(f"🔧 Restoring {file_name} from git...")
        try:
            subprocess.run(
                ["git", "checkout", "HEAD", f"ai_agency/{file_name}"],
                cwd=str(self.project_root),
                check=True
            )
            logger.info(f"✅ Restored {file_name}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to restore {file_name}: {e}")
            return False

    def install_packages(self, packages: str) -> bool:
        """Install missing Python packages"""
        logger.info(f"🔧 Installing packages: {packages}")
        try:
            subprocess.run(
                ["pip", "install"] + packages.split(","),
                check=True
            )
            logger.info(f"✅ Installed {packages}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to install packages: {e}")
            return False

    def clean_temp_files(self) -> bool:
        """Clean temporary files to free disk space"""
        logger.info("🔧 Cleaning temporary files...")
        try:
            temp_dirs = [
                self.ai_agency_dir / "pw-tmp",
                self.ai_agency_dir / "__pycache__",
            ]

            cleaned_mb = 0
            for temp_dir in temp_dirs:
                if temp_dir.exists():
                    for file in temp_dir.glob("*"):
                        size = file.stat().st_size
                        file.unlink()
                        cleaned_mb += size / (1024**2)

            logger.info(f"✅ Cleaned {cleaned_mb:.2f} MB")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to clean temp files: {e}")
            return False

    def rotate_logs(self) -> bool:
        """Rotate large log files"""
        logger.info("🔧 Rotating log files...")
        try:
            log_files = list(self.ai_agency_dir.glob("*.log"))
            rotated = 0

            for log_file in log_files:
                size_mb = log_file.stat().st_size / (1024**2)
                if size_mb > 50:
                    # Archive old log
                    archive_name = f"{log_file.stem}_{datetime.now().strftime('%Y%m%d')}.log.old"
                    log_file.rename(self.ai_agency_dir / archive_name)
                    rotated += 1

            logger.info(f"✅ Rotated {rotated} log files")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to rotate logs: {e}")
            return False

    # -------------------------------------------------------------------------
    # Main Healing Logic
    # -------------------------------------------------------------------------

    def run_health_checks(self) -> List[HealthCheck]:
        """Run all health checks"""
        checks = []

        # Run individual checks
        checks.append(self.check_api_health())
        checks.append(self.check_database_health())
        checks.extend(self.check_file_integrity())
        checks.append(self.check_dependencies())
        checks.append(self.check_disk_space())
        checks.append(self.check_log_files())

        self.health_checks = checks
        return checks

    def apply_fixes(self) -> Dict[str, bool]:
        """Apply auto-fixes for detected issues"""
        fixes_applied = {}

        for check in self.health_checks:
            if check.status == "critical" and check.auto_fixable and check.fix_action:
                logger.info(f"🚨 Critical issue detected: {check.component} - {check.message}")

                # Parse fix action
                if ":" in check.fix_action:
                    action, param = check.fix_action.split(":", 1)
                else:
                    action, param = check.fix_action, None

                # Execute fix
                fix_method = getattr(self, action, None)
                if fix_method:
                    if param:
                        success = fix_method(param)
                    else:
                        success = fix_method()

                    fixes_applied[check.component] = success
                else:
                    logger.warning(f"⚠️  No fix method found for: {action}")
                    fixes_applied[check.component] = False

        return fixes_applied

    def log_health_status(self):
        """Log health check results to file"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "checks": [asdict(check) for check in self.health_checks],
            "summary": {
                "healthy": sum(1 for c in self.health_checks if c.status == "healthy"),
                "degraded": sum(1 for c in self.health_checks if c.status == "degraded"),
                "critical": sum(1 for c in self.health_checks if c.status == "critical"),
            }
        }

        with open(self.heal_log_path, 'a') as f:
            f.write(json.dumps(log_entry) + "\n")

    def autonomous_healing_loop(self, interval_seconds=300):
        """Run autonomous healing loop forever"""
        logger.info("🤖 Starting autonomous healing loop...")
        logger.info(f"   Checking every {interval_seconds} seconds")
        logger.info("   Press Ctrl+C to stop\n")

        iteration = 0
        try:
            while True:
                iteration += 1
                logger.info(f"\n{'='*60}")
                logger.info(f"Healing Cycle #{iteration} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                logger.info(f"{'='*60}\n")

                # Run health checks
                checks = self.run_health_checks()

                # Count issues
                critical = [c for c in checks if c.status == "critical"]
                degraded = [c for c in checks if c.status == "degraded"]

                logger.info(f"📊 Health Status:")
                logger.info(f"   ✅ Healthy: {len([c for c in checks if c.status == 'healthy'])}")
                logger.info(f"   ⚠️  Degraded: {len(degraded)}")
                logger.info(f"   🚨 Critical: {len(critical)}\n")

                # Apply fixes if needed
                if critical:
                    logger.info("🔧 Applying auto-fixes...")
                    fixes = self.apply_fixes()

                    success_count = sum(1 for v in fixes.values() if v)
                    logger.info(f"\n✅ Applied {success_count}/{len(fixes)} fixes successfully\n")

                # Log results
                self.log_health_status()

                # Wait for next cycle
                logger.info(f"⏳ Next check in {interval_seconds} seconds...\n")
                time.sleep(interval_seconds)

        except KeyboardInterrupt:
            logger.info("\n\n🛑 Autonomous healing loop stopped by user")
            logger.info(f"   Completed {iteration} cycles")

    def run_single_cycle(self):
        """Run a single healing cycle"""
        logger.info("🔍 Running single health check cycle...\n")

        checks = self.run_health_checks()

        # Print results
        for check in checks:
            status_emoji = {
                "healthy": "✅",
                "degraded": "⚠️",
                "critical": "🚨"
            }[check.status]

            logger.info(f"{status_emoji} {check.component}: {check.message}")

        # Apply fixes
        critical = [c for c in checks if c.status == "critical" and c.auto_fixable]
        if critical:
            logger.info(f"\n🔧 Found {len(critical)} auto-fixable issues")
            fixes = self.apply_fixes()
            logger.info(f"✅ Applied {sum(fixes.values())}/{len(fixes)} fixes\n")

        self.log_health_status()

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Growth Engine Auto-Heal System")
    parser.add_argument("--once", action="store_true", help="Run single cycle and exit")
    parser.add_argument("--interval", type=int, default=300, help="Check interval in seconds (default: 300)")
    args = parser.parse_args()

    healer = AutoHealSystem()

    if args.once:
        healer.run_single_cycle()
    else:
        healer.autonomous_healing_loop(interval_seconds=args.interval)

if __name__ == "__main__":
    main()
