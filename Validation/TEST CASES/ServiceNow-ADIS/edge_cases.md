# Edge Cases: ServiceNow-ADIS

**Product:** Australia Deprecation Impact Scanner  
**Version:** 1.0.0  
**Author:** Vladimir Kapustin  
**License:** AGPL-3.0-only  

---

## Overview

This document defines edge cases and boundary conditions that ServiceNow-ADIS must handle gracefully. These scenarios represent unusual but valid inputs, extreme conditions, and corner cases that could cause unexpected behavior.

**Total Edge Cases:** 15  
**Coverage Target:** All cases handled without crash or data corruption

---

## Edge Case Categories

### Category 1: Data Volume Extremes

#### EC-001: Zero Records in Target Table

**Scenario:** Target table exists but contains no records.

**Trigger:**
- New instance with no custom scripts
- Table filtered to exclude all records
- Empty test table

**Expected Behavior:**
- Scan completes successfully
- `records_scanned = 0`
- `findings_count = 0`
- Status = "completed" (not "failed")
- Log entry: "Table X has no records to scan"

**Failure Mode:**
- ❌ Exception: "No records found"
- ❌ Status = "failed"
- ❌ Scan hangs indefinitely

**Test Validation:**
```python
def test_empty_table():
    result = scanner.scanTable('x_adis_empty_table')
    assert result.status == 'completed'
    assert result.records_scanned == 0
```

---

#### EC-002: Single Record Table

**Scenario:** Target table has exactly one record.

**Trigger:**
- Minimal test instance
- Heavily filtered query

**Expected Behavior:**
- Scan processes exactly 1 record
- Finding created if pattern matches

**Failure Mode:**
- ❌ Off-by-one error skips the record
- ❌ Pagination logic fails

---

#### EC-003: Massive Table (1M+ Records)

**Scenario:** Target table contains 1+ million records.

**Trigger:**
- `sys_audit` table
- Long-running instance with full audit history
- `alm_asset` with complete lifecycle

**Expected Behavior:**
- Scan uses `setLimit()` and batching
- Memory stays under 50MB
- Completes or times out gracefully with partial results
- Log warning: "Large table, consider filtering"

**Failure Mode:**
- ❌ Out of memory error
- ❌ Timeout without partial results
- ❌ Instance becomes unresponsive

---

#### EC-004: All Records Match Pattern

**Scenario:** 100% of scanned records contain deprecated patterns.

**Trigger:**
- Legacy instance with no updates since Zurich
- Test table filled with deprecated code samples

**Expected Behavior:**
- All records flagged as findings
- Report generation handles large finding count
- Remediation task bulk creation works

**Failure Mode:**
- ❌ Report generation timeout
- ❌ Memory exhaustion from findings array

---

### Category 2: Content Edge Cases

#### EC-005: Null/Empty Script Field

**Scenario:** Record exists but script field is null or empty string.

**Trigger:**
- Placeholder records
- Incomplete data migration
- Records with conditional script fields

**Expected Behavior:**
- Skipped gracefully
- No exception thrown
- Counted in `records_scanned` but not in `findings_count`

**Failure Mode:**
- ❌ NullPointerException on `script.match()`
- ❌ Entire scan fails

---

#### EC-006: Extremely Long Script (10K+ Lines)

**Scenario:** Single script include with 10,000+ lines of code.

**Trigger:**
- Legacy monolithic script includes
- Auto-generated code
- Copied library files

**Expected Behavior:**
- Regex engine processes without timeout
- Line numbers accurate in findings
- Memory usage proportional to script size

**Failure Mode:**
- ❌ Regex timeout
- ❌ Stack overflow
- ❌ Line number calculation off

---

#### EC-007: Unicode and Special Characters

**Scenario:** Scripts contain non-ASCII characters.

**Trigger:**
- Comments in non-Latin scripts (Cyrillic, Chinese, Arabic)
- Emoji in code (unusual but valid)
- Special characters in string literals

**Expected Behavior:**
- Unicode handled correctly
- No encoding errors
- Pattern matching works on ASCII patterns within Unicode context

**Failure Mode:**
- ❌ EncodingError: "Cannot decode UTF-8"
- ❌ Pattern matching fails on mixed encoding

---

#### EC-008: Obfuscated/Minified Code

**Scenario:** Scripts are minified or obfuscated (single line, no whitespace).

**Trigger:**
- Third-party library imports
- Auto-generated client scripts
- Deliberately obfuscated code

**Expected Behavior:**
- Pattern matching still works (regex is line-agnostic)
- Line numbers may be inaccurate (documented limitation)

**Failure Mode:**
- ❌ Regex assumes newline-separated code
- ❌ Patterns not matched in single-line code

---

### Category 3: Configuration Edge Cases

#### EC-009: No Scan Configuration

**Scenario:** `x_adis_scan_config` table is empty.

**Trigger:**
- Fresh install before configuration
- Accidental deletion of all config records

**Expected Behavior:**
- Scan completes with status = "no_config"
- Warning logged: "No scan targets configured"
- User directed to configuration page

**Failure Mode:**
- ❌ Exception: "Configuration not found"
- ❌ Silent failure with no feedback

---

#### EC-010: Circular Rule References

