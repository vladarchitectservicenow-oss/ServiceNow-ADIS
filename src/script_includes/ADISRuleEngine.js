/** 
 * @copyright Copyright (C) 2026 Vladimir Kapustin
 * @license   AGPL-3.0-or-later
 * @file      ADISRuleEngine.js
 * @scope     x_adis
 * @description Deprecation rule loader, validator, and default rule seeding.
 */

var ADISRuleEngine = Class.create();
ADISRuleEngine.prototype = {
    initialize: function() {
        this.scope = 'x_adis';
        this._logLevel = gs.getProperty('x_adis.properties.log_level', 'info');
    },

    /**
     * Get active deprecation rules filtered by target releases and table.
     * @param {Array} targetReleases - e.g. ['Australia', 'Zurich']
     * @param {String} tableName - e.g. 'sys_script_include'
     * @return {Array} Array of rule objects with sys_id, regex_pattern, etc.
     */
    getActiveRules: function(targetReleases, tableName) {
        var rules = [];
        var gr = new GlideRecord('x_adis_deprecation_rule');
        gr.addQuery('active', true);
        
        var qc = gr.addQuery('target_release', 'IN', targetReleases);
        
        gr.addQuery('applies_to', 'CONTAINS', tableName);
        gr.orderBy('severity');
        gr.query();
        
        this._log('info', 'Loading rules for ' + tableName + ' / releases=' + targetReleases.join(',') + ' | count=' + gr.getRowCount());
        
        while (gr.next()) {
            rules.push({
                sys_id: gr.getValue('sys_id'),
                name: gr.getValue('name'),
                regex_pattern: gr.getValue('regex_pattern'),
                replacement_suggestion: gr.getValue('replacement_suggestion'),
                target_release: gr.getValue('target_release'),
                severity: gr.getValue('severity'),
                applies_to: gr.getValue('applies_to'),
                deprecated_item: gr.getValue('deprecated_item') || gr.getValue('name')
            });
        }
        
        return rules;
    },

    /**
     * Validate whether a regex pattern is syntactically valid.
     * @param {String} regexPattern
     * @return {Object} { valid: boolean, error: string|null }
     */
    validateRuleRegex: function(regexPattern) {
        var result = { valid: false, error: null };
        if (!regexPattern || regexPattern.length === 0) {
            result.error = 'Regex pattern is empty';
            return result;
        }
        try {
            var test = new RegExp(regexPattern);
            result.valid = true;
        } catch (e) {
            result.error = e.message;
        }
        return result;
    },

    /**
     * Import out-of-the-box deprecation rules for supported releases.
     * Idempotent: skips rules that already exist by name.
     */
    importDefaultRules: function() {
        var defaultRules = this._getDefaultRules();
        var created = 0;
        var skipped = 0;
        
        for (var i = 0; i < defaultRules.length; i++) {
            var rule = defaultRules[i];
            
            // Check if exists by name
            var existing = new GlideRecord('x_adis_deprecation_rule');
            existing.addQuery('name', rule.name);
            existing.query();
            if (existing.hasNext()) {
                skipped++;
                continue;
            }
            
            try {
                var gr = new GlideRecord('x_adis_deprecation_rule');
                gr.initialize();
                gr.name = rule.name;
                gr.active = true;
                gr.regex_pattern = rule.regex_pattern;
                gr.replacement_suggestion = rule.replacement_suggestion;
                gr.target_release = rule.target_release;
                gr.severity = rule.severity;
                gr.applies_to = rule.applies_to;
                gr.description = rule.description;
                gr.category = rule.category;
                gr.insert();
                created++;
            } catch (e) {
                this._log('error', 'Failed to insert rule "' + rule.name + '": ' + e.message);
            }
        }
        
        this._log('info', 'Default rules: created=' + created + ' skipped=' + skipped);
        return { created: created, skipped: skipped };
    },

    /**
     * Return the built-in deprecation rules.
     */
    _getDefaultRules: function() {
        return [
            {
                name: 'GlideElementDynamicAttribute Removal',
                regex_pattern: 'GlideElementDynamicAttribute',
                replacement_suggestion: 'Replace with typed GlideElement() constructors or GlideRecord field accessors.',
                target_release: 'Australia',
                severity: 'Critical',
                applies_to: 'sys_script_include,sys_script,sys_script_client,sys_ws_operation',
                description: 'GlideElementDynamicAttribute class was removed in Australia. Scripts referencing it will throw TypeError on execution.',
                category: 'Platform'
            },
            {
                name: 'eventQueue Deprecated',
                regex_pattern: '\\beventQueue\\s*\\(',
                replacement_suggestion: 'Use eventQueueScheduled() for scheduled asynchronous processing.',
                target_release: 'Australia',
                severity: 'Warning',
                applies_to: 'sys_script_include,sys_script,sys_script_client,sys_ws_operation',
                description: 'eventQueue() is deprecated in favor of eventQueueScheduled() for better asynchronous handling.',
                category: 'Platform'
            },
            {
                name: 'Legacy Document Intelligence API',
                regex_pattern: 'sn_document_intelligence',
                replacement_suggestion: 'Migrate to Now Assist in Document Intelligence (sn_nai_doc_intelligence) APIs.',
                target_release: 'Australia',
                severity: 'High',
                applies_to: 'sys_script_include,sys_script,sys_script_client,sys_ws_operation',
                description: 'Standalone Document Intelligence is deprecated as of Australia. Move to Now Assist in Document Intelligence.',
                category: 'AI'
            },
            {
                name: 'UI11 / UI15 Macro Reference',
                regex_pattern: 'ui11|ui15',
                replacement_suggestion: 'Migrate to Next Experience UI Builder components.',
                target_release: 'Australia',
                severity: 'Warning',
                applies_to: 'sys_ui_macro,sys_ui_page,sys_ui_section',
                description: 'Legacy UI11 and UI15 UI macros are deprecated. Next Experience is the mandatory path.',
                category: 'UI'
            },
            {
                name: 'glide.login.no_blank_password Property Deprecated',
                regex_pattern: 'glide\\.login\\.no_blank_password',
                replacement_suggestion: 'Remove references; this property has no functional effect in Australia.',
                target_release: 'Australia',
                severity: 'Info',
                applies_to: 'sys_properties',
                description: 'The glide.login.no_blank_password system property is deprecated and has no functional effect in Australia.',
                category: 'Security'
            },
            {
                name: 'Clone Admin Console Legacy',
                regex_pattern: 'sys_clone_admin_console',
                replacement_suggestion: 'Use the new clone request page; legacy forms redirect after 30 seconds and are unsupported.',
                target_release: 'Australia',
                severity: 'Warning',
                applies_to: 'sys_ui_module,sys_app_module',
                description: 'Legacy Clone Admin Console forms are deprecated. Only the new clone request page is supported.',
                category: 'Platform'
            },
            {
                name: 'Alert Clustering Definitions Deprecated',
                regex_pattern: 'sn_alert_clustering_def|acd_',
                replacement_suggestion: 'Migrate to Alert Automation in Service Operations Workspace (sn_sow_alert_automation).',
                target_release: 'Australia',
                severity: 'High',
                applies_to: 'sys_script_include,sys_script,sys_script_client',
                description: 'Alert Clustering Definitions (ACD) are fully deprecated and replaced by Alert Automation in SOW.',
                category: 'ITOM'
            },
            {
                name: 'Cloud Discovery Workspace Hidden',
                regex_pattern: 'sn_cloud_discovery_workspace',
                replacement_suggestion: 'Switch to Discovery Admin Workspace (sn_discovery_admin).',
                target_release: 'Australia',
                severity: 'Warning',
                applies_to: 'sys_app_module,sys_ui_module',
                description: 'Cloud Discovery Workspace is hidden on new instances; replaced by Discovery Admin Workspace.',
                category: 'ITOM'
            },
            {
                name: 'Legacy Application Manager Hidden',
                regex_pattern: 'sys_app_application_manager',
                replacement_suggestion: 'Use Application Administrator workspace or new App Manager.',
                target_release: 'Australia',
                severity: 'Warning',
                applies_to: 'sys_app_module,sys_ui_module',
                description: 'Legacy Application Manager deprecated as of Australia Patch 1.',
                category: 'Platform'
            }
        ];
    },

    _log: function(level, message) {
        var levels = { 'debug': 0, 'info': 1, 'warn': 2, 'error': 3 };
        var current = levels[gs.getProperty('x_adis.properties.log_level', 'info')] || 1;
        var msgLevel = levels[level] || 1;
        if (msgLevel < current) return;
        
        var prefix = '[ADIS-RuleEngine ' + level.toUpperCase() + ']';
        if (level === 'error') gs.error(prefix + ' ' + message);
        else if (level === 'warn') gs.warn(prefix + ' ' + message);
        else gs.info(prefix + ' ' + message);
    },

    type: 'ADISRuleEngine'
};
