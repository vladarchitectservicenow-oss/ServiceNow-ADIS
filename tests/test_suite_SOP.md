# Copyright (C) 2026 Vladimir Kapustin
# This file is part of ServiceNow ADIS (Australia Deprecation Impact Scanner).
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# ADIS Test Suite SOP — ServiceNow Scoped App
# Date: 2026-05-16
# Product: ADIS (Australia Deprecation Impact Scanner)
# Scope prefix: x_adis
# Release target: ServiceNow Vancouver / Washington DC / Xanadu / Yokohama / Zurich / Australia
# License: AGPL-3.0
# Language: EN (all test cases, code, assertions)

---

## 0. SOP Meta

| Attribute             | Value                                           |
|-----------------------|-------------------------------------------------|
| SOP Owner            | Vladimir Kapustin                               |
| Review Cycle         | Every feature merge or release candidate         |
| CI/CD Gate           | 100% PASS required before push to vladarchitectservicenow-oss |
| Environments         | PDI dev362840.service-now.com (test box only)     |
| Test Data Isolation  | All test records prefixed `x_adis_test_*`        |
| Rollback             | `sys_app` scoped uninstall per test run          |

---

## 1. Test Infrastructure

### 1.1 Test Harness (Python + `unittest`)
- Base class: `ADISTestBase` in `tests/ADISTestBase.py`
- PDI credentials from env: `SN_INSTANCE`, `SN_USER`, `SN_PASS`
- REST Table API endpoint: `https://{instance}/api/now/table/{table}`
- All POST / PUT / DELETE wrapped in `self._create()`, `self._update()`, `self._delete()`
- `@classmethod setUpClass` creates scoped app; `tearDownClass` uninstalls it via `sys_app` REST

### 1.2 Test Data Hygiene
- Every test record field `short_description` must contain `ADIS_TEST_<SCENARIO_ID>`
- Scheduled job `sys_trigger` test records use `name LIKE 'ADIS_TEST_%'` filter for cleanup
- Before each scenario: `DELETE FROM <table> WHERE short_description LIKE 'ADIS_TEST_%'`

---

## 2. Scenario Catalog (10+ Scenarios)

---

### Scenario 1: SCAN-001 — Baseline Full Scan (Happy Path)
**Objective:** Prove that ADIS can execute a full deprecation scan across all script tables and produce findings.

**Preconditions:**
- Scoped app ADIS installed on PDI
- At least 1 `sys_script_include` exists that references `GlideElementDynamicAttribute`
- At least 1 `sys_script` (Business Rule) references `eventQueue` instead of `eventQueueScheduled`
- At least 1 `sys_script_client` references a legacy Document Intelligence table

**Steps:**
1. POST to `x_adis_scan_run` with `scan_type=full`, `scope=global`, `target_releases=["Australia","Zurich"]`
2. Wait for `state` to transition from `Queued` → `Running` → `Completed`
3. Query `x_adis_finding` where `scan_run_ref` = created scan run
4. Query `x_adis_scan_run` fields: `findings_count`, `risk_score`, `execution_time_ms`

**Expected Results:**
- `state` == `Completed` within `<= 120000 ms`
- `findings_count` >= 3
- At least 1 finding has `severity=Critical` (GlideElementDynamicAttribute)
- At least 1 finding has `severity=Warning` (eventQueue)
- `risk_score` is numeric and `0 < risk_score <= 100`
- `execution_time_ms` is numeric and `> 0`

**Assertions:**
```python
assert scan_run['state'] == 'Completed'
assert scan_run['findings_count'] >= 3
assert any(f['severity'] == 'Critical' for f in findings)
assert any(f['severity'] == 'Warning' for f in findings)
assert 0 < scan_run['risk_score'] <= 100
assert scan_run['execution_time_ms'] > 0
```

---

### Scenario 2: SCAN-002 — Incremental Delta Scan
**Objective:** Prove that ADIS detects only new/changed deprecated usage since last scan.

**Preconditions:**
- SCAN-001 has completed
- No changes made to script tables since SCAN-001

**Steps:**
1. POST to `x_adis_scan_run` with `scan_type=incremental`, `last_scan_run_ref` = SCAN-001 record
2. Wait for `state` == `Completed`
3. Query `x_adis_finding` for this scan

**Expected Results:**
- `state` == `Completed`
- `findings_count` == 0 (no new deprecated usage)
- `execution_time_ms` < `SCAN-001.execution_time_ms` (faster)

**Post-conditions:**
- Create a new `sys_script_include` with `GlideElementDynamicAttribute` usage
- Re-run incremental scan
- Assert `findings_count` == 1 and finding references the new script include

