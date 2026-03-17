#!/usr/bin/env python3
"""
Growth Engine Debug Tool
========================
Comprehensive diagnostic tool that checks all systems, identifies issues,
and provides actionable fixes.

Usage:
    python debug_tool.py              # Run full diagnostic
    python debug_tool.py --fix        # Auto-fix issues
    python debug_tool.py --watch      # Continuous monitoring
"""

import os
import sys
import json
import sqlite3
import requests
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple
from dotenv import load_dotenv

# Color codes for terminal output
RED = '\033[91m'
GREEN = '\033[92m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

class GrowthEngineDebugger:
    def __init__(self, auto_fix=False):
        self.auto_fix = auto_fix
        self.issues = []
        self.warnings = []
        self.successes = []
        self.project_root = Path(__file__).parent.parent
        self.ai_agency_dir = Path(__file__).parent

        # Load environment
        load_dotenv(self.project_root / ".env.local")
        load_dotenv(self.project_root / ".env")

    def log(self, status: str, message: str):
        """Pretty print log messages"""
        colors = {
            "ERROR": RED,
            "WARN": YELLOW,
            "OK": GREEN,
            "INFO": BLUE
        }
        color = colors.get(status, RESET)
        print(f"{color}[{status}]{RESET} {message}")

    def check_environment_variables(self) -> Dict:
        """Check if all required environment variables are set"""
        self.log("INFO", "Checking environment variables...")

        required_vars = {
            "NEXT_PUBLIC_SUPABASE_URL": "Supabase URL",
            "SUPABASE_SERVICE_ROLE_KEY": "Supabase Service Key",
            "GEMINI_API_KEY": "Gemini API Key",
            "STRIPE_SECRET_KEY": "Stripe Secret Key",
            "TWILIO_ACCOUNT_SID": "Twilio Account SID",
            "TWILIO_AUTH_TOKEN": "Twilio Auth Token",
        }

        results = {}
        for var, desc in required_vars.items():
            value = os.environ.get(var)
            if value:
                self.log("OK", f"{desc}: Set ({'*' * 8}...)")
                self.successes.append(f"ENV: {var} is set")
                results[var] = True
            else:
                self.log("ERROR", f"{desc}: MISSING")
                self.issues.append(f"Missing environment variable: {var}")
                results[var] = False

        return results

    def check_database_health(self) -> Dict:
        """Check both SQLite and Supabase databases"""
        self.log("INFO", "Checking database health...")
        results = {}

        # Check SQLite
        sqlite_path = self.ai_agency_dir / "agency.db"
        if sqlite_path.exists():
            try:
                conn = sqlite3.connect(str(sqlite_path))
                cursor = conn.cursor()

                # Check tables
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = cursor.fetchall()
                self.log("OK", f"SQLite: Found {len(tables)} tables: {[t[0] for t in tables]}")

                # Check record counts
                for table in tables:
                    cursor.execute(f"SELECT COUNT(*) FROM {table[0]}")
                    count = cursor.fetchone()[0]
                    self.log("INFO", f"  - {table[0]}: {count} records")

                conn.close()
                results['sqlite'] = True
                self.successes.append("SQLite database is accessible")
            except Exception as e:
                self.log("ERROR", f"SQLite error: {e}")
                self.issues.append(f"SQLite error: {e}")
                results['sqlite'] = False
        else:
            self.log("WARN", "SQLite database not found (may be using Supabase only)")
            self.warnings.append("SQLite database not found")
            results['sqlite'] = None

        # Check Supabase
        supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

        if supabase_url and supabase_key:
            try:
                from supabase import create_client
                supabase = create_client(supabase_url, supabase_key)

                # Test connection by querying a table
                test_tables = ["businesses", "clients", "call_logs", "agency_prospects"]
                for table in test_tables:
                    try:
                        result = supabase.table(table).select("id").limit(1).execute()
                        count_result = supabase.table(table).select("id", count="exact").execute()
                        count = count_result.count if hasattr(count_result, 'count') else len(count_result.data)
                        self.log("OK", f"Supabase table '{table}': {count} records")
                        self.successes.append(f"Supabase table {table} is accessible")
                    except Exception as e:
                        self.log("WARN", f"Supabase table '{table}': {str(e)[:50]}")
                        self.warnings.append(f"Supabase table {table} issue: {str(e)[:50]}")

                results['supabase'] = True
            except Exception as e:
                self.log("ERROR", f"Supabase connection failed: {e}")
                self.issues.append(f"Supabase connection error: {e}")
                results['supabase'] = False
        else:
            self.log("ERROR", "Supabase credentials not configured")
            self.issues.append("Supabase credentials missing")
            results['supabase'] = False

        return results

    def check_api_servers(self) -> Dict:
        """Check if API servers are running"""
        self.log("INFO", "Checking API servers...")
        results = {}

        endpoints = {
            "FastAPI (8000)": "http://localhost:8000/health",
            "Flask Webhook (4242)": "http://localhost:4242/api/leads",
        }

        for name, url in endpoints.items():
            try:
                response = requests.get(url, timeout=2)
                if response.status_code == 200:
                    self.log("OK", f"{name}: Running")
                    self.successes.append(f"{name} is running")
                    results[name] = True
                else:
                    self.log("WARN", f"{name}: Returned {response.status_code}")
                    self.warnings.append(f"{name} returned status {response.status_code}")
                    results[name] = False
            except requests.exceptions.ConnectionError:
                self.log("ERROR", f"{name}: Not running")
                self.issues.append(f"{name} is not running")
                results[name] = False
            except Exception as e:
                self.log("ERROR", f"{name}: {e}")
                self.issues.append(f"{name} error: {e}")
                results[name] = False

        return results

    def check_file_paths(self) -> Dict:
        """Check for common file path issues"""
        self.log("INFO", "Checking file paths...")
        results = {}

        critical_files = [
            "ai_agency/api_server.py",
            "ai_agency/webhook_server.py",
            "ai_agency/database.py",
            "public/admin-dashboard.html",
            "public/index.html",
        ]

        for file_path in critical_files:
            full_path = self.project_root / file_path
            if full_path.exists():
                self.log("OK", f"Found: {file_path}")
                results[file_path] = True
            else:
                self.log("ERROR", f"Missing: {file_path}")
                self.issues.append(f"Missing file: {file_path}")
                results[file_path] = False

        # Check for path inconsistencies
        evaluate_ui_path = self.ai_agency_dir / "evaluate_ui.py"
        if evaluate_ui_path.exists():
            with open(evaluate_ui_path, 'r') as f:
                content = f.read()
                if "/app/clients/page.tsx" in content:
                    self.log("ERROR", "evaluate_ui.py has incorrect target path")
                    self.issues.append("evaluate_ui.py TARGET_FILE points to non-existent Next.js file")
                    results['evaluate_ui_path'] = False
                else:
                    results['evaluate_ui_path'] = True

        return results

    def check_agent_status(self) -> Dict:
        """Check status of AI agents"""
        self.log("INFO", "Checking AI agent files...")
        results = {}

        agent_files = [
            "research_agent.py",
            "triage_agent.py",
            "outreach_agent.py",
            "design_agent.py",
            "close_agent.py",
            "success_agent.py",
            "competitive_audit_agent.py",
        ]

        for agent_file in agent_files:
            agent_path = self.ai_agency_dir / agent_file
            if agent_path.exists():
                self.log("OK", f"Agent found: {agent_file}")
                results[agent_file] = True
            else:
                self.log("WARN", f"Agent missing: {agent_file}")
                self.warnings.append(f"Agent file missing: {agent_file}")
                results[agent_file] = False

        return results

    def auto_heal(self):
        """Automatically fix common issues"""
        self.log("INFO", "Running auto-heal...")

        fixes_applied = []

        # Fix 1: Correct evaluate_ui.py path
        evaluate_ui_path = self.ai_agency_dir / "evaluate_ui.py"
        if evaluate_ui_path.exists():
            with open(evaluate_ui_path, 'r') as f:
                content = f.read()

            if "/app/clients/page.tsx" in content:
                self.log("INFO", "Fixing evaluate_ui.py target path...")
                content = content.replace(
                    'TARGET_FILE = "/Users/johnkraeger/Downloads/growth engine /app/clients/page.tsx"',
                    f'TARGET_FILE = "{self.project_root}/public/admin-dashboard.html"'
                )
                content = content.replace(
                    'TARGET_URL = "http://localhost:3000/clients"',
                    f'TARGET_URL = "file://{self.project_root}/public/admin-dashboard.html"'
                )

                with open(evaluate_ui_path, 'w') as f:
                    f.write(content)

                self.log("OK", "Fixed evaluate_ui.py target path")
                fixes_applied.append("Fixed evaluate_ui.py target path")

        # Fix 2: Create missing directories
        required_dirs = [
            self.project_root / "logs",
            self.ai_agency_dir / "pw-tmp",
            self.ai_agency_dir / "pw-browsers",
        ]

        for dir_path in required_dirs:
            if not dir_path.exists():
                dir_path.mkdir(parents=True, exist_ok=True)
                self.log("OK", f"Created directory: {dir_path}")
                fixes_applied.append(f"Created directory: {dir_path}")

        # Fix 3: Create results tracking files if missing
        results_files = [
            self.ai_agency_dir / "ui_results.tsv",
            self.ai_agency_dir / "backend_results.tsv",
            self.ai_agency_dir / "agent_results.tsv",
        ]

        for results_file in results_files:
            if not results_file.exists():
                with open(results_file, 'w') as f:
                    f.write("commit\tmetric_value\tstatus\tdescription\ttimestamp\n")
                self.log("OK", f"Created results file: {results_file.name}")
                fixes_applied.append(f"Created results file: {results_file.name}")

        return fixes_applied

    def generate_report(self) -> str:
        """Generate a comprehensive diagnostic report"""
        report = []
        report.append("\n" + "="*60)
        report.append("GROWTH ENGINE DIAGNOSTIC REPORT")
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("="*60 + "\n")

        # Summary
        total_checks = len(self.successes) + len(self.warnings) + len(self.issues)
        report.append(f"📊 SUMMARY")
        report.append(f"  ✅ Passed: {len(self.successes)}")
        report.append(f"  ⚠️  Warnings: {len(self.warnings)}")
        report.append(f"  ❌ Errors: {len(self.issues)}")
        report.append(f"  📈 Health Score: {int((len(self.successes) / total_checks) * 100)}%\n")

        # Critical Issues
        if self.issues:
            report.append("🔴 CRITICAL ISSUES:")
            for i, issue in enumerate(self.issues, 1):
                report.append(f"  {i}. {issue}")
            report.append("")

        # Warnings
        if self.warnings:
            report.append("⚠️  WARNINGS:")
            for i, warning in enumerate(self.warnings, 1):
                report.append(f"  {i}. {warning}")
            report.append("")

        # Recommendations
        report.append("💡 RECOMMENDATIONS:")
        if self.issues:
            report.append("  1. Run with --fix flag to auto-heal common issues")
            report.append("  2. Check environment variables in .env.local")
            report.append("  3. Ensure API servers are running (ports 8000 & 4242)")
        else:
            report.append("  All systems nominal! Ready for autoresearch deployment.")

        report.append("\n" + "="*60 + "\n")

        return "\n".join(report)

    def run_full_diagnostic(self):
        """Run all diagnostic checks"""
        print(f"\n{BLUE}╔══════════════════════════════════════════════╗{RESET}")
        print(f"{BLUE}║  GROWTH ENGINE DIAGNOSTIC TOOL v1.0          ║{RESET}")
        print(f"{BLUE}╚══════════════════════════════════════════════╝{RESET}\n")

        # Run all checks
        self.check_environment_variables()
        print()
        self.check_database_health()
        print()
        self.check_api_servers()
        print()
        self.check_file_paths()
        print()
        self.check_agent_status()
        print()

        # Auto-heal if requested
        if self.auto_fix:
            fixes = self.auto_heal()
            if fixes:
                print(f"\n{GREEN}Applied {len(fixes)} fixes:{RESET}")
                for fix in fixes:
                    print(f"  ✓ {fix}")

        # Generate and print report
        report = self.generate_report()
        print(report)

        # Save report to file
        report_path = self.ai_agency_dir / f"diagnostic_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        with open(report_path, 'w') as f:
            f.write(report)

        print(f"{BLUE}📄 Full report saved to: {report_path}{RESET}\n")

        return len(self.issues) == 0

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Growth Engine Debug Tool")
    parser.add_argument("--fix", action="store_true", help="Auto-fix common issues")
    parser.add_argument("--watch", action="store_true", help="Continuous monitoring mode")
    args = parser.parse_args()

    debugger = GrowthEngineDebugger(auto_fix=args.fix)

    if args.watch:
        print("Starting continuous monitoring mode (Ctrl+C to stop)...")
        import time
        try:
            while True:
                debugger.run_full_diagnostic()
                time.sleep(60)  # Check every minute
        except KeyboardInterrupt:
            print("\nMonitoring stopped.")
    else:
        success = debugger.run_full_diagnostic()
        sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