**Scenario:** Deprecation rules reference each other.

**Trigger:**
- Manual rule creation error
- Import of malformed rule set

**Expected Behavior:**
- Rule engine detects circular reference
- Skips problematic rules
- Logs warning

**Failure Mode:**
- ❌ Infinite loop in rule evaluation
- ❌ Stack overflow

---

#### EC-011: Invalid Regex Pattern in Rule

**Scenario:** Rule contains malformed regex pattern.

**Trigger:**
- Manual rule creation with typo
- Import of corrupted rule set

**Expected Behavior:**
- Rule skipped with error logged
- Other rules continue to work
- Admin notified of invalid rule

**Failure Mode:**
- ❌ Entire scan fails on first invalid regex
- ❌ No indication of which rule is broken

---

### Category 4: Timing and Concurrency

#### EC-012: Scan During Instance Upgrade

**Scenario:** Scan executes while ServiceNow release upgrade is in progress.

**Trigger:**
- Scheduled scan overlaps with maintenance window
- Manual scan during upgrade testing

**Expected Behavior:**
- Scan detects upgrade state
- Pauses or aborts gracefully
- Resumes after upgrade completes

**Failure Mode:**
- ❌ Scan reads inconsistent data mid-upgrade
- ❌ False positives from transitional state

---

#### EC-013: Concurrent Scans

**Scenario:** Two scans run simultaneously.

**Trigger:**
- Manual scan started while scheduled scan running
- Multiple admins triggering scans
- Misconfigured scheduler

**Expected Behavior:**
- Second scan queued or rejected with message
- Lock mechanism prevents race conditions
- Log entry: "Scan already in progress"

**Failure Mode:**
- ❌ Duplicate findings created
- ❌ Data corruption in findings table
- ❌ Deadlock

---

#### EC-014: Scan During Database Maintenance

**Scenario:** Scan executes during database index rebuild or vacuum.

**Trigger:**
- Scheduled maintenance window
- Emergency database optimization

**Expected Behavior:**
- Scan experiences slower performance
- Completes successfully after maintenance
- No data loss

**Failure Mode:**
- ❌ Scan timeout
- ❌ Partial results lost

---

### Category 5: Integration Edge Cases

#### EC-015: External System Unavailable

**Scenario:** AI Agent Studio or REST endpoint unavailable during scan.

**Trigger:**
- AI Agent plugin deactivated mid-scan
- External REST endpoint down
- Network partition

**Expected Behavior:**
- Scan continues without optional integrations
- Degraded functionality documented in report
- Retry logic for transient failures

**Failure Mode:**
- ❌ Entire scan fails due to optional feature
- ❌ No fallback to non-AI mode

---

## Edge Case Testing Matrix

| Edge Case | Priority | Test Type | Automated |
|-----------|----------|-----------|-----------|
| EC-001 | P1 | Unit | ✅ |
| EC-002 | P2 | Unit | ✅ |
| EC-003 | P1 | Performance | ✅ |
| EC-004 | P2 | Integration | ✅ |
| EC-005 | P0 | Unit | ✅ |
| EC-006 | P2 | Performance | ✅ |
| EC-007 | P1 | Unit | ✅ |
| EC-008 | P3 | Known Limitation | ❌ |
| EC-009 | P0 | Unit | ✅ |
| EC-010 | P1 | Integration | ✅ |
| EC-011 | P1 | Unit | ✅ |
| EC-012 | P2 | Manual | ❌ |
| EC-013 | P1 | Integration | ✅ |
| EC-014 | P3 | Manual | ❌ |
| EC-015 | P1 | Integration | ✅ |

---

## Mitigation Strategies

### Defensive Programming Patterns

```javascript
// Null/empty check pattern
if (!script || script.trim() === '') {
    gs.debug('Empty script, skipping');
    continue;
}

// Try-catch for regex operations
try {
    var matches = script.match(regex);
} catch (e) {
    gs.error('Regex failed on record ' + sysId + ': ' + e.message);
    continue;
}

// Memory-safe iteration
var gr = new GlideRecord('sys_script_include');
gr.setLimit(10000);
gr.query();
while (gr.next()) {
    // Process record
    if (memoryUsage > THRESHOLD) {
        gs.warn('Memory threshold reached, pausing');
        gs.sleep(1000);
    }
}
```

### Timeout Handling

```javascript
var startTime = new Date().getTime();
while (gr.next()) {
    var elapsed = (new Date().getTime() - startTime) / 1000;
    if (elapsed > MAX_SCAN_SECONDS) {
        gs.warn('Scan timeout, partial results saved');
        break;
    }
}
```

---

## Monitoring and Alerting

| Condition | Threshold | Alert Type |
|-----------|-----------|------------|
| Scan duration | > 600 seconds | Warning |
| Memory usage | > 100MB | Critical |
| Finding count | > 1000 | Info |
| Error rate | > 10% of records | Warning |
| Empty results | 0 findings on large table | Info |

---

## Documentation Updates

When new edge cases are discovered:
1. Add to this document with unique ID
2. Create test case in test_suite_SOP.md
3. Update mitigation patterns
4. Include in next release notes

---

## Approval

**QA Lead:** ___________________  
**Date:** ___________________  
**Next Review:** Quarterly or after production incidents