---

### Scenario 3: RULE-001 — Deprecation Rule CRUD
**Objective:** Verify that deprecation rules can be created, read, updated, deleted, and enforced.

**Preconditions:**
- ADIS installed
- User has `x_adis.admin` role

**Steps:**
1. POST to `x_adis_deprecation_rule`:
   ```json
   {
     "name": "ADIS_TEST_CustomRule",
     "regex_pattern": "eventQueue\\s*\\(",
     "replacement_suggestion": "eventQueueScheduled",
     "target_release": "Australia",
     "severity": "Warning",
     "applies_to": "sys_script,sys_script_include,sys_script_client,sys_ws_operation",
     "active": true
   }
   ```
2. GET record by `sys_id`
3. PATCH `severity` → `Critical`
4. Run a scan targeting this rule
5. DELETE the rule

**Expected Results:**
- POST returns `201` with `sys_id`
- GET returns matching `regex_pattern` and `replacement_suggestion`
- PATCH returns `200` and `severity` == `Critical`
- Scan produces at least 1 finding with `rule_ref` == custom rule
- DELETE returns `204`; subsequent GET returns `404`

---

### Scenario 4: REM-001 — Auto-Remediation Task Creation
**Objective:** Verify that findings auto-create remediation tasks in change management.

**Preconditions:**
- SCAN-001 has critical findings
- Change Management plugin active on PDI
- `x_adis_properties.auto_create_remediation_tasks` == `true`

**Steps:**
1. Ensure `x_adis_properties.auto_create_remediation_tasks` is `true`
2. Execute SCAN-001 (or use existing findings)
3. Query `change_request` (or `task` if CM unavailable) for:
   - `short_description CONTAINS "ADIS Remediation"`
   - `description CONTAINS finding ID`

**Expected Results:**
- Number of remediation tasks == number of critical+high findings
- Each task `state` == `New`
- Each task `assignment_group` == value from `x_adis_properties.default_assignment_group`
- Each task has `x_adis_finding_ref` populated

---

### Scenario 5: RPT-001 — Impact Report Generation (HTML / JSON / PDF)
**Objective:** Prove report generation produces valid, structured output.

**Preconditions:**
- SCAN-001 completed with findings

**Steps:**
1. Call Script Include function:
   ```javascript
   var report = new ADISReportGenerator();
   var html = report.generateReport(scanRunSysId, 'html');
   var json = report.generateReport(scanRunSysId, 'json');
   var pdf  = report.generateReport(scanRunSysId, 'pdf');
   ```
2. Write outputs to `tests/execution_history/`
3. Validate:
   - HTML contains `<!DOCTYPE html>` and `<table>`
   - JSON is valid JSON with root keys: `scan_run`, `findings`, `summary`
   - PDF is non-empty binary (starts with `%PDF-1.`)

**Expected Results:**
- HTML length > 5000 chars
- JSON `findings` array length == `findings_count`
- PDF file size > 1000 bytes

---

### Scenario 6: UI-001 — GlideElementDynamicAttribute Zero-Tolerance Detection
**Objective:** Prove that the most destructive deprecation (`GlideElementDynamicAttribute` removal) is detected with 100% precision.

**Preconditions:**
- Create test script include `x_adis_test_geda_bad`:
  ```javascript
  var g = new GlideElementDynamicAttribute();
  ```
- Create test script include `x_adis_test_geda_ok`:
  ```javascript
  var g = new GlideElement();  // replacement pattern
  ```

**Steps:**
1. Run full scan
2. Filter findings for `deprecated_item` == `GlideElementDynamicAttribute`

**Expected Results:**
- Finding exists for `x_adis_test_geda_bad` with `severity=Critical`
- NO finding exists for `x_adis_test_geda_ok`

---

### Scenario 7: PERF-001 — Scan Performance Under Load
**Objective:** Prove ADIS completes within SLA even with 5000+ script records.

**Preconditions:**
- Generate 5000 dummy `sys_script_include` records with random JS (no deprecated APIs)
- Generate 100 dummy records referencing deprecated items

**Steps:**
1. Execute full scan
2. Record `execution_time_ms`
3. Assert `findings_count` == 100 (only injected deprecated records)

**Expected Results:**
- `execution_time_ms` <= 600000 (10 minutes) for 5100 records
- Memory stays within PDI limits (no OOM errors)
- `findings_count` == 100

**Cleanup:** Delete all dummy script includes prefixed `adis_perf_test_`

---

### Scene 8: SEC-001 — Role-Based Access Control
**Objective:** Verify that only `x_adis.admin` can create rules; `x_adis.user` can only view findings.

