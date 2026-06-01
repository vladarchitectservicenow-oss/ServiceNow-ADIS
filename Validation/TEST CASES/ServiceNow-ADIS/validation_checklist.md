# Validation Checklist: ServiceNow-ADIS

**Product:** Australia Deprecation Impact Scanner  
**Version:** 1.0.0  
**Author:** Vladimir Kapustin  
**License:** AGPL-3.0-only  

---

## Pre-Deployment Validation

### Environment Checks

- [ ] **Instance Release Verified**
  - [ ] Navigate to `$version.do`
  - [ ] Release is Zurich or later
  - [ ] Documented: Release = _______________

- [ ] **Required Plugins Active**
  - [ ] `com.snc.app_engine` (Application Developer)
  - [ ] `com.snc.system_app` (System Applications)
  - [ ] `com.snc.flow_designer` (Flow Designer) - Optional
  - [ ] `com.snc.ai_agent_studio` (AI Agent Studio) - Optional

- [ ] **User Access Confirmed**
  - [ ] Admin role assigned
  - [ ] `x_adis_admin` role created
  - [ ] Deployment team has required roles

- [ ] **Backup Completed**
  - [ ] Update set backup exported
  - [ ] Backup file: _______________
  - [ ] Rollback procedure documented

---

### Application Import

- [ ] **XML Import Successful**
  - [ ] Application XML downloaded from GitHub
  - [ ] Import via System Applications > Applications
  - [ ] No import errors
  - [ ] Conflicts resolved (if any)

- [ ] **Application Activated**
  - [ ] Status = "Active"
  - [ ] Module menu visible in navigator
  - [ ] No activation errors in log

- [ ] **Roles Created**
  - [ ] `x_adis_admin` role exists
  - [ ] `x_adis_user` role exists
  - [ ] Roles assigned to deployment team

---

### Configuration Validation

- [ ] **Deprecation Rules Loaded**
  - [ ] Navigate to `x_adis_deprecation_rule.list`
  - [ ] Rule count >= 50
  - [ ] Source release = Zurich
  - [ ] Target release = Australia
  - [ ] Sample rules verified:
    - [ ] `GlideFilter.check()` → `GlideRecord.addQuery()`
    - [ ] `gs.getDateTime()` → `new GlideDateTime()`

- [ ] **Scan Configuration Complete**
  - [ ] `x_adis_scan_config` has records
  - [ ] Target tables configured:
    - [ ] `sys_script_include`
    - [ ] `sys_script_client`
    - [ ] `sys_ws_operation`
    - [ ] `sys_properties`
    - [ ] `sys_ui_macro`
  - [ ] Field lists specified
  - [ ] Filters configured (if needed)

- [ ] **Scheduled Jobs Created**
  - [ ] Weekly Full Scan job
  - [ ] Daily Incremental Scan job
  - [ ] Run As = system
  - [ ] Schedule times set
  - [ ] Jobs in "Active" state

- [ ] **Notifications Configured**
  - [ ] Email action for scan completion
  - [ ] Recipients configured
  - [ ] Test email sent successfully

---

## Testing Validation

### Unit Tests

- [ ] **T01: Plugin Activation Check** - PASS / FAIL / N/A
- [ ] **T02: Role Assignment Verification** - PASS / FAIL / N/A
- [ ] **T03: Configuration Loading** - PASS / FAIL / N/A
- [ ] **T06: Empty Data Handling** - PASS / FAIL / N/A
- [ ] **T13: False Positive Exclusion** - PASS / FAIL / N/A

**Unit Test Summary:** ___ / 5 PASS

---

### Integration Tests

- [ ] **T04: REST API Availability** - PASS / FAIL / N/A
- [ ] **T05: Report Generation** - PASS / FAIL / N/A
- [ ] **T09: Authentication Failure** - PASS / FAIL / N/A
- [ ] **T10: Delta Scan Accuracy** - PASS / FAIL / N/A
- [ ] **T14: Cross-Scope Query** - PASS / FAIL / N/A

**Integration Test Summary:** ___ / 5 PASS

---

### Performance Tests

- [ ] **T08: Performance Under Load (50 concurrent)** - PASS / FAIL / N/A
- [ ] **T11: Boundary Maximum Records** - PASS / FAIL / N/A
- [ ] **T12: Timeout Handling** - PASS / FAIL / N/A

**Performance Test Summary:** ___ / 3 PASS

---

### Regression Tests

- [ ] **REG-001: Full Scan Execution** - PASS / FAIL / N/A
- [ ] **REG-002: Incremental Scan Filters** - PASS / FAIL / N/A
- [ ] **REG-003: Rule Engine Pattern Matching** - PASS / FAIL / N/A
- [ ] **REG-004: Report Generation All Formats** - PASS / FAIL / N/A

**Regression Test Summary:** ___ / 4 PASS

---

### Edge Case Tests

