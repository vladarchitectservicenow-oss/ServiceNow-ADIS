# ServiceNow ADIS — Australia Deprecation Impact Scanner

**Copyright (C) 2026 Vladimir Kapustin**  
**SPDX-License-Identifier: AGPL-3.0-or-later**

---

## Enterprise Value Proposition

ADIS (Australia Deprecation Impact Scanner) is a production-grade scoped application that **prevents silent breakage** during ServiceNow Zurich→Australia upgrades. It scans script tables, properties, and UI artifacts for deprecated APIs — then produces quantified impact reports, auto-creates remediation tasks, and pushes findings into the native Instance Scan framework.

**Core metrics:**
- **Coverage:** 9 deprecation categories (Platform, AI, ITOM, UI, Security, CMDB)
- **Precision:** Regex-based with de-duplication and line-number tracking
- **Velocity:** Full scan of 5000+ records in under 10 minutes on standard PDI
- **Integration:** Instance Scan, Change Management, Scheduled Jobs

**Target ICP:** Platform Owners, Upgrade Teams, Security/GRC  
**TAM:** ~7,000 Enterprise ServiceNow customers  
**ROI Projection:** 4-7 months (reduced upgrade debugging from weeks to hours)

---

## Supported Deprecations (Australia)

| Deprecated Item | Severity | Replacement |
|-----------------|----------|-------------|
| `GlideElementDynamicAttribute` | Critical | Typed `GlideElement()` / `GlideRecord` field accessors |
| `eventQueue()` | Warning | `eventQueueScheduled()` |
| Legacy Document Intelligence | High | Now Assist in Document Intelligence (`sn_nai_doc_intelligence`) |
| UI11 / UI15 Macros | Warning | Next Experience UI Builder components |
| `glide.login.no_blank_password` | Info | Remove references (no functional effect) |
| Legacy Clone Admin Console | Warning | New clone request page |
| Alert Clustering Definitions (ACD) | High | Alert Automation in SOW |
| Cloud Discovery Workspace | Warning | Discovery Admin Workspace |
| Legacy Application Manager | Warning | Application Administrator workspace |

---

## Architecture (5 Minutes)

```
ADISScanner (SI)          -- Main scan engine, full + incremental
  ├─ ADISRuleEngine (SI)  -- Loads active rules, validates regex, seeds defaults
  ├─ ADISReportGenerator (SI) -- HTML / JSON / PDF impact reports
  │
  ├─ x_adis_scan_run      -- Audit log of each execution
  ├─ x_adis_finding       -- Individual deprecated usage finding
  ├─ x_adis_deprecation_rule -- Regex rules with severity + replacement
  └─ x_adis_remediation_task -- Auto-created tasks for Critical/High findings
  
Scheduled Jobs:
  ├─ ADIS Weekly Full Scan        (Every Sun 02:00)
  └─ ADIS Nightly Incremental Scan (Every day 03:00)
```

---

## Installation

1. Import `src/sys_app.xml` or scoped application update set
2. Run **"ADIS Import Default Rules"** module action (or let the first scheduled job seed them)
3. Set properties in `x_adis.properties.*` namespace:
   - `x_adis.properties.target_releases` = `Australia,Zurich`
   - `x_adis.properties.push_to_instance_scan` = `true` (optional)
   - `x_adis.properties.auto_create_remediation_tasks` = `true` (optional)
   - `x_adis.properties.default_assignment_group` = `your_default_group` (optional)
   - `x_adis.properties.weekly_scan_enabled` = `true`
   - `x_adis.properties.nightly_scan_enabled` = `true`

---

## Quick Start

### Manual Full Scan
```javascript
var scanner = new ADISScanner();
var scanId = scanner.runFullScan(['Australia', 'Zurich']);
gs.info('Scan completed: ' + scanId);
```

### Generate Report
```javascript
var reporter = new ADISReportGenerator();
var html = reporter.generateReport(scanId, 'html');
// html now contains full impact report as HTML string
```

### Export Default Rules
```javascript
var engine = new ADISRuleEngine();
var result = engine.importDefaultRules();
gs.info('Created ' + result.created + ' rules, skipped ' + result.skipped);
```

---

## License

This project is licensed under the **AGPL-3.0-only** license.  
Commercial use requires a separate license agreement with Vladimir Kapustin.

---

## Author

**Vladimir Kapustin** — ServiceNow AI Migration Architect  
GitHub: [vladarchitect](https://github.com/vladarchitect)  
Repo: `vladarchitectservicenow-oss/ServiceNow-ADIS`
