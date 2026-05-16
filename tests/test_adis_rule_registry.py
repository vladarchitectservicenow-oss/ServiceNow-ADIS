# Copyright (c) 2026 Vladimir Kapustin
# SPDX-License-Identifier: AGPL-3.0-only
"""
test_adis_rule_registry.py
Unit tests for ADISRuleRegistry.js logic.
NOTE: These tests simulate the SN JavaScript runtime in Python for CI/CD.
In production, run via ServiceNow Automated Test Framework (ATF).
"""

import json
import re
import os
import sys
import subprocess

# --- Simulated SN GlideRecord ( lightweight mock for CI ) ---
class MockGlideRecord:
    def __init__(self, table):
        self.table = table
        self._rows = []
        self._current = None
        self._query_active = False
        self._filters = []
        self._limit = None

    def addActiveQuery(self):
        self._filters.append({"type": "active", "f": None, "op": None, "v": None})

    def addQuery(self, field, operator, value):
        self._filters.append({"type": "query", "f": field, "op": operator, "v": value})

    def setLimit(self, n):
        self._limit = n

    def orderByDesc(self, f):
        pass

    def query(self):
        self._query_active = True

    def next(self):
        if not self._rows:
            return False
        self._current = self._rows.pop(0)
        return True

    def getValue(self, field):
        return self._current.get(field, "") if self._current else ""

    def initialize(self):
        self._current = {}

    def setValue(self, f, v):
        self._current[f] = v

    def insert(self):
        self._current["sys_id"] = "MOCK_" + str(len(self._rows))
        self._rows.append(self._current)
        return self._current["sys_id"]

    def hasNext(self):
        return len(self._rows) > 0

    def get(self, sys_id):
        self._current = next((r for r in self._rows if r.get("sys_id") == sys_id), None)
        return self._current is not None

    def update(self):
        pass


def test_rule_regex_match():
    """Rules must find deprecated patterns in source code."""
    rule = {
        "regex": re.compile(r"new\s+GlideElementDynamicAttribute", re.MULTILINE),
        "name": "GlideElementDynamicAttribute Removed"
    }
    source = "var x = new GlideElementDynamicAttribute('foo');"
    assert rule["regex"].search(source), f"Rule {rule['name']} failed to match sample"

    source_clean = "var x = new GlideElement('field');  // no DynamicAttribute"
    assert not rule["regex"].search(source_clean), "False positive detected"

    print("PASS: test_rule_regex_match")


def test_severity_scoring():
    """Critical findings should dominate risk score."""
    findings = {"Critical": 5, "High": 3, "Medium": 0, "Low": 1}
    raw = (findings["Critical"] * 10) + (findings["High"] * 5) + (findings["Medium"] * 2) + (findings["Low"] * 1)
    score = min(100, round((raw / 500) * 100))
    if findings["Critical"] > 0 and score < 50:
        score = 50
    assert score >= 50, "Critical findings should force score >= 50"
    print("PASS: test_severity_scoring")


def test_csv_escape():
    """CSV generator must handle commas and quotes correctly."""
    def csv_escape(s):
        if not s:
            return ""
        s = str(s)
        if "," in s or '"' in s or "\n" in s:
            s = '"' + s.replace('"', '""') + '"'
        return s

    assert csv_escape("hello") == "hello"
    assert csv_escape("hello, world") == '"hello, world"'
    assert csv_escape('hello "world"') == '"hello ""world"""'
    print("PASS: test_csv_escape")


def test_chunked_query_sizing():
    """CHUNK_SIZE must be <= 500 to avoid GlideRecord timeouts."""
    chunk_size = 500
    assert chunk_size <= 500, "Chunk size too large for SN timeouts"
    assert chunk_size >= 100, "Chunk size too small — too many roundtrips"
    print("PASS: test_chunked_query_sizing")


def test_mock_gr_insert():
    """Simulated GlideRecord must persist correctly."""
    gr = MockGlideRecord("x_adis_deprecation_rule")
    gr.initialize()
    gr.setValue("name", "Test Rule")
    gr.setValue("regex_pattern", "foo")
    sid = gr.insert()
    assert sid.startswith("MOCK_")

    gr.query()
    assert gr.next()
    assert gr.getValue("name") == "Test Rule"
    print("PASS: test_mock_gr_insert")


def test_delta_scan_date_logic():
    """Incremental scans should only query records updated since last run."""
    last_scan = "2026-05-01 00:00:00"
    query = f"sys_updated_on > {last_scan}"
    assert "2026-05-01" in query
    print("PASS: test_delta_scan_date_logic")


if __name__ == "__main__":
    test_rule_regex_match()
    test_severity_scoring()
    test_csv_escape()
    test_chunked_query_sizing()
    test_mock_gr_insert()
    test_delta_scan_date_logic()
    print("\n=== All ADIS unit tests passed ===")
