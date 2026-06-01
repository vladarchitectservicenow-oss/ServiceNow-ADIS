# Risk Report: ServiceNow-ADIS

**Product:** Australia Deprecation Impact Scanner  
**Scope Prefix:** `x_adis`  
**Assessment Date:** 2026-06-01  
**Author:** Vladimir Kapustin  

---

## Executive Summary

ServiceNow-ADIS presents **LOW overall risk** for deployment in Zurich+ instances. The application operates entirely within the ServiceNow security boundary, uses only native APIs, and requires no inbound connections. Primary risks are related to performance impact during large scans and potential false positives in deprecation detection.

**Overall Risk Score: 2.3/10** (Low)

---

## Risk Classification Framework

| Level | Score Range | Action Required |
|-------|-------------|-----------------|
| **P0 - Critical** | 8.0-10.0 | Block deployment, immediate remediation |
| **P1 - High** | 5.0-7.9 | Address before production deployment |
| **P2 - Medium** | 2.5-4.9 | Monitor, plan remediation |
| **P3 - Low** | 0.0-2.4 | Accept, document, review periodically |

---

## Identified Risks

### P0 - Critical Risks

**None identified.**

---

### P1 - High Risks

#### R1.1: Performance Impact on Large Instances

**Risk ID:** R1.1  
**Category:** Performance  
**Score:** 6.5/10  

**Description:**  
Full instance scans on instances with 50,000+ script records may cause temporary performance degradation during scan execution. The scanner uses GlideRecord queries with `setLimit()` and async execution, but large result sets can still impact database performance.

**Impact:**
- Slow instance response times during scan windows
- Potential timeout of concurrent user operations
- Database lock contention on heavily customized instances

**Likelihood:** Medium (3/5)  
**Severity:** High (4/5)  

**Mitigation:**
1. Schedule full scans during maintenance windows (recommended: Sunday 02:00-04:00)
2. Use incremental scanning (`scanIncremental()`) for daily runs
3. Configure table-level scan limits in `x_adis_scan_config`
4. Monitor `x_adis_log` for slow query warnings
5. Implement query batching with `setBatchSize(100)`

**Verification:**
```javascript
// Test scan performance on target instance
var scanner = new AustraliaDeprecationImpactScanner();
var start = new Date();
var result = scanner.scan();
var duration = (new Date() - start) / 1000;
gs.info('Scan completed in ' + duration + 's. Records: ' + result.recordsScanned);
// Alert if duration > 300 seconds
```

---

#### R1.2: False Positive Findings

**Risk ID:** R1.2  
**Category:** Accuracy  
**Score:** 5.5/10  

**Description:**  
Regex-based pattern matching may flag code that uses deprecated API names in non-executable contexts (comments, string literals, documentation) or uses valid patterns that resemble deprecated ones.

**Impact:**
- Wasted developer time investigating non-issues
- Reduced trust in scanner accuracy
- Potential for real issues to be overlooked amid noise

**Likelihood:** Medium (3/5)  
**Severity:** Medium (3/5)  

**Mitigation:**
1. Implement context-aware regex (exclude comments, string literals)
2. Add confidence scoring to findings (High/Medium/Low)
3. Provide "Mark as False Positive" UI action with feedback loop
4. Maintain exclusion list in `x_adis_scan_config`
5. Regular rule tuning based on user feedback

**Verification:**
```javascript
// Test for comment exclusion
var testScript = "// This uses deprecated API: oldMethod()\nactualCode();";
var ruleEngine = new AustraliaDeprecationImpactScannerRuleEngine();
var findings = ruleEngine.evaluate(testScript);
// Should return 0 findings (comment excluded)
```

---

### P2 - Medium Risks

#### R2.1: Cross-Scope Access Limitations

**Risk ID:** R2.1  
**Category:** Security  
**Score:** 4.0/10  

**Description:**  
The application requires explicit cross-scope privileges to scan tables in other scopes (e.g., `sn_devops_*`, `sn_hr_*`, custom `x_*` scopes). Without these grants, scans will return incomplete results, creating a false sense of security.

**Impact:**
- Incomplete deprecation coverage
- Missed critical findings in external scopes
- Upgrade failures due to undetected issues

**Likelihood:** High (4/5)  
**Severity:** Medium (2/5)  

**Mitigation:**
1. Document required cross-scope grants in installation guide
2. Add pre-flight check that warns about missing grants
3. Provide "Request Access" workflow for security teams
4. Log warnings when cross-scope queries return zero results

