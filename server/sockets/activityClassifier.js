const VIOLATION_ACTIVITIES = new Set([
  'tab_switch',
  'focus_lost',
  'right_click_attempt',
  'f12_attempt',
  'alt_tab_attempt',
  'print_screen_attempt',
  'fullscreen_exit',
  'fullscreen_failed'
]);

function isViolation(activity) {
  if (VIOLATION_ACTIVITIES.has(activity)) {
    return true;
  }
  return typeof activity === 'string' && activity.startsWith('blocked_shortcut_');
}

module.exports = { isViolation };
