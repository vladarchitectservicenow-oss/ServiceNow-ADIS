# Execution Plan: ServiceNow-ADIS

**Product:** Australia Deprecation Impact Scanner  
**Scope Prefix:** `x_adis`  
**Version:** 1.0.0  
**Author:** Vladimir Kapustin  
**Timeline:** 2 weeks (10 business days)  

---

## Overview

This document provides a step-by-step execution plan for deploying ServiceNow-ADIS in a ServiceNow instance. The plan covers pre-deployment preparation, installation, configuration, testing, and post-deployment monitoring.

---

## Phase 1: Pre-Deployment Preparation (Days 1-2)

### Day 1: Environment Assessment

#### Task 1.1: Instance Compatibility Check
**Owner:** Platform Administrator  
**Duration:** 2 hours  

**Steps:**
1. Verify ServiceNow release is Zurich or later:
   ```
   Navigate to: $version.do
   Expected: Release version >= Zurich
   ```
2. Check available plugins:
   ```
   Navigate to: sys_plugin.list
   Filter: id IN com.snc.app_engine,com.snc.system_app
   Expected: Both plugins active
   ```
3. Verify admin access:
   ```
   Navigate to: sys_user_role.list
   Filter: user = current user AND role = admin
   Expected: Record exists
   ```

**Exit Criteria:** Instance meets minimum requirements.

---

#### Task 1.2: Cross-Scope Access Planning
**Owner:** Security Team  
**Duration:** 3 hours  

**Steps:**
1. Identify scopes to scan:
   - `global` (always included)
   - `sn_devops_*` (if DevOps plugin active)
   - `sn_hr_*` (if HRSD active)
   - Custom `x_*` scopes

2. Document required grants in `x_adis_scan_config`:
   ```javascript
   // Example cross-scope grant request
   // Table: x_adis_scan_config
   // Field: scope_override
   // Value: sn_devops,sn_hr
   ```

3. Submit access request via Change Management:
   - Change Type: Standard
   - Risk: Low
   - Justification: Read-only access for deprecation scanning

**Exit Criteria:** Cross-scope access approved or documented as exclusion.

---

#### Task 1.3: Backup and Rollback Planning
**Owner:** Platform Administrator  
**Duration:** 1 hour  

**Steps:**
1. Create update set backup:
   ```
   Navigate to: sys_update_set.list
   Action: Export to XML
   Filename: adis_pre_deploy_backup.xml
   ```
2. Document rollback procedure:
   - Delete application: System Applications > Applications > x_adis > Delete
   - Restore tables: Import backup XML if needed
   - Clear logs: `DELETE FROM x_adis_log`

**Exit Criteria:** Rollback procedure documented and tested in sub-production.

---

### Day 2: Application Import

#### Task 2.1: Import Scoped Application
**Owner:** Platform Administrator  
**Duration:** 2 hours  

**Steps:**
1. Download application XML from GitHub:
   ```
   https://github.com/vladarchitectservicenow-oss/ServiceNow-ADIS/releases/latest
   ```
2. Import via Application Repository:
   ```
   Navigate to: System Applications > Applications > All
   Action: Import Application
   Select: adis_application.xml
   ```
3. Resolve any import conflicts:
   - If table conflicts: Choose "Use Existing"
   - If Script Include conflicts: Choose "Replace"

**Exit Criteria:** Application imported without errors.

---

#### Task 2.2: Activate Application
**Owner:** Platform Administrator  
**Duration:** 1 hour  

**Steps:**
1. Activate the application:
   ```
   Navigate to: System Applications > Applications > All
   Filter: Name = Australia Deprecation Impact Scanner
   Right-click > Activate
   ```
2. Verify activation:
   ```
   Expected: Application status = Active
   Expected: Module menu appears in navigator
   ```

**Exit Criteria:** Application active and accessible.

---

#### Task 2.3: Role Assignment
**Owner:** Security Team  
**Duration:** 1 hour  

**Steps:**
1. Create admin role if not auto-created:
   ```
   Navigate to: sys_user_role
   New: Name = x_adis_admin, Application = x_adis
   ```
2. Assign roles to deployment team:
   ```
   Navigate to: sys_user_has_role
   New: User = [admin user], Role = x_adis_admin
   ```

**Exit Criteria:** Deployment team has required access.

---

## Phase 2: Configuration (Days 3-4)

### Day 3: Rule Configuration

#### Task 3.1: Load Deprecation Rules
**Owner:** Platform Administrator  
**Duration:** 3 hours  

**Steps:**
1. Import default rule set:
   ```
   Navigate to: x_adis_deprecation_rule
   Right-click > Import Rules
   Select: zurich_to_australia_rules.json
   ```
2. Verify rule count:
   ```
   Expected: 50+ rules loaded
   Filter: source_release = Zurich, target_release = Australia
   ```
3. Customize rules for instance-specific patterns:
   - Add custom deprecated patterns
   - Adjust severity levels based on instance usage

**Exit Criteria:** Rule catalog loaded and validated.

---

#### Task 3.2: Configure Scan Targets
**Owner:** Platform Administrator  
**Duration:** 2 hours  

**Steps:**
1. Configure target tables:
   ```
   Navigate to: x_adis_scan_config
   New: table_name = sys_script_include, field_list = script, active = true
   New: table_name = sys_script_client, field_list = script, active = true
   New: table_name = sys_ws_operation, field_list = endpoint, active = true
   ```
2. Set scan filters:
   ```
   Example: scope = x_adis (exclude self)
   Example: sys_updated_on > javascript:gs.daysAgoStart(30)
   ```

**Exit Criteria:** Scan configuration complete.

---

### Day 4: Integration Setup

#### Task 4.1: Configure Scheduled Jobs
**Owner:** Platform Administrator  
**Duration:** 2 hours  

