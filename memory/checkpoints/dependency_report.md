# Dependency Report: ServiceNow-ADIS

**Product:** Australia Deprecation Impact Scanner  
**Scope Prefix:** `x_adis`  
**Version:** 1.0.0  
**Author:** Vladimir Kapustin  

---

## Overview

This document catalogs all internal and external dependencies required for ServiceNow-ADIS to function correctly. Dependencies are categorized by criticality and release availability.

---

## ServiceNow Platform Dependencies

### Required Plugins

| Plugin Name | Plugin ID | Release | Criticality | Purpose |
|-------------|-----------|---------|-------------|---------|
| Application Developer | `com.snc.app_engine` | Zurich+ | **P0** | Scoped application framework |
| System Applications | `com.snc.system_app` | Zurich+ | **P0** | Application installer and lifecycle |
| Flow Designer | `com.snc.flow_designer` | Zurich+ | P1 | Optional workflow automation |
| AI Agent Studio | `com.snc.ai_agent_studio` | Australia+ | P2 | Generative remediation hints (optional) |
| Agile Development | `com.snc.agile` | Zurich+ | P2 | Story creation for remediation tasks |
| Change Management | `com.snc.change_management` | Zurich+ | P2 | Change request creation |
| PDF Generator | `com.snc.pdf_generator` | Zurich+ | P2 | PDF report generation |

### System Tables (Read Access Required)

| Table | Purpose | ACL Requirement |
|-------|---------|-----------------|
| `sys_script_include` | Scan server-side scripts | `script_reader` role |
| `sys_script` | Scan background scripts | `script_reader` role |
| `sys_script_client` | Scan client scripts | `script_reader` role |
| `sys_ws_operation` | Scan REST API operations | `web_service_admin` role |
| `sys_properties` | Scan system properties | `admin` or `property_reader` |
| `sys_ui_macro` | Scan UI macros | `ui_admin` role |
| `sys_hub_flow` | Scan Flow Designer flows | `flow_designer` role |
| `sys_auto_script` | Scan scheduled scripts | `admin` role |

### Application Tables (Created by ADIS)

| Table | Label | Purpose |
|-------|-------|---------|
| `x_adis_scan_config` | Scan Configuration | Target tables and filters |
| `x_adis_scan_run` | Scan Run History | Execution metadata |
| `x_adis_finding` | Findings | Individual deprecation records |
| `x_adis_deprecation_rule` | Deprecation Rules | Rule catalog |
| `x_adis_log` | Audit Log | Troubleshooting and audit trail |
| `x_adis_integration_config` | Integration Config | External endpoint settings |

---

## Script Include Dependencies

### Native ServiceNow APIs

| API | Usage | Notes |
|-----|-------|-------|
| `GlideRecord` | All data access | Use `setLimit()` for large tables |
| `GlideDateTime` | Timestamp comparisons | Australia-compatible |
| `GlideSystem` | Logging via `gs.info()` | Native logging |
| `GlideJSON` | JSON parsing/generation | Native in Zurich+ |
| `GlideFilter` | Query condition building | Use new API (`addQuery()`) |
| `TableUtils` | Table metadata inspection | Optional, for dynamic discovery |

### Custom Script Includes (Internal)

| Script Include | Depends On | Purpose |
|----------------|------------|---------|
| `AustraliaDeprecationImpactScanner` | None | Core scanner engine |
| `AustraliaDeprecationImpactScannerRuleEngine` | None | Rule evaluation |
| `AustraliaDeprecationImpactScannerReportGenerator` | None | Report generation |
| `AustraliaDeprecationImpactScannerTaskGenerator` | None | Task creation |

---

## External Dependencies

### Python Testing Framework

| Package | Version | Purpose | Installation |
|---------|---------|---------|--------------|
| `pytest` | 7.0+ | Unit test runner | `pip install pytest` |
| `requests` | 2.28+ | REST API mocking | `pip install requests` |
| `pytest-cov` | 4.0+ | Coverage reporting | `pip install pytest-cov` |