- [ ] **EC-001: Zero Records Table** - PASS / FAIL / N/A
- [ ] **EC-005: Null/Empty Script Field** - PASS / FAIL / N/A
- [ ] **EC-009: No Scan Configuration** - PASS / FAIL / N/A
- [ ] **EC-013: Concurrent Scans** - PASS / FAIL / N/A

**Edge Case Test Summary:** ___ / 4 PASS

---

## Functional Validation

### Scan Execution

- [ ] **Manual Scan Completed**
  - [ ] Scan initiated from UI
  - [ ] Status changed: Running → Completed
  - [ ] Duration < 300 seconds
  - [ ] No errors in `x_adis_log`

- [ ] **Findings Populated**
  - [ ] `x_adis_finding` has records
  - [ ] Findings have valid `rule` references
  - [ ] Findings have valid `record_sys_id`
  - [ ] Severity levels assigned correctly

- [ ] **Report Generation Verified**
  - [ ] HTML report renders correctly
  - [ ] JSON report is valid JSON
  - [ ] PDF report generated (or graceful fallback)
  - [ ] Reports attached to scan run record

---

### Integration Validation

- [ ] **Remediation Task Creation**
  - [ ] Select finding → Create Remediation Task
  - [ ] Change Request created (or Story)
  - [ ] Finding linked to task
  - [ ] Task description includes replacement hint

- [ ] **Email Notifications**
  - [ ] Email received after scan completion
  - [ ] Subject line includes scan number
  - [ ] Body includes summary statistics

- [ ] **AI Agent Studio (if available)**
  - [ ] AI remediation hints generated
  - [ ] Fallback works if AI unavailable

---

## Security Validation

- [ ] **Access Control Tested**
  - [ ] User without role cannot access application
  - [ ] 403 Forbidden returned for unauthorized API calls
  - [ ] Cross-scope warnings logged appropriately

- [ ] **Data Boundary Verified**
  - [ ] No data leaves instance without explicit configuration
  - [ ] REST integrations are outbound only
  - [ ] ACLs configured on all application tables

- [ ] **Audit Trail Functional**
  - [ ] `x_adis_log` captures scan events
  - [ ] Errors logged with sufficient detail
  - [ ] Log retention policy configured

---

## Performance Validation

- [ ] **Baseline Performance Metrics**
  - [ ] Full scan (10k records): _____ seconds (target: < 300s)
  - [ ] Incremental scan (100 records): _____ seconds (target: < 30s)
  - [ ] Report generation: _____ seconds (target: < 10s)
  - [ ] Memory footprint: _____ MB (target: < 50MB)

- [ ] **Instance Responsiveness**
  - [ ] No user-reported slowness during scan
  - [ ] System health dashboard shows normal metrics
  - [ ] No database lock contention

---

## Documentation Validation

- [ ] **Required Documents Present**
  - [ ] `architecture_summary.md` (>= 40 lines)
  - [ ] `dependency_report.md` (>= 30 lines)
  - [ ] `risk_report.md` (>= 50 lines)
  - [ ] `execution_plan.md` (>= 80 lines)
  - [ ] `test_suite_SOP.md` (>= 10 scenarios)
  - [ ] `regression_cases.md` (>= 6 cases)
  - [ ] `edge_cases.md` (>= 10 cases)
  - [ ] `validation_checklist.md` (this document)

- [ ] **README.md Validated**
  - [ ] Word count >= 2000
  - [ ] Mermaid diagram renders
  - [ ] ROI analysis included
  - [ ] Troubleshooting section present
  - [ ] License matches LICENSE file

- [ ] **LICENSE Validated**
  - [ ] Copyright line: "Copyright (C) 2026 Vladimir Kapustin"
  - [ ] License type: AGPL-3.0-only

---

## Post-Deployment Validation

- [ ] **Production Deployment Confirmed**
  - [ ] Application active in production
  - [ ] Initial baseline scan completed
  - [ ] Dashboard accessible to stakeholders

- [ ] **Monitoring Configured**
  - [ ] Executive dashboard created
  - [ ] Alerts configured for critical findings
  - [ ] Runbook updated

- [ ] **Training Completed**
  - [ ] Operations team trained
  - [ ] Administration guide distributed
  - [ ] Support contacts documented

---

## Sign-Off

### Test Results Summary

| Category | Passed | Total | Percentage |
|----------|--------|-------|------------|
| Unit Tests | ___ | 5 | ___% |
| Integration Tests | ___ | 5 | ___% |
| Performance Tests | ___ | 3 | ___% |
| Regression Tests | ___ | 4 | ___% |
| Edge Cases | ___ | 4 | ___% |
| **Overall** | ___ | 21 | ___% |

**Minimum Pass Threshold:** 87% (18/21)

---

### Approval Signatures

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Project Manager | | | |
| QA Lead | | | |
| Platform Administrator | | | |
| Security Representative | | | |

---

### Deployment Decision

- [ ] **APPROVED** - All validation criteria met
- [ ] **APPROVED WITH CONDITIONS** - See notes below
- [ ] **REJECTED** - Critical failures identified

**Conditions/Notes:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```

**Next Review Date:** _______________
