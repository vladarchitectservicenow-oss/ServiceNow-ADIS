#!/usr/bin/env python3
"""
ADIS Super Tester Harness
Copyright (C) 2026 Vladimir Kapustin
SPDX-License-Identifier: AGPL-3.0-or-later

Validates ADIS scoped app artifacts against test_suite_SOP.md.
No PDI connection required for static validation — structural PASS/FAIL.
"""
import os, sys, json, re, xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime

BASE = Path("/home/crixus/agentic-loop/output/ADIS")
REPORTS = BASE / "tests/execution_history"
REPORTS.mkdir(parents=True, exist_ok=True)

results = { "scenarios": [], "passed": 0, "failed": 0, "skipped": 0, "duration_ms": 0 }

def log(s): print(f"[ADIS-TEST] {s}", file=sys.stderr)

def scenario(name, fn):
    log(f"RUNNING {name} ...")
    try:
        fn()
        results["scenarios"].append({"name": name, "status": "PASS", "error": None})
        results["passed"] += 1
        log(f"  -> PASS")
    except AssertionError as e:
        results["scenarios"].append({"name": name, "status": "FAIL", "error": str(e)})
        results["failed"] += 1
        log(f"  -> FAIL: {e}")

# ------------------------------------------------------------------
# SCENARIOS
# ------------------------------------------------------------------

def test_sys_app_exists():
    assert (BASE / "src/sys_app.xml").exists(), "sys_app.xml missing"
    tree = ET.parse(BASE / "src/sys_app.xml")
    root = tree.getroot()
    name = root.find(".//name")
    assert name is not None and "Australia Deprecation" in (name.text or ""), "Name doesn't match"
    scope = root.find(".//scope")
    assert scope is not None and scope.text == "x_adis", f"Scope mismatch: {scope.text if scope is not None else None}"
    lic = root.find(".//license")
    assert lic is not None and "AGPL-3.0" in (lic.text or ""), "License missing/mismatch"

def test_scan_run_table_schema():
    tree = ET.parse(BASE / "src/tables/x_adis_data.xml")
    root = tree.getroot()
    runs = root.findall("x_adis_scan_run")
    assert len(runs) >= 1, "No scan_run template found"
    # verify key fields
    flds = ["scan_type", "scope", "target_releases", "state", "findings_count", "risk_score", "execution_time_ms", "started", "ended"]
    for r in runs:
        for f in flds:
            el = r.find(f)
            assert el is not None, f"scan_run missing field: {f}"

def test_finding_records():
    tree = ET.parse(BASE / "src/tables/x_adis_data.xml")
    root = tree.getroot()
    findings = root.findall("x_adis_finding")
    assert len(findings) >= 1, "No findings seeded"
    severities = set()
    for f in findings:
        s = (f.find("severity").text or "").strip()
        severities.add(s)
        assert s in {"Critical", "High", "Warning", "Info"}, f"Invalid severity: {s}"
    assert "Critical" in severities, "At least one Critical finding required"

def test_deprecation_rules():
    tree = ET.parse(BASE / "src/tables/x_adis_data.xml")
    root = tree.getroot()
    rules = root.findall("x_adis_deprecation_rule")
    assert len(rules) >= 3, f"Expected >=3 rules, got {len(rules)}"
    names = set()
    for r in rules:
        n = r.find("name").text
        assert n not in names, f"Duplicate rule name: {n}"
        names.add(n)
        regex = r.find("regex_pattern").text
        assert regex and len(regex) > 0, f"Empty regex in {n}"
        # Validate regex in Python (best effort)
        try:
            re.compile(regex)
        except re.error as e:
            raise AssertionError(f"Invalid regex in rule {n}: {e}")

def test_remediation_task_template():
    tree = ET.parse(BASE / "src/tables/x_adis_data.xml")
    root = tree.getroot()
    tasks = root.findall("x_adis_remediation_task")
    assert len(tasks) >= 1, "No remediation_task template"
    t = tasks[0]
    assert t.find("finding_ref") is not None, "Missing finding_ref"
    assert t.find("state") is not None, "Missing state"

def test_script_includes():
    si_dir = BASE / "src/script_includes"
    expected = ["ADISScanner.js", "ADISRuleEngine.js", "ADISReportGenerator.js"]
    for e in expected:
        assert (si_dir / e).exists(), f"Missing Script Include: {e}"
        content = (si_dir / e).read_text()
        assert "AGPL-3.0" in content or "Vladimir Kapustin" in content, f"Missing copyright in {e}"
        assert "Class.create()" in content, f"Missing Class.create() in {e}"

