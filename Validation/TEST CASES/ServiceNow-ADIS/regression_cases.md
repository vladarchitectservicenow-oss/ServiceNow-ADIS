# Regression Test Cases: ServiceNow-ADIS

**Product:** Australia Deprecation Impact Scanner  
**Version:** 1.0.0  
**Author:** Vladimir Kapustin  
**License:** AGPL-3.0-only  

---

## Overview

This document defines regression test cases to ensure existing functionality remains intact after code changes. These tests should be run before every release and after any significant code modification.

**Total Test Cases:** 12  
**Priority Distribution:** P0: 4, P1: 5, P2: 3

---

## Regression Test Cases

### REG-001: Full Scan Execution

**ID:** REG-001  
**Priority:** P0  
**Area:** Core Functionality  

**Description:**  
Verify that a full instance scan completes successfully and populates findings.

**Preconditions:**
- Application is active
- `x_adis_scan_config` has at least 3 target tables configured
- Test instance has script records

**Steps:**
1. Navigate to `x_adis_scan_run.list`
2. Click "New"
3. Select "Full Scan" type
4. Click "Submit"
5. Wait for status to change from "Running" to "Completed"
6. Navigate to `x_adis_finding.list`
7. Filter by `scan_run = [new scan run number]`

**Expected Results:**
- Scan status changes to "Completed" within 5 minutes
- Findings table populated with at least 1 record
- `records_scanned` > 0
- `findings_count` >= 0
- No errors in `x_adis_log`

**Pass Criteria:** All expected results met.

**Automation Script:**
```python
def test_full_scan_execution():
    scanner = AustraliaDeprecationImpactScanner()
    result = scanner.scan()
    assert result.status == 'completed'
    assert result.records_scanned > 0
    assert result.duration_seconds < 300
```

---

### REG-002: Incremental Scan Filters Correctly

**ID:** REG-002  
**Priority:** P0  
**Area:** Core Functionality  

**Description:**  
Verify incremental scan only processes records modified since last run.

**Preconditions:**
- Previous scan run exists with timestamp
- At least 5 records modified since last scan
- At least 100 records unchanged

**Steps:**
1. Get last scan timestamp: `last_run = get_last_scan_time()`
2. Modify 5 script records
3. Run incremental scan: `scanner.scanIncremental(last_run)`
4. Check `records_scanned` count

**Expected Results:**
- `records_scanned` equals number of modified records (±2 for edge cases)
- Unchanged records not re-scanned
- Execution time proportional to modified count, not total records

**Pass Criteria:** Records scanned within 10% of modified count.

---

### REG-003: Rule Engine Matches Deprecated Patterns

**ID:** REG-003  
**Priority:** P0  
**Area:** Rule Engine  

**Description:**  
Verify rule engine correctly identifies known deprecated API patterns.

**Preconditions:**
- Rule catalog loaded with Zurich→Australia rules
- Test scripts contain known deprecated patterns

**Test Patterns:**
| Deprecated API | Replacement | Rule ID |
|----------------|-------------|---------|
| `GlideFilter.check()` | `GlideRecord.addQuery()` | DEP-001 |
| `gs.getDateTime()` | `new GlideDateTime()` | DEP-002 |
| `current.getDisplayValueInternal()` | `current.getDisplayValue()` | DEP-003 |

**Steps:**
1. Create test script with deprecated pattern
2. Run rule engine evaluation
3. Verify finding created

**Expected Results:**
- Finding created for each deprecated pattern
- Correct rule ID associated
- Severity matches rule definition

**Pass Criteria:** 100% of known patterns detected.

---

### REG-004: Report Generation All Formats

**ID:** REG-004  
**Priority:** P0  
**Area:** Reporting  

**Description:**  
Verify all report formats generate without errors.

**Preconditions:**
- Scan run with findings exists

**Steps:**
1. Call `generateHTML(scanRunId)`
2. Call `generateJSON(scanRunId)`
3. Call `generatePDF(scanRunId)` (if plugin available)
4. Validate each output

**Expected Results:**
- HTML: Valid HTML with findings table, >500 characters
- JSON: Valid JSON, parseable, contains `findings` array
- PDF: Base64 string or graceful "PDF plugin unavailable" message

**Pass Criteria:** All three formats generated successfully.

---

### REG-005: Cross-Scope Access Warning

**ID:** REG-005  
**Priority:** P1  
**Area:** Security  

**Description:**  
Verify scanner warns when cross-scope access is missing.

**Preconditions:**
- No cross-scope grant for `sn_devops_*` scope

**Steps:**
1. Configure `sn_devops_ci` as scan target
2. Run scan
3. Check `x_adis_log` for warnings

**Expected Results:**
- Scan completes (does not crash)
- Warning logged: "No access to scope: sn_devops"
- `records_scanned` = 0 for that table

**Pass Criteria:** Warning logged, scan continues.

---

### REG-006: False Positive Exclusion

**ID:** REG-006  
**Priority:** P1  
**Area:** Accuracy  

