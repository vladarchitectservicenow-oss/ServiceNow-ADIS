# Copyright (C) 2026 Vladimir Kapustin
# This file is part of ServiceNow ADIS (Australia Deprecation Impact Scanner).
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# ADIS Architecture Document
# Product: Australia Deprecation Impact Scanner
# Scope: x_adis
# Date: 2026-05-16
# License: AGPL-3.0

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ServiceNow Platform                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            ADIS Scoped App (x_adis)                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │ Scanner  │  │ RuleEng  │  │ ReportGen│            │   │
│  │  │ (SI)     │  │ (SI)     │  │ (SI)     │            │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘            │   │
│  │       │             │             │                   │   │
│  │  ┌────┴───┐  ┌─────┴───┐  ┌──────┴────┐            │   │
│  │  │Tables  │  │Tables   │  │Tables     │            │   │
│  │  │scan_run│  │rule     │  │remediation│            │   │
│  │  │finding │  │         │  │task       │            │   │
│  │  └────────┘  └─────────┘  └───────────┘            │   │
│  │       ▲                                              │   │
│  │  ┌────┴────────────────────────────────────┐         │   │
│  │  │ Scheduled Jobs                           │         │   │
│  │  │ • ADIS Weekly Full Scan                  │         │   │
│  │  │ • ADIS Nightly Incremental Scan          │         │   │
│  │  └──────────────────────────────────────────┘         │   │
│  │       ▲                                              │   │
│  │  ┌────┴────────────────────────────────────┐         │   │
│  │  │ Business Rules                           │         │   │
│  │  │ • Validate rule regex on insert/update    │         │   │
│  │  │ • Auto-create remediation task             │         │   │
│  │  │ • Auto-push to Instance Scan               │         │   │
│  │  └──────────────────────────────────────────┘         │   │
│  └─────────────────────────────────────────────────────┘   │
│                    ▲                                        │
│  ┌─────────────────┴────────────────────────────────────┐  │
│  │          ServiceNow Platform Tables (Targets)       │  │
│  │  sys_script_include, sys_script (BR),              │  │
│  │  sys_script_client, sys_ws_operation,              │  │
│  │  sys_properties, sys_ui_macro,                      │  │
│  │  sys_update_set, sys_app_module                   │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Table Schema

### x_adis_scan_run
| Column | Type | Notes |
|--------|------|-------|
| sys_id | GUID | PK |
| number | String | Display value (auto-number ADI-YYYY-{0001}) |
| scan_type | Choice | full, incremental |
| scope | Choice | global, scoped, all |
| target_releases | List | Australia, Zurich, etc. |
| state | Choice | Queued, Running, Completed, Failed, Cancelled |
| findings_count | Integer | Total findings |
| skipped_count | Integer | Malformed records skipped |
| risk_score | Integer | 0-100 aggregate |
| execution_time_ms | Integer | Duration |
| last_scan_run_ref | Reference | For incremental scans |
| pushed_to_instance_scan | Boolean | True if findings pushed |
| started | DateTime | Start timestamp |
| ended | DateTime | End timestamp |

### x_adis_finding
| Column | Type | Notes |
|--------|------|-------|
| sys_id | GUID | PK |
| scan_run_ref | Reference | → x_adis_scan_run |
| table_name | String | Source table (sys_script_include, etc.) |
| record_sys_id | String | Source record sys_id |
| record_name | String | Source record display name |
| deprecated_item | String | Name of deprecated API/table/prop |
| regex_match | String | Actual matched text (truncated to 500) |
| line_number | Integer | Approximate line (0 if not available) |
| severity | Choice | Critical, High, Warning, Info |
| replacement_suggestion | String | Suggested fix |
| rule_ref | Reference | → x_adis_deprecation_rule |
| remediation_task_ref | Reference | → x_adis_remediation_task (nullable) |
| state | Choice | New, Acknowledged, Resolved, FalsePositive |

### x_adis_deprecation_rule
| Column | Type | Notes |
|--------|------|-------|
| sys_id | GUID | PK |
| name | String | Unique |
| active | Boolean | Default true |
| regex_pattern | String | JavaScript RegExp source |
| replacement_suggestion | String | Human-readable fix |
| target_release | Choice | Australia, Zurich, Washington DC, etc. |
| severity | Choice | Critical, High, Warning, Info |
| applies_to | List | Tables to scan (comma-separated)
| description | String | Business context |
| category | Choice | Platform, AI, CMDB, Security, UI, Workflow |

### x_adis_remediation_task
| Column | Type | Notes |
|--------|------|-------|
| sys_id | GUID | PK |
| finding_ref | Reference | → x_adis_finding |
| task_type | Choice | change_request, incident, problem |
| short_description | String | Auto-generated |
| description | String | Full context |
| state | Choice | New, InProgress, Resolved, Closed |
| assignment_group | Reference | Default from properties |
| priority | Choice | 1-Critical, 2-High, 3-Moderate, 4-Low |
| external_task_ref | String | Sys_id in target task table |

