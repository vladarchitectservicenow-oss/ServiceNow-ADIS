/** 
 * @copyright Copyright (C) 2026 Vladimir Kapustin
 * @license   AGPL-3.0-or-later
 * @scope     x_adis
 * @description Business Rule: After insert of x_adis_deprecation_rule — validate regex.
 * Condition: current.active.changesTo(true) || current.isNewRecord()
 * When: after
 * Insert: true
 * Update: true
 * Filter: active=true
 */

(function executeRule(current, previous) {
    var engine = new ADISRuleEngine();
    var result = engine.validateRuleRegex(current.regex_pattern.toString());
    if (!result.valid) {
        gs.addErrorMessage('Invalid regex pattern: ' + result.error);
        current.setAbortAction(true);
    }
})(current, previous);
