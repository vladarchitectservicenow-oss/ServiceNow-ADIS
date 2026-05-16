/**
 * Copyright (c) 2026 Vladimir Kapustin
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * ADISScanner — Core scan engine for the Australia Deprecation Impact Scanner.
 * Scans all script-bearing tables for deprecated API usage using regex rules.
 *
 * Design principles:
 *   1. Chunked querying (max 500 records per batch) to avoid GlideRecord timeouts
 *   2. Async execution via Scheduled Job or on-demand UI Action
 *   3. Delta scanning — skips records with unchanged sys_updated_on
 *   4. Thread-safe — uses sys_execution_tracker to prevent concurrent scans
 *   5. Zero external dependencies — all data stays inside ServiceNow
 */

var ADISScanner = Class.create();

ADISScanner.CHUNK_SIZE = 500;       // GlideRecord batch limit
ADISScanner.MAX_FINDINGS = 50000;   // Hard stop to prevent runaway scans

ADISScanner.prototype = {
    /**
     * @param {ADISRuleRegistry} rules — populated rule registry
     */
    initialize: function(rules) {
        this._rules = rules || new ADISRuleRegistry();
        this._scanRun = null;
        this._findingCount = 0;
        this._scannedRecords = 0;
        this._startTime = new GlideDateTime();
    },

    /**
     * Run a full scan across all configured target tables.
     * @param {String} scanType — 'full' | 'incremental' | 'on_demand_table'
     * @param {String} targetTable — optional, restrict scan to one table (on_demand_table mode)
     * @returns {String} scanRunSysId
     */
    runScan: function(scanType, targetTable) {
        scanType = scanType || "full";

        if (this._isScanInProgress()) {
            throw new Error("[ADIS] Another scan is already in progress. Wait or cancel it.");
        }

        this._scanRun = this._createScanRun(scanType, targetTable);
        var runId = this._scanRun.getValue("sys_id");

        try {
            var targets = this._getTargetTables(targetTable);
            for (var t = 0; t < targets.length; t++) {
                var target = targets[t];
                this._scanTable(target.table, target.field, target.condition, scanType);
            }
            this._finalizeScan("success", "Scan completed. Findings: " + this._findingCount);
        } catch (ex) {
            this._finalizeScan("error", ex.message);
            throw ex;
        }

        return runId;
    },

    /**
     * Check for concurrent scan via execution tracker.
     */
    _isScanInProgress: function() {
        var gr = new GlideRecord("sys_execution_tracker");
        gr.addQuery("source", "ADISScanner");
        gr.addQuery("state", "IN", "ready,running");
        gr.addQuery("started", "ON", new GlideDateTime());
        gr.query();
        return gr.hasNext();
    },

    /**
     * Create the header record for this scan run.
     */
    _createScanRun: function(scanType, targetTable) {
        var gr = new GlideRecord("x_adis_scan_run");
        gr.initialize();
        gr.setValue("scan_type", scanType);
        gr.setValue("target_table", targetTable || "ALL");
        gr.setValue("status", "running");
        gr.setValue("started", new GlideDateTime());
        gr.setValue("initiated_by", gs.getUserID());
        gr.insert();
        return gr;
    },

    /**
     * Return the list of script-bearing tables to scan.
     * Expandable via Scan Config records.
     */
    _getTargetTables: function(override) {
        if (override) {
            return [{ table: override, field: this._detectScriptField(override), condition: "" }];
        }

        // Default target set for Zurich to Australia upgrades
        return [
            { table: "sys_script_include",  field: "script",    condition: "" },
            { table: "sys_script",          field: "script",    condition: "collection!=NULL" },
            { table: "sys_script_client",   field: "script",    condition: "" },
            { table: "sys_ui_action",       field: "script",    condition: "" },
            { table: "sys_trigger",         field: "script",    condition: "" },
            { table: "sys_transform_script",field: "script",    condition: "" },
            { table: "sys_script_fix",      field: "script",    condition: "" },
            { table: "sys_ws_operation",    field: "script",    condition: "" },
            { table: "sys_hub_action_type_definition", field: "script", condition: "" },
            { table: "sys_script_email",    field: "script",    condition: "" },
            { table: "sys_properties",      field: "value",     condition: "" },
            { table: "sys_ui_policy",       field: "script",    condition: "run_scripts=true" },
            { table: "sys_ui_macro",        field: "script",    condition: "" }
        ];
    },

    /**
     * Auto-detect the primary script-carrying field for an arbitrary table.
     */
    _detectScriptField: function(tableName) {
        var di = new GlideRecord(tableName);
        var fields = ["script", "condition", "xml", "value", "payload", "script_false", "script_true"];
        for (var i = 0; i < fields.length; i++) {
            if (di.isValidField(fields[i])) {
                return fields[i];
            }
        }
        return "script"; // fallback
    },

    /**
     * Scan a single table in chunks.
     */
    _scanTable: function(tableName, fieldName, condition, scanType) {
        var rulesMap = this._rules.getRules();
        var ruleKeys = Object.keys(rulesMap);
        if (ruleKeys.length === 0) {
            gs.warn("[ADIS] No active rules to scan with.");
            return;
        }

        var lastScanDate = this._getLastScanDate(tableName, scanType);
        var chunk = 0;
        var hasMore = true;

        while (hasMore && this._findingCount < ADISScanner.MAX_FINDINGS) {
            var gr = new GlideRecord(tableName);
            if (condition) {
                gr.addEncodedQuery(condition);
            }
            if (scanType === "incremental" && lastScanDate) {
                gr.addQuery("sys_updated_on", ">", lastScanDate);
            }
            gr.orderBy("sys_updated_on");
            gr.setLimit(ADISScanner.CHUNK_SIZE);
            gr.chooseWindow(chunk * ADISScanner.CHUNK_SIZE, (chunk + 1) * ADISScanner.CHUNK_SIZE);
            gr.query();

            var rowsInChunk = 0;
            while (gr.next()) {
                rowsInChunk++;
                this._scannedRecords++;
                var source = gr.getValue(fieldName) || "";
                if (!source) continue;
                var sysId = gr.getValue("sys_id");
                var name  = gr.getDisplayValue("name") || gr.getDisplayValue("sys_name") || sysId;

                for (var r = 0; r < ruleKeys.length; r++) {
                    var rule = rulesMap[ruleKeys[r]];
                    if (!rule.regex) continue;
                    var matches = source.match(rule.regex);
                    if (matches && matches.length > 0) {
                        this._createFinding(rule, tableName, sysId, name, matches.length, source.substring(0, 400));
                    }
                }
            }

            hasMore = rowsInChunk === ADISScanner.CHUNK_SIZE;
            chunk++;

            // Yield every 5 chunks to prevent long-running transaction timeouts
            if (chunk % 5 === 0) {
                gs.sleep(50); // brief yield (ms)
            }
        }

        if (this._findingCount >= ADISScanner.MAX_FINDINGS) {
            gs.warn("[ADIS] Reached MAX_FINDINGS limit (" + ADISScanner.MAX_FINDINGS + "). Stopping scan.");
        }
    },

    /**
     * Retrieve the most recent successful scan completion date for delta logic.
     */
    _getLastScanDate: function(tableName, scanType) {
        if (scanType !== "incremental") return null;
        var gr = new GlideRecord("x_adis_scan_run");
        gr.addQuery("status", "success");
        gr.addQuery("target_table", "CONTAINS", tableName);
        gr.orderByDesc("completed");
        gr.setLimit(1);
        gr.query();
        if (gr.next()) {
            return gr.getValue("completed");
        }
        return null;
    },

    /**
     * Persist a single finding to x_adis_finding.
     */
    _createFinding: function(rule, tableName, recordSysId, recordName, matchCount, snippet) {
        var gr = new GlideRecord("x_adis_finding");
        gr.initialize();
        gr.setValue("scan_run",       this._scanRun.getValue("sys_id"));
        gr.setValue("rule",           rule.id);
        gr.setValue("rule_name",      rule.name);
        gr.setValue("category",       rule.category);
        gr.setValue("severity",       rule.severity);
        gr.setValue("target_table",   tableName);
        gr.setValue("target_record",  recordSysId);
        gr.setValue("record_name",    recordName);
        gr.setValue("match_count",    matchCount);
        gr.setValue("code_snippet",   snippet);
        gr.setValue("replacement_hint", rule.replacement);
        gr.setValue("documentation_url", rule.docs);
        gr.setValue("status",         "open");
        gr.insert();
        this._findingCount++;
    },

    /**
     * Finalize the scan run (success or error).
     */
    _finalizeScan: function(status, message) {
        var gr = new GlideRecord("x_adis_scan_run");
        if (gr.get(this._scanRun.getValue("sys_id"))) {
            gr.setValue("status",    status);
            gr.setValue("completed", new GlideDateTime());
            gr.setValue("duration_sec", this._elapsedSeconds());
            gr.setValue("records_scanned", this._scannedRecords);
            gr.setValue("findings_count", this._findingCount);
            gr.setValue("message",   message);
            gr.update();
        }
        gs.info("[ADIS] Scan " + status + ": " + message);
    },

    _elapsedSeconds: function() {
        var now = new GlideDateTime();
        return GlideDateTime.subtract(this._startTime, now).getNumericValue() / 1000;
    },

    /**
     * Public: return the number of findings from the last scan.
     */
    getLastFindingCount: function() {
        return this._findingCount;
    },

    type: "ADISScanner"
};
