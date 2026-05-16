/** 
 * @copyright Copyright (C) 2026 Vladimir Kapustin
 * @license   AGPL-3.0-or-later
 * @file      ADISReportGenerator.js
 * @scope     x_adis
 * @description Generates HTML, JSON, and PDF impact reports from scan results.
 */

var ADISReportGenerator = Class.create();
ADISReportGenerator.prototype = {
    initialize: function() {
        this.scope = 'x_adis';
    },

    /**
     * Generate an impact report in the requested format.
     * @param {String} scanRunId
     * @param {String} format - 'html' | 'json' | 'pdf'
     * @return {String} Report output (HTML string, JSON string, or binary base64 for PDF)
     */
    generateReport: function(scanRunId, format) {
        if (!scanRunId) throw new Error('scanRunId is required');
        format = (format || 'html').toLowerCase();
        
        var scanRun = this._getScanRun(scanRunId);
        var findings = this._getFindings(scanRunId);
        
        if (format === 'json') {
            return this._generateJSON(scanRun, findings);
        } else if (format === 'pdf') {
            return this._generatePDF(scanRun, findings);
        } else {
            return this._generateHTML(scanRun, findings);
        }
    },

    _getScanRun: function(scanRunId) {
        var gr = new GlideRecord('x_adis_scan_run');
        if (!gr.get(scanRunId)) {
            throw new Error('Scan run not found: ' + scanRunId);
        }
        return {
            sys_id: gr.getValue('sys_id'),
            number: gr.getValue('number'),
            scan_type: gr.getValue('scan_type'),
            scope: gr.getValue('scope'),
            target_releases: gr.getValue('target_releases'),
            state: gr.getValue('state'),
            findings_count: gr.getValue('findings_count'),
            skipped_count: gr.getValue('skipped_count'),
            risk_score: gr.getValue('risk_score'),
            execution_time_ms: gr.getValue('execution_time_ms'),
            started: gr.getValue('started'),
            ended: gr.getValue('ended')
        };
    },

    _getFindings: function(scanRunId) {
        var findings = [];
        var gr = new GlideRecord('x_adis_finding');
        gr.addQuery('scan_run_ref', scanRunId);
        gr.orderByDesc('severity');
        gr.query();
        while (gr.next()) {
            findings.push({
                sys_id: gr.getValue('sys_id'),
                deprecated_item: gr.getValue('deprecated_item'),
                table_name: gr.getValue('table_name'),
                record_name: gr.getValue('record_name'),
                record_sys_id: gr.getValue('record_sys_id'),
                severity: gr.getValue('severity'),
                line_number: gr.getValue('line_number'),
                regex_match: gr.getValue('regex_match'),
                replacement_suggestion: gr.getValue('replacement_suggestion'),
                state: gr.getValue('state')
            });
        }
        return findings;
    },

    _generateHTML: function(scanRun, findings) {
        var html = [];
        html.push('<!DOCTYPE html>');
        html.push('<html><head><meta charset="UTF-8">');
        html.push('<title>ADIS Impact Report | ' + scanRun.number + '</title>');
        html.push('<style>');
        html.push('body { font-family: Arial, sans-serif; margin: 24px; color: #222; }');
        html.push('h1 { color: #0B1F3A; border-bottom: 2px solid #0B1F3A; padding-bottom: 8px; }');
        html.push('table { border-collapse: collapse; width: 100%; margin-top: 16px; }');
        html.push('th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }');
        html.push('th { background: #0B1F3A; color: #fff; }');
        html.push('.severity-critical { background: #D9534F; color: #fff; font-weight: bold; }');
        html.push('.severity-high { background: #F0AD4E; color: #222; font-weight: bold; }');
        html.push('.severity-warning { background: #F7DC6F; color: #222; }');
        html.push('.severity-info { background: #D5DBDB; color: #222; }');
        html.push('.summary-box { background: #F4F6F7; padding: 16px; border-radius: 6px; margin-bottom: 16px; }');
        html.push('.summary-box p { margin: 6px 0; }');
        html.push('</style></head><body>');
        
        html.push('<h1>ADIS Impact Report</h1>');
        html.push('<div class="summary-box">');
        html.push('<p><strong>Scan ID:</strong> ' + (scanRun.number || scanRun.sys_id) + '</p>');
        html.push('<p><strong>Type:</strong> ' + (scanRun.scan_type || 'N/A') + '</p>');
        html.push('<p><strong>Target Releases:</strong> ' + (scanRun.target_releases || 'N/A') + '</p>');
        html.push('<p><strong>State:</strong> ' + (scanRun.state || 'N/A') + '</p>');
        html.push('<p><strong>Risk Score:</strong> ' + (scanRun.risk_score || '0') + '/100 </p>');
        html.push('<p><strong>Findings:</strong> ' + (scanRun.findings_count || '0') + '</p>');
        html.push('<p><strong>Skipped:</strong> ' + (scanRun.skipped_count || '0') + '</p>');
        html.push('<p><strong>Duration:</strong> ' + (scanRun.execution_time_ms || 'N/A') + ' ms</p>');
        html.push('<p><strong>Started:</strong> ' + (scanRun.started || 'N/A') + '</p>');
        html.push('<p><strong>Ended:</strong> ' + (scanRun.ended || 'N/A') + '</p>');
        html.push('<p><strong>Generated by:</strong> ADIS v1.0.0 | © 2026 Vladimir Kapustin | AGPL-3.0</p>');
        html.push('</div>');
        
        html.push('<table><tr>');
        html.push('<th>Severity</th><th>Deprecated Item</th><th>Table</th>');
        html.push('<th>Record</th><th>Line</th><th>Match</th><th>Fix Suggestion</th>');
        html.push('</tr>');
        
        for (var i = 0; i < findings.length; i++) {
            var f = findings[i];
            var cssClass = 'severity-' + (f.severity || 'info').toLowerCase();
            html.push('<tr class="' + cssClass + '">');
            html.push('<td>' + (f.severity || 'Info') + '</td>');
            html.push('<td>' + this._escape(f.deprecated_item || '') + '</td>');
            html.push('<td>' + (f.table_name || '') + '</td>');
            html.push('<td>' + this._escape(f.record_name || '') + '</td>');
            html.push('<td>' + (f.line_number || 'N/A') + '</td>');
            html.push('<td><code>' + this._escape(f.regex_match || '') + '</code></td>');
            html.push('<td>' + this._escape(f.replacement_suggestion || '') + '</td>');
            html.push('</tr>');
        }
        
        html.push('</table></body></html>');
        return html.join('\n');
    },

    _generateJSON: function(scanRun, findings) {
        var obj = {
            report_meta: {
                product: 'ADIS',
                version: '1.0.0',
                generated: new GlideDateTime().toString(),
                license: 'AGPL-3.0',
                author: 'Vladimir Kapustin'
            },
            scan_run: scanRun,
            summary: {
                total_findings: findings.length,
                critical: 0,
                high: 0,
                warning: 0,
                info: 0,
                risk_score: scanRun.risk_score
            },
            findings: findings
        };
        
        for (var i = 0; i < findings.length; i++) {
            var s = findings[i].severity;
            if (s === 'Critical') obj.summary.critical++;
            else if (s === 'High') obj.summary.high++;
            else if (s === 'Warning') obj.summary.warning++;
            else if (s === 'Info') obj.summary.info++;
        }
        
        return JSON.stringify(obj, null, 2);
    },

    _generatePDF: function(scanRun, findings) {
        // NOTE: ServiceNow does not natively support server-side PDF generation from JS.
        // Best practice: generate HTML, then use PDF API plugin or pass to external renderer.
        // For the scoped app, we return HTML wrapped as a data URI base indicator.
        // Actual PDF generation is done client-side or via external integration.
        var html = this._generateHTML(scanRun, findings);
        // Return marker + base64-encoded HTML for downstream processing
        return 'PDF_BASE64:' + GlideStringUtil.base64Encode(html);
    },

    _escape: function(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/&lt;/g, '&lt;')
            .replace(/&gt;/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    type: 'ADISReportGenerator'
};
