# Test Suite SOP: ServiceNow-ADIS

**Product:** Australia Deprecation Impact Scanner  
**Version:** 1.0.0  
**Author:** Vladimir Kapustin  
**License:** AGPL-3.0-only  

---

## Overview

This Standard Operating Procedure defines the complete test suite for ServiceNow-ADIS. It covers 15 test scenarios across unit, integration, and performance testing dimensions. All tests must pass before deployment.

**Minimum Pass Threshold:** 13/15 tests (87%)

---

## Test Environment Requirements

| Requirement | Specification |
|-------------|---------------|
| ServiceNow Instance | Zurich or later (PDI acceptable) |
| Python Version | 3.10+ |
| Required Packages | pytest, requests, pytest-cov |
| Test Data | Sample scripts with known deprecated patterns |

---

## Test Scenarios

### Test 1: Plugin Activation Check

**ID:** T01  
**Priority:** P0  
**Type:** Unit Test  

**Objective:** Verify required ServiceNow plugins are active before scanning.

**Preconditions:**
- Test instance has `com.snc.app_engine` plugin installed

**Steps:**
1. Initialize scanner engine
2. Call `checkPluginDependencies()`
3. Verify return value

**Expected Result:**
- Returns `true` for Zurich+ instances
- Returns `false` with error message for pre-Zurich

**Post-conditions:** None

**Automation:**
```python
def test_plugin_active():
    scanner = AustraliaDeprecationImpactScanner()
    result = scanner.checkPluginDependencies()
    assert result == True, "Required plugins not active"
```

---

### Test 2: Role Assignment Verification

**ID:** T02  
**Priority:** P0  
**Type:** Unit Test  

**Objective:** Verify user has required roles to execute scans.

**Preconditions:**
- Test user has `x_adis_admin` role

**Steps:**
1. Initialize scanner with test user context
2. Call `checkRoleAccess()`
3. Verify access granted

**Expected Result:**
- Returns `true` for users with x_adis_admin
- Returns `false` for users without role

**Post-conditions:** None

**Automation:**
```python
def test_role_assigned():
    scanner = AustraliaDeprecationImpactScanner()
    result = scanner.checkRoleAccess('x_adis_admin')
    assert result == True, "Role access check failed"
```

---

### Test 3: Configuration Loading

**ID:** T03  
**Priority:** P0  
**Type:** Unit Test  

**Objective:** Verify scan configuration loads from `x_adis_scan_config`.

**Preconditions:**
- `x_adis_scan_config` has at least one active record

**Steps:**
1. Initialize rule engine
2. Call `loadScanConfig()`
3. Verify configuration loaded

**Expected Result:**
- Returns list of target tables
- Each config has `table_name`, `field_list`, `active=True`

**Post-conditions:** None

**Automation:**
```python
def test_config_load():
    engine = AustraliaDeprecationImpactScannerRuleEngine()
    config = engine.loadScanConfig()
    assert len(config) > 0, "No scan config found"
    assert 'table_name' in config[0], "Missing table_name"
```

---

### Test 4: REST API Availability

**ID:** T04  
**Priority:** P0  
**Type:** Integration Test  

**Objective:** Verify REST endpoints are accessible.

**Preconditions:**
- Application is active
- REST endpoint `x_adis/api/scan` is published

**Steps:**
1. Send GET request to `/api/now/table/x_adis_scan_config`
2. Verify HTTP 200 response
3. Validate JSON structure

**Expected Result:**
- HTTP 200 OK
- Response contains `result` array

**Post-conditions:** None

**Automation:**
```python
def test_rest_api():
    import requests
    response = requests.get(
        f"{INSTANCE}/api/now/table/x_adis_scan_config",
        auth=(USERNAME, PASSWORD)
    )
    assert response.status_code == 200
    assert 'result' in response.json()
```

---

### Test 5: Report Generation

**ID:** T05  
**Priority:** P1  
**Type:** Integration Test  

**Objective:** Verify HTML, JSON, and PDF reports generate correctly.

**Preconditions:**
- At least one scan run exists with findings

**Steps:**
1. Initialize report generator
2. Call `generateHTML(scanRunId)`
3. Call `generateJSON(scanRunId)`
4. Call `generatePDF(scanRunId)` (if plugin available)

**Expected Result:**
- HTML: Returns valid HTML string with findings table
- JSON: Returns valid JSON with findings array
- PDF: Returns base64-encoded PDF or graceful fallback

**Post-conditions:** None

