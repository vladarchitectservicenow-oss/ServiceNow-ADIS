/** 
 * @copyright Copyright (C) 2026 Vladimir Kapustin
 * @license   AGPL-3.0-or-later
 * @file      ADISScanner.js
 * @scope     x_adis
 * @description Main scanner engine. Crawls script tables, applies deprecation rules,
 *             creates findings, calculates risk scores. Supports full and incremental scans.
 */

var ADISScanner = Class.create();
ADISScanner.prototype = {
    initialize: function() {
        this.scope = 'x_adis';
        this.version = '1.0.0';
        this.batchSize = 100;
        this.maxTextLength = 10000;
        this.tablesToScan = [
            'sys_script_include',
            'sys_script',
            'sys_script_client',
            'sys_ws_operation'
        ];
        this.scriptFields = {
            'sys_script_include': 'script',
            'sys_script': 'script',
            'sys_script_client': 'script',
            'sys_ws_operation': 'script'
        };
        this.ruleEngine = new ADISRuleEngine();
        this.reportGenerator = new ADISReportGenerator();
        this._logLevel = gs.getProperty('x_adis.properties.log_level', 'info');
        this._log('info', 'ADISScanner initialized v' + this.version);
    },

    /**
     * Execute a full scan across all target tables.
     * @param {Array} targetReleases - e.g. ['Australia', 'Zurich']
     * @return {String} sys_id of created x_adis_scan_run
     */
    runFullScan: function(targetReleases) {
        var startTime = new Date().getTime();
        var scanRunId = this._createScanRun('full', 'global', targetReleases, null);
        
        this._log('info', 'Starting full scan: ' + scanRunId);
        try {
            this._updateScanRun(scanRunId, { state: 'Running', started: new GlideDateTime() });
            var findings = this._scanAllTables(targetReleases, null);
            var skippedCount = findings.skippedCount || 0;
            var findingRecords = findings.records || [];
            this._createFindings(findingRecords, scanRunId);
            
            var riskScore = this._calculateRiskScore(findingRecords);
            var endTime = new Date().getTime();
            var execTime = endTime - startTime;
            
            this._updateScanRun(scanRunId, {
                state: 'Completed',
                findings_count: findingRecords.length,
                skipped_count: skippedCount,
                risk_score: riskScore,
                execution_time_ms: execTime,
                ended: new GlideDateTime()
            });
            
            this._postScanActions(scanRunId, findingRecords);
            this._log('info', 'Full scan completed: ' + scanRunId + ' | findings=' + findingRecords.length + ' | risk=' + riskScore);
            return scanRunId;
        } catch (e) {
            this._updateScanRun(scanRunId, {
                state: 'Failed',
                ended: new GlideDateTime()
            });
            this._log('error', 'Full scan failed: ' + e.message);
            throw e;
        }
    },

    /**
     * Execute an incremental scan only for records modified since the last scan.
     * @param {String} lastScanRunId
     * @return {String} sys_id of created x_adis_scan_run
     */
    runIncrementalScan: function(lastScanRunId) {
        var startTime = new Date().getTime();
        var lastScanGR = new GlideRecord('x_adis_scan_run');
        if (!lastScanGR.get(lastScanRunId)) {
            throw new Error('Last scan run not found: ' + lastScanRunId);
        }
        var targetReleases = (lastScanGR.getValue('target_releases') || '').split(',');
        var lastScanTime = lastScanGR.getValue('ended') || lastScanGR.getValue('started');
        
        var scanRunId = this._createScanRun('incremental', 'global', targetReleases, lastScanRunId);
        this._log('info', 'Starting incremental scan: ' + scanRunId);
        
        try {
            this._updateScanRun(scanRunId, { state: 'Running', started: new GlideDateTime() });
            var findings = this._scanAllTables(targetReleases, lastScanTime);
            var skippedCount = findings.skippedCount || 0;
            var findingRecords = findings.records || [];
            this._createFindings(findingRecords, scanRunId);
            
            var riskScore = this._calculateRiskScore(findingRecords);
            var endTime = new Date().getTime();
            var execTime = endTime - startTime;
            
            this._updateScanRun(scanRunId, {
                state: 'Completed',
                findings_count: findingRecords.length,
                skipped_count: skippedCount,
                risk_score: riskScore,
                execution_time_ms: execTime,
                ended: new GlideDateTime()
            });
            
            this._postScanActions(scanRunId, findingRecords);
            this._log('info', 'Incremental scan completed: ' + scanRunId + ' | findings=' + findingRecords.length);
            return scanRunId;
        } catch (e) {
            this._updateScanRun(scanRunId, {
                state: 'Failed',
                ended: new GlideDateTime()
            });
            this._log('error', 'Incremental scan failed: ' + e.message);
            throw e;
        }
    },

    /**
     * Scan all configured tables.
     * @param {Array} targetReleases
     * @param {String|null} sinceDateTime - For incremental scans
     * @return {Object} { records: [findings], skippedCount: int }
     */
    _scanAllTables: function(targetReleases, sinceDateTime) {
        var allFindings = [];
        var totalSkipped = 0;
        
        for (var t = 0; t < this.tablesToScan.length; t++) {
            var tableName = this.tablesToScan[t];
            var rules = this.ruleEngine.getActiveRules(targetReleases, tableName);
            if (rules.length === 0) {
                this._log('info', 'No active rules for table: ' + tableName);
                continue;
            }
            
            this._log('info', 'Scanning table: ' + tableName + ' | rules=' + rules.length);
            var result = this._scanTable(tableName, rules, sinceDateTime);
            allFindings = allFindings.concat(result.findings);
            totalSkipped += result.skipped;
        }
        
        return { records: allFindings, skippedCount: totalSkipped };
    },

    /**
     * Scan a single table with pagination.
     * @param {String} tableName
     * @param {Array} rules - Active deprecation rules
     * @param {String|null} sinceDateTime
     * @return {Object} { findings: [..], skipped: int }
     */
    _scanTable: function(tableName, rules, sinceDateTime) {
        var findings = [];
        var skipped = 0;
        var scriptField = this.scriptFields[tableName] || 'script';
        
        var gr = new GlideRecord(tableName);
        if (sinceDateTime) {
            gr.addQuery('sys_updated_on', '>=', sinceDateTime);
        }
        gr.query();
        
        var count = 0;
        while (gr.next()) {
            try {
                var script = gr.getValue(scriptField) || '';
                var recordName = gr.getDisplayValue() || gr.getValue('name') || gr.getValue('sys_id');
                var recordSysId = gr.getValue('sys_id');
                
                if (!script || script.length === 0) {
                    skipped++;
                    continue;
                }
                if (script.length > this.maxTextLength) {
                    script = script.substring(0, this.maxTextLength);
                }
                
                var recordFindings = this._scanRecord(script, rules, tableName, recordSysId, recordName);
                findings = findings.concat(recordFindings);
                count++;
                
                if (count % 100 === 0) {
                    this._log('debug', 'Scanned ' + count + ' records in ' + tableName);
                }
            } catch (e) {
                this._log('warn', 'Skipping malformed record in ' + tableName + ': ' + e.message);
                skipped++;
            }
        }
        
        this._log('info', 'Table scan complete: ' + tableName + ' | records=' + count + ' | findings=' + findings.length + ' | skipped=' + skipped);
        return { findings: findings, skipped: skipped };
    },

    /**
     * Apply all matching rules to a single script text.
     * @param {String} script
     * @param {Array} rules
     * @param {String} tableName
     * @param {String} recordSysId
     * @param {String} recordName
     * @return {Array} finding objects
     */
    _scanRecord: function(script, rules, tableName, recordSysId, recordName) {
        var findings = [];
        var lines = script.split('\n');
        var seenPatterns = {};  // dedupe per record per rule
        
        for (var r = 0; r < rules.length; r++) {
            var rule = rules[r];
            try {
                var regex = new RegExp(rule.regex_pattern, 'g');
                var match;
                while ((match = regex.exec(script)) !== null) {
                    var dedupeKey = rule.sys_id + '|' + recordSysId;
                    if (seenPatterns[dedupeKey]) continue;
                    seenPatterns[dedupeKey] = true;
                    
                    var lineNum = this._findLineNumber(lines, match.index);
                    findings.push({
                        table_name: tableName,
                        record_sys_id: recordSysId,
                        record_name: recordName,
                        deprecated_item: rule.deprecated_item || rule.name,
                        regex_match: match[0].substring(0, 500),
                        line_number: lineNum,
                        severity: rule.severity,
                        replacement_suggestion: rule.replacement_suggestion,
                        rule_ref: rule.sys_id,
                        state: 'New'
                    });
                    
                    // Prevent infinite loop on zero-length matches
                    if (match[0].length === 0) break;
                }
            } catch (e) {
                this._log('warn', 'Regex error for rule ' + rule.sys_id + ': ' + e.message);
            }
        }
        return findings;
    },

    /**
     * Find approximate line number for a character index.
     * @param {Array} lines
     * @param {Number} index
     * @return {Number} 0-based line number (1-based displayed)
     */
    _findLineNumber: function(lines, index) {
        var pos = 0;
        for (var i = 0; i < lines.length; i++) {
            pos += lines[i].length + 1; // +1 for newline
            if (pos >= index) return i + 1;
        }
        return 0;
    },

    /**
     * Bulk insert findings into x_adis_finding.
     * @param {Array} findings
     * @param {String} scanRunId
     */
    _createFindings: function(findings, scanRunId) {
        var inserted = 0;
        for (var i = 0; i < findings.length; i++) {
            var f = findings[i];
            try {
                var gr = new GlideRecord('x_adis_finding');
                gr.initialize();
                gr.scan_run_ref = scanRunId;
                gr.table_name = f.table_name;
                gr.record_sys_id = f.record_sys_id;
                gr.record_name = f.record_name;
                gr.deprecated_item = f.deprecated_item;
                gr.regex_match = f.regex_match;
                gr.line_number = f.line_number;
                gr.severity = f.severity;
                gr.replacement_suggestion = f.replacement_suggestion;
                gr.rule_ref = f.rule_ref;
                gr.state = f.state;
                gr.short_description = f.deprecated_item + ' in ' + f.record_name;
                gr.insert();
                inserted++;
            } catch (e) {
                this._log('error', 'Failed to insert finding: ' + e.message);
            }
        }
        this._log('info', 'Inserted ' + inserted + '/' + findings.length + ' findings');
    },

    /**
     * Create a scan_run record.
     */
    _createScanRun: function(scanType, scope, targetReleases, lastScanRunId) {
        var gr = new GlideRecord('x_adis_scan_run');
        gr.initialize();
        gr.scan_type = scanType;
        gr.scope = scope;
        gr.target_releases = targetReleases.join(',');
        gr.state = 'Queued';
        gr.last_scan_run_ref = lastScanRunId || '';
        gr.pushed_to_instance_scan = false;
        gr.short_description = 'ADIS ' + scanType + ' scan for ' + targetReleases.join(', ');
        return gr.insert();
    },

    /**
     * Update scan_run fields.
     */
    _updateScanRun: function(scanRunId, fields) {
        var gr = new GlideRecord('x_adis_scan_run');
        if (!gr.get(scanRunId)) return false;
        for (var key in fields) {
            if (fields.hasOwnProperty(key)) {
                gr.setValue(key, fields[key]);
            }
        }
        gr.update();
        return true;
    },

    /**
     * Calculate aggregate risk score (0-100).
     */
    _calculateRiskScore: function(findings) {
        var weights = { 'Critical': 25, 'High': 10, 'Warning': 3, 'Info': 0 };
        var score = 0;
        for (var i = 0; i < findings.length; i++) {
            var s = findings[i].severity;
            score += weights[s] || 0;
        }
        return Math.min(score, 100);
    },

    /**
     * Post-scan actions: push to Instance Scan, auto-create remediation tasks.
     */
    _postScanActions: function(scanRunId, findings) {
        var pushToInstanceScan = gs.getProperty('x_adis.properties.push_to_instance_scan', 'false');
        var autoCreateTasks = gs.getProperty('x_adis.properties.auto_create_remediation_tasks', 'false');
        
        if (pushToInstanceScan === 'true') {
            this._pushToInstanceScan(scanRunId, findings);
        }
        if (autoCreateTasks === 'true') {
            this._autoCreateRemediationTasks(scanRunId, findings);
        }
    },

    /**
     * Push findings to Instance Scan (scan_finding table) if available.
     */
    _pushToInstanceScan: function(scanRunId, findings) {
        try {
            var scanFindingTable = 'scan_finding';
            var grCheck = new GlideRecord(scanFindingTable);
            if (!grCheck.isValid()) {
                this._log('warn', 'Instance Scan plugin not active; skipping push');
                return;
            }
            
            var severityMap = { 'Critical': 'High', 'High': 'High', 'Warning': 'Medium', 'Info': 'Low' };
            var pushed = 0;
            for (var i = 0; i < findings.length; i++) {
                var f = findings[i];
                var sf = new GlideRecord(scanFindingTable);
                sf.initialize();
                sf.category = 'Deprecation';
                sf.severity = severityMap[f.severity] || 'Low';
                sf.description = f.deprecated_item + ' found in ' + f.record_name + ' (' + f.table_name + ')';
                sf.details = 'Rule: ' + f.rule_ref + ' | Line: ' + f.line_number + ' | Suggestion: ' + f.replacement_suggestion;
                sf.source = 'ADIS';
                sf.insert();
                pushed++;
            }
            this._updateScanRun(scanRunId, { pushed_to_instance_scan: true });
            this._log('info', 'Pushed ' + pushed + ' findings to Instance Scan');
        } catch (e) {
            this._log('error', 'Failed to push to Instance Scan: ' + e.message);
        }
    },

    /**
     * Auto-create remediation tasks for Critical and High findings.
     */
    _autoCreateRemediationTasks: function(scanRunId, findings) {
        try {
            var defaultGroup = gs.getProperty('x_adis.properties.default_assignment_group', '');
            var created = 0;
            for (var i = 0; i < findings.length; i++) {
                var f = findings[i];
                if (f.severity !== 'Critical' && f.severity !== 'High') continue;
                
                var task = new GlideRecord('x_adis_remediation_task');
                task.initialize();
                task.finding_ref = f.sys_id || '';
                task.task_type = 'change_request';
                task.short_description = 'ADIS Remediation: ' + f.deprecated_item + ' in ' + f.record_name;
                task.description = [
                    'Finding ref: ' + (f.sys_id || 'N/A'),
                    'Record: ' + f.table_name + ' / ' + f.record_sys_id + ' (' + f.record_name + ')',
                    'Deprecated item: ' + f.deprecated_item,
                    'Severity: ' + f.severity,
                    'Suggested fix: ' + f.replacement_suggestion
                ].join('\n');
                task.priority = (f.severity === 'Critical') ? '1' : '2';
                task.assignment_group = defaultGroup;
                task.state = 'New';
                task.insert();
                created++;
            }
            this._log('info', 'Created ' + created + ' remediation tasks');
        } catch (e) {
            this._log('error', 'Failed to create remediation tasks: ' + e.message);
        }
    },

    /**
     * Internal logging.
     */
    _log: function(level, message) {
        var levels = { 'debug': 0, 'info': 1, 'warn': 2, 'error': 3 };
        var current = levels[this._logLevel] || 1;
        var msgLevel = levels[level] || 1;
        if (msgLevel < current) return;
        
        var prefix = '[ADIS ' + level.toUpperCase() + ']';
        if (level === 'error') {
            gs.error(prefix + ' ' + message);
        } else if (level === 'warn') {
            gs.warn(prefix + ' ' + message);
        } else {
            gs.info(prefix + ' ' + message);
        }
    },

    type: 'ADISScanner'
};
