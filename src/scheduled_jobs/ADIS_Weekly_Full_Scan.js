/** 
 * @copyright Copyright (C) 2026 Vladimir Kapustin
 * @license   AGPL-3.0-or-later
 * @scope     x_adis
 * @description Scheduled Job: Weekly Full Scan
 * Trigger: Every Sunday 02:00 local.
 */

(function execute() {
    var enabled = gs.getProperty('x_adis.properties.weekly_scan_enabled', 'true');
    if (enabled !== 'true') {
        gs.info('[ADIS] Weekly full scan is disabled via x_adis.properties.weekly_scan_enabled');
        return;
    }
    
    var scanner = new ADISScanner();
    var targetReleases = (gs.getProperty('x_adis.properties.target_releases', 'Australia,Zurich') || 'Australia,Zurich').split(',');
    var scanId = scanner.runFullScan(targetReleases);
    gs.info('[ADIS] Weekly full scan completed: ' + scanId);
})();