**Preconditions:**
- User A: `x_adis.admin`
- User B: `x_adis.user` (no admin)
- User C: no ADIS roles

**Steps:**
1. User A POST to `x_adis_deprecation_rule` → expect `201`
2. User B POST to `x_adis_deprecation_rule` → expect `403`
3. User B GET `x_adis_finding` → expect `200`
4. User C GET `x_adis_finding` → expect `403`

**Expected Results:**
- ACLs enforce role separation as above

---

### Scenario 9: INST-001 — Instance Scan Integration
**Objective:** Prove ADIS pushes findings to the built-in Instance Scan framework.

**Preconditions:**
- Instance Scan plugin active on PDI
- ADIS property `push_to_instance_scan` == `true`

**Steps:**
1. Run full scan with `push_to_instance_scan=true`
2. Query `scan_finding` table for `source` == `ADIS`
3. Compare `scan_finding` count with `x_adis_finding` count

**Expected Results:**
- `scan_finding` count == `x_adis_finding` count
- Each `scan_finding` has:
  - `category` == `Deprecation`
  - `severity` mapped from ADIS severity (Critical→High, Warning→Medium)
  - `description` contains deprecated item name and file reference

---

### Scenario 10: SCH-001 — Scheduled Job Execution
**Objective:** Prove weekly full scan and nightly incremental scan run without error.

**Preconditions:**
- Scheduled jobs installed:
  - `ADIS Weekly Full Scan`
  - `ADIS Nightly Incremental Scan`

**Steps:**
1. Trigger `ADIS Weekly Full Scan` manually via `sys_trigger.execute_now`
2. Wait for completion
3. Verify `x_adis_scan_run` record created with `scan_type=full`
4. Trigger `ADIS Nightly Incremental Scan` manually
5. Verify `x_adis_scan_run` record created with `scan_type=incremental`

**Expected Results:**
- Both scheduled jobs complete with `state=Completed`
- No errors in `syslog` with `source=ADIS` and `level=Error`
- Nightly incremental scan `execution_time_ms` < weekly full scan

---

### Scenario 11: EDGE-001 — Malformed / Empty Script Handling
**Objective:** Prove ADIS does not crash on malformed scripts or null fields.

**Preconditions:**
- Create `sys_script_include` with empty `script` field (null or '')
- Create `sys_script_include` with non-JS content (e.g., binary data as string)

**Steps:**
1. Run full scan
2. Check `syslog` for exceptions from ADIS Script Include
3. Verify scan completes to `Completed` state regardless

**Expected Results:**
- `state` == `Completed`
- No `TypeError`, `NullPointer`, or `SyntaxError` in syslog from ADIS
- Malformed records skipped with `skipped_count` incremented

---

## 3. Regression Criteria

Any of the following MUST fail the entire suite:

| Condition                                    | Severity |
|----------------------------------------------|----------|
| SCAN-001 (baseline) fails                    | Critical |
| UI-001 (GlideElementDynamicAttribute) misses | Critical |
| SEC-001 (ACLs) bypassed                      | Critical |
| PERF-001 exceeds 10 minutes                  | High     |
| RPT-001 produces invalid HTML/JSON/PDF       | High     |
| REM-001 tasks not created                    | High     |
| SCH-001 scheduled jobs fail                  | High     |

---

## 4. Execution History Logging

After every test run, append a JSON entry to:
```
tests/execution_history/YYYY-MM-DD_HH-MM-SS_run.json
```

```json
{
  "timestamp": "2026-05-16T21:00:00Z",
  "product": "ADIS",
  "version": "1.0.0",
  "scenarios_run": ["SCAN-001", "SCAN-002", "RULE-001", "REM-001", "RPT-001", "UI-001", "PERF-001", "SEC-001", "INST-001", "SCH-001", "EDGE-001"],
  "passed": 11,
  "failed": 0,
  "skipped": 0,
  "duration_ms": 452000,
  "environment": "dev362840.service-now.com",
  "commit_sha": "(local)"
}
```

---

## 5. Exit Criteria for Stage "Super Tester"

- [ ] All 11 scenarios PASS
- [ ] `tests/execution_history/` contains at least 1 JSON entry
- [ ] No `Error` level syslog entries from ADIS during test run
- [ ] `x_adis_test_*` records fully cleaned

**Stage gate:** Push to `vladarchitectservicenow-oss` is ONLY permitted when ALL checkboxes above are TRUE.

---

*SOP version: 1.0.0 | Author: Vladimir Kapustin | License: AGPL-3.0*
