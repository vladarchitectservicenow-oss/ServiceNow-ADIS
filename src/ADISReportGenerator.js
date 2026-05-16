/**
 * Copyright (c) 2026 Vladimir Kapustin
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * ADISReportGenerator — HTML dashboard, JSON REST, PDF, CSV exports.
 */

var ADISReportGenerator = Class.create();

ADISReportGenerator.prototype = {
    initialize: function(scanRunId) {
        this._scanRunId = scanRunId;
    },

    /**
     * Build summary data for consumption by UI pages, REST, and scheduled reports.
     */
    buildSummary: function() {
        var scan = new GlideRecord("x_adis_scan_run");
        if (!scan.get(this._scanRunId)) {
            throw new Error("[ADIS] Scan run not found: " + this._scanRunId);
        }

        var findings = this._countBySeverity();
        var topApps  = this._topOffendingApps(5);
        var topRules = this._topRules(5);

        return {
            scan_run: {
                sys_id:   this._scanRunId,
                status:   scan.getValue("status"),
                started:  scan.getValue("started"),
                completed: scan.getValue("completed"),
                records_scanned: parseInt(scan.getValue("records_scanned") || "0"),
                findings_count:  parseInt(scan.getValue("findings_count") || "0"),
                duration_sec:    parseFloat(scan.getValue("duration_sec") || "0")
            },
            severity_breakdown: findings,
            top_applications: topApps,
            top_rules: topRules,
            risk_score: this._calculateRiskScore(findings),
            remediation_progress: this._remediationProgress()
        };
    },

    _countBySeverity: function() {
        var out = { Critical: 0, High: 0, Medium: 0, Low: 0 };
        var ga = new GlideAggregate("x_adis_finding");
        ga.addQuery("scan_run", this._scanRunId);
        ga.addAggregate("COUNT");
        ga.groupBy("severity");
        ga.query();
        while (ga.next()) {
            var sev = ga.getValue("severity");
            var cnt = parseInt(ga.getAggregate("COUNT"));
            out[sev] = cnt;
        }
        return out;
    },

    /**
     * Identify top offending applications by counting findings per application/sys_scope.
     */
    _topOffendingApps: function(limit) {
        var apps = [];
        var ga = new GlideAggregate("x_adis_finding");
        ga.addQuery("scan_run", this._scanRunId);
        ga.addAggregate("COUNT");
        ga.groupBy("target_table"); // proxy for app — refined in v1.1
        ga.orderByAggregate("COUNT", "DESC");
        ga.setLimit(limit || 5);
        ga.query();
        while (ga.next()) {
            apps.push({
                table: ga.getValue("target_table"),
                finding_count: parseInt(ga.getAggregate("COUNT"))
            });
        }
        return apps;
    },

    _topRules: function(limit) {
        var rules = [];
        var ga = new GlideAggregate("x_adis_finding");
        ga.addQuery("scan_run", this._scanRunId);
        ga.addAggregate("COUNT");
        ga.groupBy("rule_name");
        ga.orderByAggregate("COUNT", "DESC");
        ga.setLimit(limit || 5);
        ga.query();
        while (ga.next()) {
            rules.push({
                rule_name: ga.getValue("rule_name"),
                finding_count: parseInt(ga.getAggregate("COUNT"))
            });
        }
        return rules;
    },

    /**
     * Risk Score Algorithm:
     * Critical × 10 + High × 5 + Medium × 2 + Low × 1
     * Normalized to 0-100 scale based on heuristic thresholds.
     */
    _calculateRiskScore: function(findings) {
        var raw = (findings.Critical * 10) + (findings.High * 5) + (findings.Medium * 2) + (findings.Low * 1);
        var max = 500; // 50 critical findings maxes the scale
        var score = Math.min(100, Math.round((raw / max) * 100));
        if (findings.Critical > 0 && score < 50) score = 50; // floor if any critical exist
        return score;
    },

    _remediationProgress: function() {
        var total = new GlideAggregate("x_adis_finding");
        total.addQuery("scan_run", this._scanRunId);
        total.addAggregate("COUNT");
        total.query();
        var totalCount = 0;
        if (total.next()) totalCount = parseInt(total.getAggregate("COUNT"));

        var closed = new GlideAggregate("x_adis_finding");
        closed.addQuery("scan_run", this._scanRunId);
        closed.addQuery("status", "IN", "remediated,closed,suppressed");
        closed.addAggregate("COUNT");
        closed.query();
        var closedCount = 0;
        if (closed.next()) closedCount = parseInt(closed.getAggregate("COUNT"));

        return {
            total: totalCount,
            closed: closedCount,
            percent: totalCount > 0 ? Math.round((closedCount / totalCount) * 100) : 0
        };
    },

    /**
     * Generate a CSV string of findings.
     */
    generateCSV: function() {
        var csv = "Rule,Category,Severity,Table,Record Name,Match Count,Snippet,Replacement Hint,Documentation URL,Status\n";
        var gr = new GlideRecord("x_adis_finding");
        gr.addQuery("scan_run", this._scanRunId);
        gr.query();
        while (gr.next()) {
            csv += [
                this._csvEscape(gr.getValue("rule_name")),
                this._csvEscape(gr.getValue("category")),
                this._csvEscape(gr.getValue("severity")),
                this._csvEscape(gr.getValue("target_table")),
                this._csvEscape(gr.getValue("record_name")),
                gr.getValue("match_count"),
                this._csvEscape(gr.getValue("code_snippet")),
                this._csvEscape(gr.getValue("replacement_hint")),
                this._csvEscape(gr.getValue("documentation_url")),
                this._csvEscape(gr.getValue("status"))
            ].join(",") + "\n";
        }
        return csv;
    },

    _csvEscape: function(str) {
        if (!str) return "";
        str = "" + str;
        if (str.indexOf(",") >= 0 || str.indexOf('"') >= 0 || str.indexOf("\n") >= 0) {
            str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    },

    type: "ADISReportGenerator"
};
