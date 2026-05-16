/** 
 * @copyright Copyright (C) 2026 Vladimir Kapustin
 * @license   AGPL-3.0-or-later
 * @scope     x_adis
 * @description Scheduled Job: Nightly Incremental Scan
 * Trigger: Every day 03:00 local.
 */

(function execute() {
    var enabled = gs.getProperty('x_adis.properties.nightly_scan_enabled', 'true');
    if (enabled !== 'true') {
        gs.info('[ADIS] Nightly incremental scan is disabled via x_adis.properties.nightly_scan_enabled');
        return;
    }
    
    var lastId = gs.getProperty('x_adis.properties.last_scan_run_id', '');
    if (!lastId) {
        gs.info('[ADIS] No previous scan run found. Running full scan instead.');
        var scanner = new ADISScanner();
        var targetReleases = (gs.getProperty('x_adis.properties.target_releases', 'Australia,Zurich') || 'Australia,Zurich').split(',');
        scanId = scanner.runFullScan(targetReleases);
        gs.info('[ADIS] Full scan completed (fallback): ' + scanId);
        return;
    }
    
    var scanner = new ADISScanner();
    var scanId = scanner.runIncrementalScan(lastId);
    gs.info('[ADIS] Nightly incremental scan completed: ' + scanId);
})();
