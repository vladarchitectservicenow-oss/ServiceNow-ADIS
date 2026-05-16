/**
 * Copyright (c) 2026 Vladimir Kapustin
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * ADISRuleRegistry — Seeded deprecation rules for Zurich to Australia.
 * Rules are stored as application data so customers can extend without upgrading.
 */

var ADISRuleRegistry = Class.create();

ADISRuleRegistry.SOURCE_RELEASE = "Zurich";
ADISRuleRegistry.TARGET_RELEASE  = "Australia";

ADISRuleRegistry.prototype = {
    initialize: function() {
        this._rules = {};
        this._loadRulesFromTable();
    },

    /**
     * Load active rules from x_adis_deprecation_rule.
     * Falls back to seeded defaults if table is empty (first install).
     */
    _loadRulesFromTable: function() {
        var gr = new GlideRecord("x_adis_deprecation_rule");
        gr.addActiveQuery();
        gr.addQuery("affected_release", "CONTAINS", "Australia");
        gr.query();
        var count = 0;
        while (gr.next()) {
            this._registerRuleFromGR(gr);
            count++;
        }
        if (count === 0) {
            this._seedDefaults();
        }
    },

    _registerRuleFromGR: function(gr) {
        var id = gr.getValue("sys_id");
        this._rules[id] = {
            id:          id,
            name:        gr.getValue("name"),
            category:    gr.getValue("category"),
            severity:    gr.getValue("severity"),
            regex:       new RegExp(gr.getValue("regex_pattern"), "gm"),
            replacement: gr.getValue("replacement_hint"),
            docs:        gr.getValue("documentation_url"),
            release:     gr.getValue("affected_release")
        };
    },

    /**
     * Seed default rules on first install.
     * This method is idempotent — safe to call multiple times.
     */
    _seedDefaults: function() {
        var defaults = this._getDefaultRules();
        var seeded = 0;
        for (var i = 0; i < defaults.length; i++) {
            var def = defaults[i];
            if (!this._ruleExistsByRegex(def.regex_pattern)) {
                this._insertRule(def);
                seeded++;
            }
        }
        if (seeded > 0) {
            gs.info("[ADIS] Seeded " + seeded + " default deprecation rules for " + this.TARGET_RELEASE);
        }
        this._loadRulesFromTable(); // rehydrate
    },

    _ruleExistsByRegex: function(pattern) {
        var gr = new GlideRecord("x_adis_deprecation_rule");
        gr.addQuery("regex_pattern", pattern);
        gr.query();
        return gr.hasNext();
    },

    _insertRule: function(def) {
        var gr = new GlideRecord("x_adis_deprecation_rule");
        gr.initialize();
        gr.setValue("name",            def.name);
        gr.setValue("category",        def.category);
        gr.setValue("severity",        def.severity);
        gr.setValue("regex_pattern",   def.regex_pattern);
        gr.setValue("replacement_hint",def.replacement_hint);
        gr.setValue("documentation_url",def.documentation_url);
        gr.setValue("affected_release",def.affected_release);
        gr.setValue("active",          true);
        gr.insert();
    },

    /**
     * Get all active rules keyed by sys_id.
     */
    getRules: function() {
        return this._rules;
    },

    /**
     * Return an array of rules filtered by category.
     */
    getRulesByCategory: function(category) {
        var out = [];
        for (var key in this._rules) {
            if (this._rules[key].category === category) {
                out.push(this._rules[key]);
            }
        }
        return out;
    },

    /**
     * Return an array of rules filtered by severity.
     */
    getRulesBySeverity: function(severity) {
        var out = [];
        for (var key in this._rules) {
            if (this._rules[key].severity === severity) {
                out.push(this._rules[key]);
            }
        }
        return out;
    },

    /**
     * Return the raw JSON array of default rules.
     * Kept as a method so tests can inspect expected data without DB state.
     */
    _getDefaultRules: function() {
        return [
            {
                name: "GlideElementDynamicAttribute Removed",
                category: "Removed API",
                severity: "Critical",
                regex_pattern: "new\\s+GlideElementDynamicAttribute",
                replacement_hint: "Use typed GlideElement instances corresponding to the attribute's concrete field type.",
                documentation_url: "https://docs.servicenow.com/australia/api-reference/GlideElementDynamicAttribute",
                affected_release: "Zurich to Australia"
            },
            {
                name: "glide.login.no_blank_password Deprecated",
                category: "Deprecated Property",
                severity: "Medium",
                regex_pattern: "glide\\.login\\.no_blank_password",
                replacement_hint: "Property no longer functional. Remove references and rely on default password policy.",
                documentation_url: "https://docs.servicenow.com/australia/authentication",
                affected_release: "Zurich to Australia"
            },
            {
                name: "OAuth API Endpoint for External Clients Deprecated",
                category: "Deprecated Auth",
                severity: "High",
                regex_pattern: "oauth\\.sp\\.oauth_token\\.ext_script",
                replacement_hint: "Migrate to Machine Identity Console inbound integration configuration.",
                documentation_url: "https://docs.servicenow.com/australia/machine-identity",
                affected_release: "Zurich to Australia"
            },
            {
                name: "Legacy UI11 UI15 Detected",
                category: "Deprecated UI",
                severity: "Medium",
                regex_pattern: "ui11|ui15|ui\\.11|ui\\.15",
                replacement_hint: "Migrate to Next Experience (UI Builder / Configurable Workspaces).",
                documentation_url: "https://docs.servicenow.com/australia/next-experience-adoption",
                affected_release: "Zurich to Australia"
            },
            {
                name: "Agent Workspace Legacy Reference",
                category: "Deprecated UI",
                severity: "Medium",
                regex_pattern: "agent_workspace|agent\\s+workspace",
                replacement_hint: "Use Configurable Workspaces or Service Operations Workspace.",
                documentation_url: "https://docs.servicenow.com/australia/service-operations-workspace",
                affected_release: "Zurich to Australia"
            },
            {
                name: "Document Intelligence Standalone Deprecated",
                category: "Deprecated AI",
                severity: "High",
                regex_pattern: "document_intelligence|sn_docintel|DocumentIntelligence",
                replacement_hint: "Use Now Assist in Document Intelligence instead.",
                documentation_url: "https://docs.servicenow.com/australia/now-assist-document-intelligence",
                affected_release: "Zurich to Australia"
            },
            {
                name: "Alert Clustering Definitions Deprecated",
                category: "Deprecated AI",
                severity: "High",
                regex_pattern: "alert_clustering|AlertClusteringDefinition",
                replacement_hint: "Migrate to Alert Automation in Service Operations Workspace.",
                documentation_url: "https://docs.servicenow.com/australia/alert-automation",
                affected_release: "Zurich to Australia"
            },
            {
                name: "Data Generation Profiles Removed",
                category: "Deprecated Platform",
                severity: "Critical",
                regex_pattern: "data_generation_profile|sn_dt_data_gen|sandbox_data_gen",
                replacement_hint: "Use Now Assist Data Kit for sandbox data generation.",
                documentation_url: "https://docs.servicenow.com/australia/developer-sandboxes",
                affected_release: "Zurich to Australia"
            },
            {
                name: "Cloud Discovery Workspace Deprecated",
                category: "Deprecated ITOM",
                severity: "Medium",
                regex_pattern: "cloud_discovery_workspace|sn_cmp_workspace",
                replacement_hint: "Use Discovery Admin Workspace.",
                documentation_url: "https://docs.servicenow.com/australia/discovery-admin-workspace",
                affected_release: "Zurich to Australia"
            },
            {
                name: "Legacy Clone Request Forms Removed",
                category: "Deprecated Platform",
                severity: "Low",
                regex_pattern: "clone_request_legacy|sys_clone_request_legacy",
                replacement_hint: "Use the new Clone Admin Console request page.",
                documentation_url: "https://docs.servicenow.com/australia/clone-admin-console",
                affected_release: "Zurich to Australia"
            }
        ];
    },

    type: "ADISRuleRegistry"
};
