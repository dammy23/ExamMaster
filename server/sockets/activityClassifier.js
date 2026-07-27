const HIGH_SEVERITY_ACTIVITIES = new Set([
  'tab_switch',
  'focus_lost',
  'right_click_attempt',
  'f12_attempt',
  'alt_tab_attempt',
  'print_screen_attempt',
  'fullscreen_exit',
  'fullscreen_failed',
  'multi_monitor_detected',
  'devtools_open_detected'
]);

const MEDIUM_SEVERITY_ACTIVITIES = new Set([
  'vm_indicator_detected',
  'suspicious_extension_detected'
]);

function classifyActivity(activity) {
  const isBlockedShortcut = typeof activity === 'string' && activity.startsWith('blocked_shortcut_');

  if (HIGH_SEVERITY_ACTIVITIES.has(activity) || isBlockedShortcut) {
    return { isViolation: true, severity: 'high' };
  }
  if (MEDIUM_SEVERITY_ACTIVITIES.has(activity)) {
    return { isViolation: true, severity: 'medium' };
  }
  return { isViolation: false, severity: undefined };
}

module.exports = { classifyActivity };