### Node.js Testing (Optional)

| Package | Version | Purpose |
|---------|---------|---------|
| `node` | 18+ | JavaScript test runtime |
| `jest` | 29+ | JS unit testing (if using JS mocks) |

### Documentation Generation

| Tool | Purpose |
|------|---------|
| `markdown-it` | README validation |
| `mermaid-cli` | Architecture diagram rendering (optional) |

---

## Browser Automation Dependencies (QA)

| Tool | Purpose | Notes |
|------|---------|-------|
| Playwright | PDI smoke testing | Requires `playwright install chromium` |
| Hermes Browser Tools | Instance navigation | Built into Hermes Agent |

---

## Build and Deployment Dependencies

### Git

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Git | 2.30+ | Version control |
| GitHub CLI (`gh`) | 2.0+ | Repository management (optional) |

### ServiceNow Studio

| Requirement | Purpose |
|-------------|---------|
| ServiceNow Studio | Application development and import |
| Update Set | Alternative deployment method |
| Source Control Integration | Git-backed development (Australia+) |

---

## Optional Integrations

### CI/CD Pipeline

| Tool | Purpose | Configuration |
|------|---------|---------------|
| Jenkins | Automated testing | REST webhook to trigger scans |
| GitHub Actions | CI validation | `sn-api-deploy` action |
| Azure DevOps | Release pipelines | ServiceNow deployment task |

### Monitoring and Alerting

| Tool | Purpose |
|------|---------|
| Splunk | Log aggregation from `x_adis_log` |
| ServiceNow Performance Analytics | Trend dashboards |
| PagerDuty | Alert on critical findings (via integration) |

---

## Version Compatibility Matrix

| ServiceNow Release | Compatibility | Notes |
|--------------------|---------------|-------|
| Yokohama | ❌ Not supported | Pre-Australia APIs |
| **Zurich** | ✅ **Minimum supported** | Baseline target |
| **Australia** | ✅ **Primary target** | Full feature set |
| Washington DC | ✅ Compatible | Future deprecation rules TBD |

---

## Known Limitations

1. **AI Agent Studio Integration:** Requires Australia release. Falls back gracefully if not available.
2. **PDF Generation:** Requires `pdf_generator` plugin. HTML/JSON exports work without it.
3. **Flow Designer Scanning:** Only scans published flows, not draft versions.
4. **Cross-Scope Access:** Requires explicit grants for tables in other scopes (e.g., `sn_devops_*`).

---

## Dependency Health Checks

Run these checks before deployment:

```javascript
// Check required plugins
var plugins = ['com.snc.app_engine', 'com.snc.system_app'];
for (var i = 0; i < plugins.length; i++) {
    var gr = new GlideRecord('sys_plugin');
    gr.addQuery('id', plugins[i]);
    gr.query();
    if (!gr.next()) {
        gs.error('Missing required plugin: ' + plugins[i]);
    }
}

// Check table access
var testGR = new GlideRecord('sys_script_include');
testGR.setLimit(1);
testGR.query();
if (!testGR.hasNext()) {
    gs.error('No read access to sys_script_include');
}
```

---

## Third-Party License Compliance

| Dependency | License | Compliance Status |
|------------|---------|-------------------|
| pytest | MIT | ✅ Compatible with AGPL-3.0 |
| requests | Apache 2.0 | ✅ Compatible |
| mermaid | MIT | ✅ Compatible |

---

## Maintenance Schedule

| Task | Frequency | Owner |
|------|-----------|-------|
| Update deprecation rules | Per ServiceNow release | Platform Team |
| Review external dependencies | Quarterly | Security Team |
| Validate plugin compatibility | Pre-upgrade | Upgrade Team |
| Audit cross-scope grants | Monthly | Admin Team |