**Automation:**
```python
def test_report_generate():
    reporter = AustraliaDeprecationImpactScannerReportGenerator()
    html = reporter.generateHTML('SCAN001')
    assert '<table>' in html, "HTML report missing table"
    
    json_data = reporter.generateJSON('SCAN001')
    assert 'findings' in json_data, "JSON missing findings"
```

---

### Test 6: Empty Data Handling

**ID:** T06  
**Priority:** P1  
**Type:** Edge Case Test  

**Objective:** Verify scanner handles empty tables gracefully.

**Preconditions:**
- Test table with zero records

**Steps:**
1. Configure scanner to target empty table
2. Execute scan
3. Verify no errors

**Expected Result:**
- Scan completes without exception
- Returns zero findings (not error)
- Logs informational message

**Post-conditions:** None

**Automation:**
```python
def test_empty_data():
    scanner = AustraliaDeprecationImpactScanner()
    result = scanner.scanTable('x_adis_empty_test_table')
    assert result.records_scanned == 0
    assert result.findings == []
    assert result.status == 'completed'
```

---

### Test 7: Error Recovery

**ID:** T07  
**Priority:** P1  
**Type:** Resilience Test  

**Objective:** Verify scanner recovers from API failures.

**Preconditions:**
- Mock REST endpoint to return 500 error

**Steps:**
1. Configure mock to fail on specific table
2. Execute scan
3. Verify error handling

**Expected Result:**
- Scanner logs error but continues
- Other tables still scanned
- Final report includes partial results

**Post-conditions:** None

**Automation:**
```python
def test_error_recovery():
    with patch('requests.get', side_effect=Exception("API Error")):
        scanner = AustraliaDeprecationImpactScanner()
        result = scanner.scan()
        assert result.status == 'partial'
        assert 'errors' in result
```

---

### Test 8: Performance Under Load

**ID:** T08  
**Priority:** P2  
**Type:** Performance Test  

**Objective:** Verify scanner handles 50 concurrent requests.

**Preconditions:**
- Test instance with sample data

**Steps:**
1. Spawn 50 parallel scan requests
2. Monitor response times
3. Verify no timeouts

**Expected Result:**
- All requests complete within 30 seconds
- No memory leaks
- Database connections released

**Post-conditions:** None

**Automation:**
```python
def test_performance_50concurrent():
    from concurrent.futures import ThreadPoolExecutor
    
    def run_scan():
        scanner = AustraliaDeprecationImpactScanner()
        return scanner.scanIncremental(gs.daysAgo(1))
    
    with ThreadPoolExecutor(max_workers=50) as executor:
        results = list(executor.map(lambda _: run_scan(), range(50)))
    
    assert all(r.status == 'completed' for r in results)
```

---

### Test 9: Authentication Failure

**ID:** T09  
**Priority:** P1  
**Type:** Security Test  

**Objective:** Verify unauthorized access is blocked.

**Preconditions:**
- Test user without x_adis role

**Steps:**
1. Authenticate as unauthorized user
2. Attempt to execute scan
3. Verify access denied

**Expected Result:**
- Returns 403 Forbidden
- Error message: "Insufficient privileges"

**Post-conditions:** None

**Automation:**
```python
def test_auth_failure():
    response = requests.get(
        f"{INSTANCE}/api/now/table/x_adis_scan_config",
        auth=('unauthorized_user', 'wrong_password')
    )
    assert response.status_code == 403
```

---

### Test 10: Delta Scan Accuracy

**ID:** T10  
**Priority:** P1  
**Type:** Integration Test  

**Objective:** Verify incremental scan only processes changed records.

**Preconditions:**
- Previous scan run exists
- Some records modified since last scan

**Steps:**
1. Record last scan timestamp
2. Modify 5 records
3. Run incremental scan
4. Verify only 5 records processed

**Expected Result:**
- `records_scanned` equals modified count
- Execution time < full scan time

**Post-conditions:** None

**Automation:**
```python
def test_delta_scan():
    last_run = get_last_scan_timestamp()
    modify_records(5)
    
    scanner = AustraliaDeprecationImpactScanner()
    result = scanner.scanIncremental(last_run)
    
    assert result.records_scanned == 5
```

---

### Test 11: Boundary Maximum Records

**ID:** T11  
**Priority:** P2  
**Type:** Boundary Test  

**Objective:** Verify scanner handles maximum record limit.

**Preconditions:**
- Test table with 50,000 records

**Steps:**
1. Configure scanner for large table
2. Execute scan
3. Verify completion