---

## 3. Script Include Architecture

### ADISScanner (Server-side, main)
```javascript
var ADISScanner = Class.create();
ADISScanNER.prototype = {
    initialize: function() {
        this.tablesToScan = [
            'sys_script_include',
            'sys_script',
            'sys_script_client',
            'sys_ws_operation'
        ];
        this.batchSize = 100;  // For GlideRecord pagination
        this.maxTextLength = 10000;
    },

    runFullScan: function(targetReleases) {
        // 1. Create scan_run record
        // 2. Load all active deprecation rules
        // 3. For each table:
        //    a. Query all records
        //    b. For each record, scan script field
        //    c. Match against all applicable rules
        //    d. Create findings
        // 4. Calculate risk_score, findings_count
        // 5. Update scan_run state → Completed
        // 6. Optionally push to Instance Scan
        // 7. Optionally auto-create remediation tasks
    },

    runIncrementalScan: function(lastScanRunId) {
        // 1. Get last scan timestamp
        // 2. Query records modified since last scan
        // 3. Scan only new/changed records
    },

    _scanRecord: function(gr, rules) {
        // Extract script field, apply each rule regex
        // Return array of finding objects
    },

    _createFindings: function(findings, scanRunId) {
        // Bulk insert into x_adis_finding
    }
};
```

### ADISRuleEngine (Server-side, rule management)
```javascript
var ADISRuleEngine = Class.create();
ADISRuleEngine.prototype = {
    initialize: function() {},

    getActiveRules: function(targetReleases, tableName) {
        // Query x_adis_deprecation_rule
        // active=true, target_release IN targetReleases
        // applies_to CONTAINS tableName
    },

    validateRuleRegex: function(regexPattern) {
        // Attempt new RegExp(regexPattern)
        // Return { valid: bool, error: string|null }
    },

    importDefaultRules: function() {
        // Insert out-of-box rules for Australia/Zurich deprecations
    }
};
```

### ADISReportGenerator (Server-side, reporting)
```javascript
var ADISReportGenerator = Class.create();
ADISReportGenerator.prototype = {
    initialize: function() {},

    generateReport: function(scanRunId, format) {
        // format: 'html' | 'json' | 'pdf'
        // 1. Query scan_run and findings
        // 2. Build report payload
        // 3. For html: use HTML template
        // 4. For json: return structured object
        // 5. For pdf: generate via ServiceNow PDF API or external
    }
};
```

---

## 4. Security Model (ACLs)

| Table       | Read         | Write        | Delete       |
|-------------|-------------|-------------|-------------|
| x_adis_scan_run | x_adis.user | x_adis.admin | x_adis.admin |
| x_adis_finding  | x_adis.user | x_adis.user (ack) + admin (edit) | x_adis.admin |
| x_adis_deprecation_rule | x_adis.user | x_adis.admin | x_adis.admin |
| x_adis_remediation_task | x_adis.user | x_adis.admin | x_adis.admin |

Roles:
- `x_adis.admin` — Full control
- `x_adis.user` — Read findings, acknowledge, view reports

---

## 5. Scheduled Jobs

### ADIS Weekly Full Scan
```javascript
var scanner = new ADISScanner();
scanner.runFullScan(['Australia', 'Zurich']);
```
- Trigger: Every Sunday 02:00 local
- Condition: `gs.getProperty('x_adis.properties.weekly_scan_enabled') == 'true'`

### ADIS Nightly Incremental Scan
```javascript
var scanner = new ADISScanner();
var lastId = gs.getProperty('x_adis.properties.last_scan_run_id');
scanner.runIncrementalScan(lastId);
```
- Trigger: Every day 03:00 local
- Condition: `gs.getProperty('x_adis.properties.nightly_scan_enabled') == 'true'`

---

## 6. Integration Points

### Instance Scan (Optional)
- If `x_adis.properties.push_to_instance_scan == 'true'`
- After scan completion, push findings to `scan_finding` table
- Map: Critical→High, High→High, Warning→Medium, Info→Low

### Change Management (Optional)
- If `x_adis.properties.auto_create_remediation_tasks == 'true'`
- Create `change_request` for each Critical/High finding
- Populate `x_adis_remediation_task` with external task ref

---

## 7. Release Target

| Release | API Surface | Notes |
|---------|-------------|-------|
| Australia | Full support | Primary target |
| Zurich | Full support | Secondary target |
| Xanadu/Washington DC | Best effort | Deprecated APIs may differ |

---

*Architecture v1.0.0 | Author: Vladimir Kapustin | License: AGPL-3.0*
