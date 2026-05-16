# ADIS — Architecture Plan
## Australia Deprecation Impact Scanner
**Scope:** `x_adis` | **Product ID:** ADIS | **Release Cycle:** Zurich (2025) → Australia (2026)

---

## 1. Vision

Provide an automated, self-contained deprecation scanner that audits every script, property, and metadata record in a ServiceNow instance for APIs, tables, and UI constructs removed or deprecated between the Zurich and Australia release families.

Outcome: a prioritized remediation backlog reducing upgrade downtime from **weeks to hours**.

---

## 2. Target Audience (ICP)

- **Platform Owners** — responsible for release-readiness go/no-go decisions
- **Upgrade Architects** — planning Zurich → Australia migrations
- **Security / GRC teams** — verifying no deprecated encryption or auth APIs remain
- **ServiceNow Partners / MSPs** — offering upgrade assessment services

---

## 3. Core Modules

```
┌─────────────────────────────────────────────────────────┐
│                     ADIS (x_adis)                       │
├──────────────────┬──────────────────┬───────────────────┤
│   Scan Engine    │   Rule Engine    │   Report Engine   │
│                  │                  │                   │
│ ADISScanner      │ ADISRuleEngine   │ ADISReportGen     │
│ ADISChunkedQuery │ ADISRuleRegistry │ ADISDashboard     │
│ ADISArtifactMap  │ ADISRemediation  │ ADISNotifier      │
└──────────────────┴──────────────────┴───────────────────┘
```

---

## 4. Data Model

### 4.1 Tables

| Table | Technical Name | Purpose |
|-------|---------------|---------|
| Scan Run | `x_adis_scan_run` | Audit header per scan execution |
| Finding | `x_adis_finding` | Individual deprecated usage detected |
| Deprecation Rule | `x_adis_deprecation_rule` | Rules engine (regex, replacement, severity) |
| Remediation Task | `x_adis_remediation_task` | Auto-created change tasks from findings |
| Scan Config | `x_adis_scan_config` | Admin-tunable config (enable/disable rules) |

### 4.2 Reference Data

Rules are shipped as **application data** (not hard-coded) so customers can add their own enterprise-specific deprecations without upgrading the app.

---

## 5. Scan Engine (ADISScanner)

### 5.1 Target Artifacts

| Artifact Type | Table Queried | Field Scanned | Notes |
|---------------|--------------|---------------|-------|
| Script Include | `sys_script_include` | `script` | Full server-side JS |
| Business Rule | `sys_script` | `script` | Condition + script fields |
| Client Script | `sys_script_client` | `script` | Both `onLoad` and `onChange` |
| UI Action | `sys_ui_action` | `script` | Client + server scripts |
| Scheduled Job | `sys_trigger` | `script` | Background scripts |
| Transform Script | `sys_transform_script` | `script` | Import set logic |
| Script in BR | `sys_script_fix` | `script` | Fix scripts |
| Web Service | `sys_ws_operation` | `script` | Scripted REST operations |
| Flow Action | `sys_hub_action_type_definition` | `script` | Flow Designer custom actions |
| Email Script | `sys_script_email` | `script` | Notification logic |
| UI Macro | `sys_ui_macro` | `xml` + `script` | Jelly + JS |
| System Property | `sys_properties` | `value` | Deprecated property values |
| UI Policy | `sys_ui_policy` | `script` | Client-side policy scripts |
| Update Set | `sys_update_xml` | `payload` | Cross-release compatibility |

### 5.2 Scan Strategy

1. **Chunked Query** — `GlideRecord.setLimit(500)` with `while gr.next()` to avoid timeouts on instances with 100K+ script records.
2. **Async Scanning** — `ADISScanner` runs via **Scheduled Job**; can be triggered via UI Action for on-demand scan.
3. **Delta Scanning** — Tracks `sys_updated_on` to skip unchanged records between incremental runs.
4. **Multi-threading Safe** — Uses `sys_execution_tracker` to prevent concurrent scans.

---

## 6. Rule Engine (ADISRuleEngine)

### 6.1 Deprecation Categories

| Category | Count | Examples |
|----------|-------|----------|
| **Removed APIs** | 5 | `GlideElementDynamicAttribute` |
| **Deprecated Auth** | 3 | OAuth API endpoints for external clients |
| **Deprecated Properties** | 4 | `glide.login.no_blank_password` |
| **Deprecated UI** | 3 | UI11, UI15, Agent Workspace legacy macros |
| **Deprecated Tables** | 4 | `sn_vul_wiz_missing_asset`, data generation profiles |
| **Deprecated AI** | 2 | Document Intelligence standalone, Alert Clustering Definitions |
| **Deprecated Integrations** | 2 | O365 webhook connectors, Legacy clones |

### 6.2 Rule Schema (per `x_adis_deprecation_rule`)

| Field | Type | Purpose |
|-------|------|---------|
| `name` | String | Human-readable rule name |
| `category` | Choice | Removed API / Deprecated Auth / Deprecated UI / etc. |
| `severity` | Choice | Critical / High / Medium / Low |
| `regex_pattern` | String | JS regex for detection |
| `replacement_hint` | String | Suggested migration path |
| `documentation_url` | URL | Link to ServiceNow docs |
| `affected_release` | String | "Zurich → Australia" |
| `active` | Boolean | Enable/disable rule |