**Expected Result:**
- Scan completes without timeout
- Memory usage < 50MB
- All records processed

**Post-conditions:** None

**Automation:**
```python
def test_boundary_maxrecords():
    scanner = AustraliaDeprecationImpactScanner()
    result = scanner.scanTable('large_test_table')
    assert result.records_scanned == 50000
    assert result.memory_mb < 50
```

---

### Test 12: Timeout Handling

**ID:** T12  
**Priority:** P2  
**Type:** Resilience Test  

**Objective:** Verify scanner handles timeouts gracefully.

**Preconditions:**
- Mock slow response (10+ seconds)

**Steps:**
1. Configure mock to delay 10 seconds
2. Set scanner timeout to 5 seconds
3. Execute scan

**Expected Result:**
- Timeout exception caught
- Error logged
- Scanner continues with next table

**Post-conditions:** None

**Automation:**
```python
def test_timeout_handling():
    import time
    def slow_response(*args):
        time.sleep(10)
    
    with patch('requests.get', side_effect=slow_response):
        scanner = AustraliaDeprecationImpactScanner(timeout=5)
        result = scanner.scan()
        assert 'timeout' in result.errors
```

---

### Test 13: False Positive Exclusion

**ID:** T13  
**Priority:** P2  
**Type:** Accuracy Test  

**Objective:** Verify comments and string literals are excluded.

**Preconditions:**
- Test script with deprecated API in comment

**Steps:**
1. Create test script: `// Deprecated: oldMethod()`
2. Run rule engine
3. Verify no finding

**Expected Result:**
- Zero findings for commented code
- Finding only for actual usage

**Post-conditions:** None

**Automation:**
```python
def test_false_positive_exclusion():
    test_script = """
    // This uses deprecated oldMethod()
    var x = "oldMethod()";  // string literal
    actualCode();           // valid code
    """
    engine = AustraliaDeprecationImpactScannerRuleEngine()
    findings = engine.evaluate(test_script)
    assert len(findings) == 0, "False positive detected"
```

---

### Test 14: Cross-Scope Query

**ID:** T14  
**Priority:** P2  
**Type:** Integration Test  

**Objective:** Verify cross-scope access works with proper grants.

**Preconditions:**
- Cross-scope grant configured

**Steps:**
1. Query table in external scope
2. Verify results returned
3. Verify no security exception

**Expected Result:**
- Records returned successfully
- No "Access denied" error

**Post-conditions:** None

**Automation:**
```python
def test_cross_scope_query():
    scanner = AustraliaDeprecationImpactScanner()
    result = scanner.scanTable('sn_devops_ci')
    assert result.status == 'completed'
```

---

### Test 15: Report Attachment Storage

**ID:** T15  
**Priority:** P3  
**Type:** Storage Test  

**Objective:** Verify reports are stored as attachments correctly.

**Preconditions:**
- Scan run completed

**Steps:**
1. Generate report
2. Verify attachment on scan run record
3. Verify attachment can be downloaded

**Expected Result:**
- Attachment exists on `x_adis_scan_run`
- File size > 0
- MIME type correct

**Post-conditions:** None

**Automation:**
```python
def test_report_attachment():
    reporter = AustraliaDeprecationImpactScannerReportGenerator()
    reporter.generateHTML('SCAN001')
    
    attachment = get_attachment('SCAN001')
    assert attachment is not None
    assert attachment.size > 0
```

---

## Test Execution Schedule

| Phase | Tests | Frequency | Owner |
|-------|-------|-----------|-------|
| Unit | T01-T03, T06, T13 | Every commit | Developer |
| Integration | T04-T05, T09-T10, T14 | Daily | QA |
| Performance | T08, T11-T12 | Weekly | Platform |
| Security | T09 | Pre-deployment | Security |

---

## Defect Classification

| Severity | Description | Response Time |
|----------|-------------|---------------|
| Critical | Test blocks deployment | Immediate |
| High | Core functionality broken | 24 hours |
| Medium | Edge case failure | 1 week |
| Low | Cosmetic/documentation | Next sprint |

---

## Test Results Template

```markdown
## Test Run: [DATE]

| Test ID | Status | Duration | Notes |
|---------|--------|----------|-------|
| T01 | PASS | 0.5s | - |
| T02 | FAIL | 0.3s | Role check timeout |

**Summary:** 14/15 PASS (93%)
**Blocked Tests:** T02
**Action Items:** Investigate role check timeout
```

---

## Approval

**Test Lead:** ___________________  
**Date:** ___________________  
**Next Review:** Quarterly or after major changes