**Description:**  
Verify deprecated APIs in comments and strings are not flagged.

**Preconditions:**
- Test script with deprecated API in comment and string literal

**Test Script:**
```javascript
// Using deprecated oldMethod() - should NOT be flagged
var description = "This uses oldMethod()";  // should NOT be flagged
oldMethod();  // SHOULD be flagged
```

**Steps:**
1. Create test script with above content
2. Run scanner
3. Check findings

**Expected Results:**
- Exactly 1 finding (for actual usage on line 3)
- No findings for comment (line 1) or string (line 2)

**Pass Criteria:** Only actual usage flagged.

---

### REG-007: Remediation Task Creation

**ID:** REG-007  
**Priority:** P1  
**Area:** Integration  

**Description:**  
Verify remediation tasks are created correctly.

**Preconditions:**
- Finding exists with severity P0 or P1
- Change Management plugin active

**Steps:**
1. Select finding in list
2. Click "Create Remediation Task"
3. Choose "Change Request"
4. Submit
5. Navigate to created change request

**Expected Results:**
- Change request created
- Short description includes finding reference
- Description includes deprecated API and replacement hint
- Finding record linked to change request

**Pass Criteria:** Change request created with correct linkage.

---

### REG-008: Scheduled Job Execution

**ID:** REG-008  
**Priority:** P1  
**Area:** Automation  

**Description:**  
Verify scheduled scan jobs execute automatically.

**Preconditions:**
- Scheduled job configured for "Weekly Full Scan"
- Job scheduled time has passed

**Steps:**
1. Navigate to `sys_auto_script.list`
2. Find "ADIS Weekly Full Scan"
3. Check "Last run" timestamp
4. Check for new `x_adis_scan_run` record

**Expected Results:**
- "Last run" within expected window
- New scan run record created
- Status = "Completed"

**Pass Criteria:** Job executed automatically.

---

### REG-009: Email Notification on Completion

**ID:** REG-009  
**Priority:** P1  
**Area:** Notifications  

**Description:**  
Verify email sent when scan completes.

**Preconditions:**
- Email notification configured
- Valid recipient email address

**Steps:**
1. Run scan
2. Wait for completion
3. Check recipient inbox
4. Check `sysevent_email_action_log`

**Expected Results:**
- Email received by recipient
- Subject includes scan run number
- Body includes summary statistics

**Pass Criteria:** Email delivered successfully.

---

### REG-010: Performance Under Load

**ID:** REG-010  
**Priority:** P2  
**Area:** Performance  

**Description:**  
Verify scanner performance with large data volumes.

**Preconditions:**
- Test instance with 10,000+ script records

**Steps:**
1. Run full scan
2. Record duration
3. Check memory usage
4. Verify instance responsiveness during scan

**Expected Results:**
- Duration < 300 seconds
- Memory < 50MB
- No user-reported slowness

**Pass Criteria:** Performance within thresholds.

---

### REG-011: AI Agent Studio Fallback

**ID:** REG-011  
**Priority:** P2  
**Area:** Feature Availability  

**Description:**  
Verify graceful degradation when AI Agent Studio unavailable.

**Preconditions:**
- AI Agent Studio plugin NOT active

**Steps:**
1. Attempt to generate AI remediation hint
2. Verify behavior

**Expected Results:**
- No error thrown
- Static replacement hint used instead
- UI shows "AI features unavailable" message

**Pass Criteria:** Graceful degradation, no crash.

---

### REG-012: Attachment Cleanup

**ID:** REG-012  
**Priority:** P2  
**Area:** Storage  

**Description:**  
Verify old report attachments are cleaned up per retention policy.

**Preconditions:**
- 15+ scan runs with attachments
- Retention policy set to 10 reports

**Steps:**
1. Run cleanup job
2. Count attachments on scan runs
3. Verify oldest attachments removed

**Expected Results:**
- Only 10 most recent reports retained
- Older attachments deleted
- No errors in log

**Pass Criteria:** Retention policy enforced.

---

## Regression Test Schedule

| Release Type | Required Tests | Frequency |
|--------------|----------------|-----------|
| Patch (x.x.1) | REG-001, REG-003, REG-004 | Every release |
| Minor (x.1.0) | All P0 + P1 tests | Every release |
| Major (1.0.0) | All tests | Every release |

---

## Test Environment

| Environment | Purpose | Data Volume |
|-------------|---------|-------------|
| PDI | Development testing | 100 records |
| Sub-Prod | Regression testing | 10,000 records |
| Production | Smoke testing only | Full volume |

---

## Defect Tracking

All regression failures must be logged with:
- Test ID
- Expected vs. actual result
- Environment details
- Steps to reproduce
- Severity classification

**Tracking System:** ServiceNow Incident Management  
**Category:** `Application > ServiceNow-ADIS > Regression Failure`

---

## Approval

**QA Lead:** ___________________  
**Date:** ___________________  
**Next Review:** Before each minor/major release