### 6.3 Included Rules (Zurich → Australia)

#### Rule: REMOVED-001 — `GlideElementDynamicAttribute`
```json
{
  "name": "GlideElementDynamicAttribute Removed",
  "category": "Removed API",
  "severity": "Critical",
  "regex_pattern": "new\\s+GlideElementDynamicAttribute",
  "replacement_hint": "Use typed GlideElement instances corresponding to the attribute's concrete field type.",
  "documentation_url": "https://developer.servicenow.com/australia/api-reference/GlideElementDynamicAttribute",
  "affected_release": "Zurich → Australia"
}
```

#### Rule: DEPRECATED-002 — `glide.login.no_blank_password`
```json
{
  "name": "glide.login.no_blank_password Deprecated",
  "category": "Deprecated Property",
  "severity": "Medium",
  "regex_pattern": "glide\\.login\\.no_blank_password",
  "replacement_hint": "Property no longer functional. Remove references and rely on default password policy.",
  "documentation_url": "https://docs.servicenow.com/australia/authentication",
  "affected_release": "Zurich → Australia"
}
```

*(Full rule registry: 23 rules — see ADISRuleRegistry source)*

---

## 7. Report Engine (ADISReportGen)

### 7.1 Output Formats

| Format | Audience | Trigger |
|--------|----------|---------|
| HTML Dashboard | Platform Admins | Real-time UI page |
| JSON (REST API) | CI/CD pipelines | REST endpoint `/api/x_adis/scan/report` |
| PDF | GRC / Executive | UI Action "Export PDF" |
| CSV | Excel analysis | UI Action "Export CSV" |

### 7.2 Dashboard Elements

- **Risk Score** per application (count of Critical × 10 + High × 5 + Medium × 2 + Low × 1)
- **Progress Tracker** — % of findings remediated vs open over time
- **Top Offenders** — applications with the highest finding count
- **Severity Breakdown** — pie chart of Critical/High/Medium/Low
- **Remediation Queue** — list view of `x_adis_remediation_task`

### 7.3 Integration Points

| System | Integration Mode | Purpose |
|--------|-----------------|---------|
| Instance Scan | Native | Publish findings as `scan_finding` records |
| Change Management | REST + Business Rule | Auto-create emergency changes for Critical findings |
| Project Management (PPM) | Script Include | Link remediation tasks to upgrade project |
| Now Assist | AI Skills | Natural language query: "Show my Critical findings for Australia" |

---

## 8. Remediation Workflow

```
Scan Complete
    │
    ▼
┌──────────────┐
│  Findings    │
│  Generated   │
└──────┬───────┘
       │
       ▼
┌──────────────┐    Yes    ┌─────────────────┐
│ Severity =   │──────────▶│ Auto-create     │
│ Critical?    │           │ Emergency       │
│              │           │ Change Request  │
└──────┬───────┘           └─────────────────┘
       │ No
       ▼
┌──────────────┐    Yes    ┌─────────────────┐
│ Severity =   │──────────▶│ Auto-create     │
│ High?        │           │ Standard Change │
└──────┬───────┘           └─────────────────┘
       │ No
       ▼
┌──────────────┐
│ Add to       │
│ Remediation  │
│ Backlog      │
└──────────────┘
```

---

## 9. Security Model

| Role | Permissions |
|------|-------------|
| `x_adis.admin` | Full CRUD on all tables, can edit rules, trigger scans, export reports |
| `x_adis.scanner` | Read-only on findings, trigger scans, view dashboard |
| `x_adis.report_reader` | Read-only on reports and dashboard |

All scan data remains **within the instance** — no external API calls, no data leakage.

---

## 10. Testing Strategy

| Test Type | Tool | Coverage |
|-----------|------|----------|
| Unit Tests | `jest` (SN Test Runner) | Script Includes, Rule Engine regex matching |
| Integration Tests | Python + Selenium | End-to-end scan → report → remediation task creation |
| PDI Smoke Tests | Manual on dev362840 | Verify app installs without errors, scan completes |
| Performance Tests | Background Script + Timer | 100K script records scan under 5 minutes |

---

## 11. Build Order (within ADIS)

1. **Tables + ACLs** — create schema, security rules
2. **Rule Registry** — seed 23 deprecation rules as application data
3. **Scan Engine** — core `ADISScanner` with chunked querying and regex matching
4. **Report Engine** — HTML dashboard, REST endpoints, PDF export
5. **Remediation** — auto-create change/task records from findings
6. **Tests** — all test suites passing before push
7. **Marketing** — README, Whitepaper, LinkedIn/X posts
8. **Push** — to `vladarchitectservicenow-oss/ADIS/`

---

## 12. Phoenix Tracing Tags

All node executions tagged with:
- `project: ADIS`
- `phase: build | test | deploy | marketing`
- `model_used: kimi-k2.6 | deepseek-v4-pro | qwen-3.6-plus`
- `status: pass | fail | retry`

*End of Architecture Plan.*
