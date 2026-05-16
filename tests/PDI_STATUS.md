# PDI Test Status Report
## Instance: dev362840.service-now.com

**Date:** 2026-05-16  
**Tester:** ServiceNow Solution Architect Vladimir Kapustin

### Result: BLOCKED — Instance Hibernating

**Error:** `Your instance is hibernating` — direct login attempts via `/login.do` did not reactivate the PDI.

**Next step for manual reactivation:**
1. Visit https://developer.servicenow.com/dev.do
2. Sign in with developer account
3. Navigate to Developer Instances → Manage → dev362840
4. Click "Wake Instance"
5. Wait 3-5 minutes for activation

### CI Test Results (Passed Locally)
| Test Suite | Status | Details |
|-----------|--------|---------|
| `test_adis_rule_registry.py` | PASS | 6/6 tests — regex matching, severity scoring, CSV escaping, chunked query sizing, delta scan date, mock GR insert |
| `test_adis_scan_e2e.py` | PASS | 4/4 tests — end-to-end scan, max findings stop, risk boundary conditions, CSV header validation |

### Recommended PDI Tests (Post-Wake)
1. Import `sys_app.xml` into Studio via "Import from XML"
2. Verify tables `x_adis_scan_run`, `x_adis_finding`, `x_adis_deprecation_rule`, `x_adis_remediation_task` are created
3. Trigger a scan via Scheduled Job using `ADISScanner`
4. Verify findings are created against `sys_script_include`
5. Check risk score calculation in report dashboard
6. Export CSV via `ADISReportGenerator.generateCSV()`

---
*Note: PDI is a test box. Do not rely on it for production validation. Full ATF suite recommended before go-live.*