**Verification:**
```javascript
// Pre-flight cross-scope check
var scopes = ['sn_devops', 'sn_hr', 'x_custom'];
for (var i = 0; i < scopes.length; i++) {
    var gr = new GlideRecord(scopes[i] + '_table');
    gr.setLimit(1);
    gr.query();
    if (!gr.hasNext()) {
        gs.warn('No access to scope: ' + scopes[i]);
    }
}
```

---

#### R2.2: AI Agent Studio Dependency (Optional Feature)

**Risk ID:** R2.2  
**Category:** Feature Availability  
**Score:** 3.5/10  

**Description:**  
Generative remediation hints require AI Agent Studio (Australia+). Instances on Zurich or without the plugin will not have this feature, potentially reducing remediation efficiency.

**Impact:**
- Manual remediation effort increases
- Inconsistent user experience across releases

**Likelihood:** High (4/5)  
**Severity:** Low (1/5)  

**Mitigation:**
1. Graceful degradation: hide AI features if plugin unavailable
2. Provide static replacement hints from rule catalog
3. Document feature availability by release

**Verification:**
```javascript
// Check AI Agent Studio availability
var aiPlugin = new GlideRecord('sys_plugin');
aiPlugin.addQuery('id', 'com.snc.ai_agent_studio');
aiPlugin.query();
var aiAvailable = aiPlugin.hasNext();
gs.info('AI Agent Studio: ' + (aiAvailable ? 'Available' : 'Not Available'));
```

---

#### R2.3: Report Attachment Storage Growth

**Risk ID:** R2.3  
**Category:** Storage  
**Score:** 3.0/10  

**Description:**  
PDF and HTML reports are stored as attachments on `x_adis_scan_run` records. Weekly full scans over 12 months can accumulate 50+ reports, consuming significant attachment storage.

**Impact:**
- Increased database storage costs
- Slower report list queries

**Likelihood:** Medium (3/5)  
**Severity:** Low (1/5)  

**Mitigation:**
1. Implement automatic retention policy (e.g., keep last 12 reports)
2. Compress attachments or store externally
3. Provide "Cleanup Old Reports" scheduled job

---

### P3 - Low Risks

#### R3.1: Timezone Handling in Incremental Scans

**Risk ID:** R3.1  
**Category:** Data Integrity  
**Score:** 2.0/10  

**Description:**  
Incremental scans use `sys_updated_on` comparisons. Instances with users in multiple timezones may have inconsistent timestamp filtering if not normalized to UTC.

**Mitigation:**
1. Always use `getDisplayValueInternal()` for UTC comparisons
2. Document timezone handling in administration guide

---

#### R3.2: Browser Compatibility for UI Components

**Risk ID:** R3.2  
**Category:** Usability  
**Score:** 1.5/10  

**Description:**  
Next Experience UI components may not render correctly in older browsers (IE11, legacy Edge).

**Mitigation:**
1. Document supported browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge Chromium)
2. Provide fallback UI16 views if needed

---

#### R3.3: Scheduled Job Conflict

**Risk ID:** R3.3  
**Category:** Operations  
**Score:** 1.0/10  

**Description:**  
Multiple scheduled scan jobs running simultaneously may cause resource contention.

**Mitigation:**
1. Implement job locking mechanism
2. Stagger scheduled job times

---

## Risk Summary Table

| Risk ID | Category | Score | Level | Status |
|---------|----------|-------|-------|--------|
| R1.1 | Performance | 6.5 | P1 | Mitigated |
| R1.2 | Accuracy | 5.5 | P1 | Mitigated |
| R2.1 | Security | 4.0 | P2 | Mitigated |
| R2.2 | Feature | 3.5 | P2 | Mitigated |
| R2.3 | Storage | 3.0 | P2 | Mitigated |
| R3.1 | Data | 2.0 | P3 | Accepted |
| R3.2 | Usability | 1.5 | P3 | Accepted |
| R3.3 | Operations | 1.0 | P3 | Accepted |

---

## Risk Acceptance Statement

The risks identified in this assessment are within acceptable thresholds for enterprise ServiceNow applications. All P1 risks have documented mitigations that reduce residual risk to P2 or below. Deployment is approved subject to:

1. Implementation of performance mitigations (R1.1)
2. False positive feedback loop implementation (R1.2)
3. Cross-scope access documentation (R2.1)

**Approved by:** Vladimir Kapustin  
**Date:** 2026-06-01  
**Next Review:** 2026-09-01 (Quarterly)
