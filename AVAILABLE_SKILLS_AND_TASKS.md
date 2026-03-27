# Growth Engine - Available Skills and Tasks

## 🎯 Overview
Your Growth Engine has two types of automation:
1. **AI Agents** - Specialized agents for business operations
2. **Web Skills** - Automated testing, scraping, and development tools

---

## 🤖 AI AGENTS (Business Automation)

Located in: `/Users/johnkraeger/Downloads/growth engine/ai_agency/`

### Core Business Agents:

1. **Main Skill Agent** (`main_skill_agent.py`)
   - Orchestrator that breaks down large tasks
   - Can execute any of the other skills/agents
   - **Usage**: `python3 ai_agency/main_skill_agent.py "your task here"`

2. **Triage Agent** (`triage_agent.py`)
   - Analyzes incoming leads and prioritizes them
   - Qualifies leads based on criteria
   - Routes to appropriate next steps

3. **Speed to Lead Agent** (`speed_to_lead_agent.py`)
   - Rapid response to new leads
   - Automates initial outreach within minutes
   - Increases conversion rates

4. **Outreach Agent** (`outreach_agent.py`)
   - Automated personalized outreach
   - Email and message campaigns
   - Follow-up sequences

5. **Close Agent** (`close_agent.py`)
   - Handles closing deals
   - Generates proposals and contracts
   - Tracks deal progress

6. **Success Agent** (`success_agent.py`)
   - Customer success automation
   - Onboarding workflows
   - Satisfaction monitoring

7. **Research Agent** (`research_agent.py`)
   - Market research
   - Competitive analysis
   - Lead intelligence gathering

8. **Design Agent** (`design_agent.py`)
   - Generates marketing materials
   - Creates web mockups
   - Visual asset creation

9. **Competitive Audit Agent** (`competitive_audit_agent.py`)
   - Analyzes competitor websites
   - Identifies gaps and opportunities
   - Generates competitive reports

10. **Universal Optimize Agent** (`universal_optimize_agent.py`)
    - Optimizes existing processes
    - A/B testing suggestions
    - Performance improvements

11. **Field Report Agent** (`field_report_agent.py`)
    - Generates field service reports
    - Tracks on-site work
    - Documentation automation

12. **Dispatch Agent** (`dispatch_agent.py`)
    - Routes service calls
    - Schedules technicians
    - Optimizes routes

13. **Inventory Agent** (`inventory_agent.py`)
    - Tracks inventory levels
    - Reorder automation
    - Stock management

14. **Growth Engine Voice Agent** (`growth_engine_voice_agent.py`)
    - AI phone conversations
    - Call handling and routing
    - Appointment booking via voice

15. **Trades Triage Agent** (`trades_triage_agent.py`)
    - Specialized for trades businesses
    - Job qualification
    - Estimate generation

---

## 🌐 WEB SKILLS (Testing & Automation)

Located in: `/Users/johnkraeger/Downloads/skills/`

### Available Skills:

1. **Web Testing Automation** (`web-testing-automation/`)
   - Automated browser testing
   - End-to-end test scenarios
   - Cross-browser compatibility

2. **Web Scraping Ethical** (`web-scraping-ethical/`)
   - Extract data from websites
   - Competitor price monitoring
   - Lead data collection
   - **Ethical and compliant**

3. **Web Accessibility Audit** (`web-accessibility-audit/`)
   - WCAG compliance checking
   - Accessibility issues detection
   - Remediation suggestions

4. **Visual Regression Testing** (`visual-regression-testing/`)
   - Screenshot comparison
   - Detect UI changes
   - Prevent visual bugs

5. **Login State Manager** (`login-state-manager/`)
   - Handle authentication
   - Session management
   - Multi-account testing

6. **Form Automation** (`form-automation/`)
   - Auto-fill forms
   - Bulk form submissions
   - Data entry automation

7. **API Mocking Development** (`api-mocking-development/`)
   - Mock API endpoints
   - Test without backend
   - Development acceleration

8. **Perplexity Research** (`perplexity_research/`)
   - AI-powered research
   - Market analysis
   - Information gathering

---

## 🚀 HOW TO USE

### Running AI Agents:

```bash
# Use the Main Skill Agent to orchestrate complex tasks
cd "/Users/johnkraeger/Downloads/growth engine"
python3 ai_agency/main_skill_agent.py "Find 10 leads in the dental industry in New York"

# Or run agents directly
python3 ai_agency/research_agent.py "Research competitors in the medspa space"
python3 ai_agency/outreach_agent.py "Send personalized emails to leads in database"
```

### Running Web Skills:

```bash
# List all skills
cd /Users/johnkraeger/Downloads/skills
ls -la

# Read skill documentation
cat web-scraping-ethical/SKILL.md

# Execute a skill (example)
cd web-scraping-ethical
python3 scrape.py --target="https://example.com" --data="prices"
```

### Using the Main Skill Agent (Recommended):

The Main Skill Agent can orchestrate multiple skills together:

```bash
python3 ai_agency/main_skill_agent.py "Scrape competitor prices and create a comparison report"
```

It will:
1. List available skills
2. Read documentation for relevant skills
3. Execute the skills in the right order
4. Combine results into a final output

---

## 💡 EXAMPLE TASKS YOU CAN RUN

### Lead Generation & Outreach:
```bash
python3 ai_agency/main_skill_agent.py "Find 20 medspas in Florida and generate personalized outreach emails"
```

### Competitive Intelligence:
```bash
python3 ai_agency/competitive_audit_agent.py "Analyze top 5 competitors in the dental implant space"
```

### Web Scraping:
```bash
cd /Users/johnkraeger/Downloads/skills/web-scraping-ethical
python3 scrape.py
```

### Accessibility Testing:
```bash
cd /Users/johnkraeger/Downloads/skills/web-accessibility-audit
python3 audit.py --url="https://yoursite.com"
```

### Research:
```bash
python3 ai_agency/research_agent.py "What are the latest trends in AI voice agents for service businesses?"
```

---

## 📊 YOUR GROWTH ENGINE DASHBOARD

**Access your live dashboard:**
- **Local**: http://localhost:3000
- **Remote**: https://sightly-unawarely-zulma.ngrok-free.dev

**Available Pages:**
- ✅ Dashboard - Overview and metrics
- ✅ AI Calls - Voice agent call logs
- ✅ Calendar - Appointment scheduling
- ✅ Appointments - Full appointment pipeline
- ✅ Messages - SMS/Email communication
- ✅ Clients - Client management
- ✅ Leads - Lead tracking
- ✅ Campaigns - Marketing campaigns
- ✅ Reviews - Review management
- ✅ Settings - System configuration

---

## 🔑 REQUIREMENTS

### For AI Agents:
- **GEMINI_API_KEY** - Required for AI agent execution
- **ANTHROPIC_API_KEY** - Some agents may use Claude
- **SERPAPI_KEY** - For web search capabilities

### For Web Skills:
- **Python 3.9+** with packages installed
- **Playwright** for browser automation
- Various API keys depending on the skill

---

## 📝 NEXT STEPS

1. **Test an agent**: Run a simple task with the Main Skill Agent
2. **Explore skills**: Read SKILL.md files in each skill folder
3. **Check environment**: Make sure API keys are configured
4. **Run a task**: Try one of the example tasks above

---

**Last Updated**: March 18, 2026
**Status**: All systems operational ✅