**Steps:**
1. Create full scan job:
   ```
   Navigate to: sys_auto_script
   New: Name = ADIS Weekly Full Scan
        Script = new AustraliaDeprecationImpactScanner().scan();
        Run As = system
        Schedule = Weekly, Sunday 02:00
   ```
2. Create incremental scan job:
   ```
   New: Name = ADIS Daily Incremental
        Script = new AustraliaDeprecationImpactScanner().scanIncremental(gs.daysAgo(1));
        Schedule = Daily, 03:00
   ```

**Exit Criteria:** Scheduled jobs configured and active.

---

#### Task 4.2: Configure Notifications
**Owner:** Platform Administrator  
**Duration:** 1 hour  

**Steps:**
1. Set up email notifications:
   ```
   Navigate to: sysevent_email_action
   New: Table = x_adis_scan_run
        When = Record inserted
        Recipients = [platform team]
        Subject = ADIS Scan Complete: ${number}
   ```
2. Configure critical finding alerts:
   ```
   New: Table = x_adis_finding
        When = severity = P0
        Recipients = [security team]
   ```

**Exit Criteria:** Notifications configured.

---

## Phase 3: Testing (Days 5-7)

### Day 5: Unit Testing

#### Task 5.1: Scanner Engine Tests
**Owner:** Developer  
**Duration:** 4 hours  

**Steps:**
1. Run unit tests:
   ```bash
   cd /tmp/ServiceNow-ADIS
   pytest tests/test_scanner.py -v
   ```
2. Verify test results:
   ```
   Expected: 10/10 PASS minimum
   ```

**Exit Criteria:** All unit tests pass.

---

#### Task 5.2: Rule Engine Tests
**Owner:** Developer  
**Duration:** 3 hours  

**Steps:**
1. Test rule evaluation:
   ```bash
   pytest tests/test_rule_engine.py -v
   ```
2. Validate false positive handling:
   ```
   Test: Comment exclusion
   Test: String literal exclusion
   ```

**Exit Criteria:** Rule engine accuracy > 95%.

---

### Day 6: Integration Testing

#### Task 6.1: End-to-End Scan Test
**Owner:** Platform Administrator  
**Duration:** 4 hours  

**Steps:**
1. Execute manual scan:
   ```
   Navigate to: x_adis_scan_run
   New > Submit
   Wait for completion
   ```
2. Verify findings:
   ```
   Navigate to: x_adis_finding
   Expected: Findings populated
   ```
3. Validate report generation:
   ```
   Action: Generate HTML Report
   Expected: Report renders correctly
   ```

**Exit Criteria:** Full scan completes successfully.

---

### Day 7: Performance Testing

#### Task 7.1: Load Testing
**Owner:** Platform Administrator  
**Duration:** 4 hours  

**Steps:**
1. Simulate large instance scan:
   ```javascript
   // Background script
   var scanner = new AustraliaDeprecationImpactScanner();
   var start = new Date();
   var result = scanner.scan();
   var duration = (new Date() - start) / 1000;
   gs.info('Duration: ' + duration + 's');
   ```
2. Monitor instance performance:
   ```
   Navigate to: system_health_dashboard
   Check: CPU, Memory, Database response times
   ```

**Exit Criteria:** Scan completes in < 300 seconds without degradation.

---

## Phase 4: Deployment (Days 8-9)

### Day 8: Production Deployment

#### Task 8.1: Deploy to Production
**Owner:** Platform Administrator  
**Duration:** 2 hours  

**Steps:**
1. Repeat Phase 2 steps in production instance
2. Verify application activation
3. Run initial baseline scan

**Exit Criteria:** Application deployed and operational in production.

---

### Day 9: Validation

#### Task 9.1: Post-Deployment Validation
**Owner:** Platform Administrator  
**Duration:** 3 hours  

**Steps:**
1. Verify scan results match sub-production
2. Confirm notifications are working
3. Validate report accessibility

**Exit Criteria:** Production deployment validated.

---

## Phase 5: Post-Deployment (Day 10)

### Day 10: Monitoring Setup

#### Task 10.1: Dashboard Configuration
**Owner:** Platform Administrator  
**Duration:** 2 hours  

**Steps:**
1. Create executive dashboard:
   ```
   Navigate to: pa_dashboards
   New: Name = ADIS Executive Dashboard
   Widgets: Total Findings, Risk Distribution, Trend
   ```
2. Share with stakeholders

**Exit Criteria:** Dashboard available to leadership.

---

#### Task 10.2: Documentation Handoff
**Owner:** Project Manager  
**Duration:** 2 hours  

**Steps:**
1. Distribute administration guide
2. Schedule training session
3. Add to runbook

**Exit Criteria:** Operations team trained and documented.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Scan completion time | < 5 minutes | `x_adis_scan_run.duration` |
| Finding accuracy | > 95% | False positive rate |
| User adoption | > 80% of platform team | Dashboard views |
| Remediation rate | > 50% findings resolved in 30 days | `x_adis_finding.remediation_task` |

---

## Rollback Procedure

If deployment fails:

1. **Immediate Rollback (< 1 hour):**
   ```
   Navigate to: System Applications > Applications > x_adis
   Right-click > Delete
   Confirm deletion
   ```

2. **Data Cleanup:**
   ```sql
   DELETE FROM x_adis_scan_run;
   DELETE FROM x_adis_finding;
   DELETE FROM x_adis_log;
   ```

3. **Restore from Backup:**
   ```
   Navigate to: System Update Sets > Retrieved Update Sets
   Import: adis_pre_deploy_backup.xml
   ```

---

## Approval Signatures

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Project Sponsor | | | |
| Platform Administrator | | | |
| Security Team | | | |
| Change Advisory Board | | | |