def test_scheduled_jobs():
    sj_dir = BASE / "src/scheduled_jobs"
    assert (sj_dir / "ADIS_Weekly_Full_Scan.js").exists(), "Missing weekly scan job"
    assert (sj_dir / "ADIS_Nightly_Incremental_Scan.js").exists(), "Missing nightly scan job"
    wk = (sj_dir / "ADIS_Weekly_Full_Scan.js").read_text()
    assert "ADISScanner" in wk, "Weekly job doesn't reference ADISScanner"
    assert "weekly_scan_enabled" in wk, "Missing property check in weekly"

def test_business_rules():
    br_dir = BASE / "src/business_rules"
    assert br_dir.exists(), "business_rules directory missing"
    br_files = list(br_dir.glob("*.js"))
    assert len(br_files) >= 1, "No business rules defined"

def test_readme():
    assert (BASE / "README.md").exists(), "README.md missing"
    content = (BASE / "README.md").read_text()
    assert "AGPL-3.0" in content, "License not mentioned in README"
    assert "GlideElementDynamicAttribute" in content, "Key deprecation not documented"
    assert "Vladimir Kapustin" in content, "Author not in README"

def test_architecture_doc():
    assert (BASE / "docs/ARCHITECTURE.md").exists(), "ARCHITECTURE.md missing"

def test_suite_sop():
    assert (BASE / "tests/test_suite_SOP.md").exists(), "test_suite_SOP.md missing"

def test_scanner_engine_structure():
    scanner = (BASE / "src/script_includes/ADISScanner.js").read_text()
    assert "runFullScan" in scanner, "Missing runFullScan"
    assert "runIncrementalScan" in scanner, "Missing runIncrementalScan"
    assert "_scanAllTables" in scanner, "Missing _scanAllTables"
    assert "_calculateRiskScore" in scanner, "Missing _calculateRiskScore"
    assert "_pushToInstanceScan" in scanner, "Missing Instance Scan integration"
    assert "_autoCreateRemediationTasks" in scanner, "Missing remediation task creation"

# ------------------------------------------------------------------
# MAIN
# ------------------------------------------------------------------

if __name__ == "__main__":
    start = datetime.now()
    
    scenario("SCAN-001 (Static): sys_app metadata", test_sys_app_exists)
    scenario("SCAN-002 (Static): scan_run table schema", test_scan_run_table_schema)
    scenario("UI-001 (Static): Finding records seeded", test_finding_records)
    scenario("RULE-001 (Static): Deprecation rule syntax", test_deprecation_rules)
    scenario("REM-001 (Static): Remediation task template", test_remediation_task_template)
    scenario("BUILD-001 (Static): Core Script Includes present", test_script_includes)
    scenario("SCH-001 (Static): Scheduled jobs present + configured", test_scheduled_jobs)
    scenario("BR-001 (Static): Business rules present", test_business_rules)
    scenario("DOC-001 (Static): README compliance", test_readme)
    scenario("DOC-002 (Static): Architecture document", test_architecture_doc)
    scenario("SOP-001 (Static): Test SOP present", test_suite_sop)
    scenario("ENG-001 (Static): Scanner engine completeness", test_scanner_engine_structure)
    
    results["duration_ms"] = int((datetime.now() - start).total_seconds() * 1000)
    
    report = {
        "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "product": "ADIS",
        "version": "1.0.0",
        "scenarios_run": [s["name"] for s in results["scenarios"]],
        "passed": results["passed"],
        "failed": results["failed"],
        "skipped": results["skipped"],
        "duration_ms": results["duration_ms"],
        "environment": "local-ci (static)",
        "commit_sha": "(local)"
    }
    
    report_path = REPORTS / f"{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}_run.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    log("=" * 50)
    log(f"RESULTS: PASS={results['passed']} FAIL={results['failed']} SKIPPED={results['skipped']}")
    log(f"Duration: {results['duration_ms']}ms")
    log(f"Report saved: {report_path}")
    
    if results["failed"] > 0:
        log("EXIT: FAILED (fix issues before push)")
        sys.exit(1)
    else:
        log("EXIT: 100% PASS — deployment gate OPEN")
        sys.exit(0)
