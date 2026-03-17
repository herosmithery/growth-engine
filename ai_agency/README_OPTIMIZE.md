# Growth Engine Optimize System

Complete autonomous optimization system for the Growth Engine, inspired by [optimize-macos](https://github.com/miolini/optimize-macos).

## 🚀 Quick Start

### 1. Run Diagnostics & Auto-Fix Issues

```bash
cd "/Users/johnkraeger/Downloads/growth engine/ai_agency"

# Run diagnostics
python3 debug_tool.py

# Auto-fix common issues
python3 debug_tool.py --fix

# Continuous monitoring
python3 debug_tool.py --watch
```

### 2. Start Auto-Heal System

```bash
# Run autonomous healing loop (checks every 5 minutes)
python3 auto_heal_system.py

# Run single health check
python3 auto_heal_system.py --once

# Custom check interval (every 10 minutes)
python3 auto_heal_system.py --interval 600
```

### 3. Run Parallel Optimize Swarm

```bash
# Run all optimization agents in parallel (infinite mode)
python3 parallel_orchestrator.py

# Run for 8 hours (overnight optimization)
python3 parallel_orchestrator.py --duration 8h

# Run specific agents only
python3 parallel_orchestrator.py --agents backend-optimizer frontend-optimizer

# List available agents
python3 parallel_orchestrator.py --list-agents
```

### 4. Run Individual Optimization Agents

```bash
# Optimize backend API latency
python3 universal_optimize_agent.py --target backend

# Optimize frontend UX
python3 universal_optimize_agent.py --target frontend

# Optimize specific AI agent
python3 universal_optimize_agent.py --target agent --agent-name outreach_agent

# Run for limited iterations
python3 universal_optimize_agent.py --target backend --max-iterations 50
```

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  PARALLEL ORCHESTRATOR                       │
│                (parallel_orchestrator.py)                    │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Backend    │  │  Frontend    │  │  AI Agents   │
│  Optimizer   │  │  Optimizer   │  │  Optimizer   │
│              │  │              │  │              │
│ (Latency ↓)  │  │ (UX Score ↑) │  │ (Accuracy ↑) │
└──────────────┘  └──────────────┘  └──────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                           ▼
                ┌──────────────────┐
                │  Auto-Heal       │
                │  System          │
                │ (Monitors all)   │
                └──────────────────┘
```

## 🛠 Components

### 1. Debug Tool (`debug_tool.py`)
Comprehensive diagnostic system that checks:
- ✅ Environment variables
- ✅ Database health (SQLite + Supabase)
- ✅ API servers (FastAPI + Flask)
- ✅ File paths and integrity
- ✅ AI agent files

**Features:**
- Auto-fix common issues
- Continuous monitoring mode
- Detailed diagnostic reports
- Health score calculation

### 2. Auto-Heal System (`auto_heal_system.py`)
Autonomous self-healing that:
- 🔍 Monitors system health continuously
- 🔧 Automatically fixes detected issues
- 📊 Tracks healing history
- ⚡ Restarts crashed services

**Auto-Fixes:**
- Restart API servers
- Restore files from git
- Install missing packages
- Clean temp files
- Rotate large logs
- Check environment variables

### 3. Universal Optimize Agent (`universal_optimize_agent.py`)
Autonomous optimization agent that can optimize ANY component:

**Supported Targets:**
- **Backend**: API latency optimization
- **Frontend**: UX score improvement
- **Agents**: AI agent accuracy tuning

**How it works:**
1. Generate modification idea
2. Apply change to code
3. Git commit
4. Run experiment
5. Measure metric
6. Keep if better, discard if worse
7. Repeat indefinitely

### 4. Parallel Orchestrator (`parallel_orchestrator.py`)
Master controller that runs multiple agents simultaneously:

**Default Agents:**
- `backend-optimizer` - Optimizes API latency
- `frontend-optimizer` - Optimizes UX design
- `outreach-optimizer` - Tunes outreach agent
- `design-optimizer` - Tunes design agent
- `close-optimizer` - Tunes close agent

**Features:**
- Parallel execution
- Duration limits
- Status monitoring
- Summary reports
- Graceful shutdown

## 📈 Metrics Tracked

### Backend Optimization
- **Metric**: `api_latency_ms` (lower is better)
- **Target**: Minimize response time
- **Logged to**: `backend_results.tsv`

### Frontend Optimization
- **Metric**: `ux_score` (0-100, higher is better)
- **Target**: Maximize user experience
- **Logged to**: `frontend_results.tsv`

### Agent Optimization
- **Metric**: `accuracy_percentage` (higher is better)
- **Target**: Maximize success rate
- **Logged to**: `{agent_name}_results.tsv`

## 🔄 Optimize Methodology

Inspired by Andrej Karpathy's optimize pattern:

```python
LOOP FOREVER:
    1. Generate experimental idea
    2. Modify code
    3. Git commit
    4. Run experiment (fixed time budget)
    5. Evaluate metric
    6. If improved → keep
    7. If worse → git reset (discard)
    8. Log results
    9. Repeat
```

**Key Principles:**
- ✅ Fixed time budgets (comparable experiments)
- ✅ Git-based version control
- ✅ Metric-driven decisions
- ✅ Autonomous operation
- ✅ TSV result logging

## 📝 Results Files

All experiments are logged to TSV files:

```
commit    metric_value    status    description           timestamp
abc1234   45.2           keep      Add response caching   2026-03-12T10:30:00
def5678   52.1           discard   Switch to async        2026-03-12T10:35:00
ghi9012   0.0            crash     Double batch size      2026-03-12T10:40:00
```

## 🌙 Overnight Optimization

Run the parallel swarm overnight for ~100 experiments:

```bash
# Start before bed (8 hour run)
nohup python3 parallel_orchestrator.py --duration 8h > swarm.log 2>&1 &

# Check status
tail -f swarm.log

# Or use tmux/screen for better control
tmux new -s optimize
python3 parallel_orchestrator.py --duration 8h
# Detach: Ctrl+B, D
# Reattach: tmux attach -t optimize
```

**Expected Results (8 hours):**
- ~12 experiments/hour per agent
- 5 agents running = ~480 total experiments
- Best improvements kept, failures discarded
- Wake up to optimized system + full reports

## 🔍 Monitoring

### Check Running Agents
```bash
# See all running Python processes
ps aux | grep "universal_optimize"

# Check auto-heal status
ps aux | grep "auto_heal_system"

# View logs
tail -f ai_agency/auto_heal.log
tail -f ai_agency/diagnostic_report_*.txt
```

### View Results
```bash
# Backend optimization results
cat ai_agency/backend_results.tsv

# Frontend optimization results
cat ai_agency/frontend_results.tsv

# Agent-specific results
cat ai_agency/outreach_agent_results.tsv
```

### Git History
```bash
# See all experiments on a branch
git log --oneline optimize-backend

# See what changed in an experiment
git show abc1234

# Compare best vs baseline
git diff optimize-backend~50 optimize-backend
```

## 🚨 Troubleshooting

### Agent Won't Start
```bash
# Run diagnostics first
python3 debug_tool.py --fix

# Check if ports are in use
lsof -i :8000
lsof -i :4242

# Verify git repo
cd "/Users/johnkraeger/Downloads/growth engine"
git status
```

### Experiments Keep Crashing
```bash
# Check auto-heal logs
cat ai_agency/auto_heal.log

# Run health check
python3 auto_heal_system.py --once

# Review experiment logs
grep "crash" ai_agency/*_results.tsv
```

### Database Issues
```bash
# Test Supabase connection
python3 -c "from database import supabase; print(supabase.table('businesses').select('id').limit(1).execute())"

# Check SQLite
sqlite3 ai_agency/agency.db "SELECT COUNT(*) FROM leads;"
```

## 🎯 Best Practices

1. **Always run diagnostics first**
   ```bash
   python3 debug_tool.py --fix
   ```

2. **Start with auto-heal running**
   ```bash
   python3 auto_heal_system.py &
   ```

3. **Test individual agents before swarm**
   ```bash
   python3 universal_optimize_agent.py --target backend --max-iterations 5
   ```

4. **Use git branches for experiments**
   - Each optimization target gets its own branch
   - Main branch stays clean
   - Can cherry-pick best improvements

5. **Monitor resource usage**
   ```bash
   # CPU and memory
   top -pid $(pgrep -f "parallel_orchestrator")

   # Disk space
   df -h
   ```

## 📚 Integration with Growth Engine

The optimize system integrates with existing Growth Engine components:

- **API Server** (`api_server.py`) - Backend optimization target
- **Webhook Server** (`webhook_server.py`) - Monitored by auto-heal
- **Database** (`database.py`) - Health checked by diagnostics
- **AI Agents** (`*_agent.py`) - Optimization targets
- **Frontend** (`public/*.html`) - UX optimization target

## 🔮 Future Enhancements

- [ ] LLM-powered code modifications (currently using placeholders)
- [ ] Multi-metric optimization (Pareto frontier)
- [ ] A/B testing framework
- [ ] Automated deployment pipeline
- [ ] Slack/Discord notifications
- [ ] Web dashboard for monitoring
- [ ] Cost optimization (token usage tracking)
- [ ] Performance profiling integration

## 📄 License

Same as Growth Engine main project.

---

**Inspired by:** [optimize-macos](https://github.com/miolini/optimize-macos) by @karpathy
