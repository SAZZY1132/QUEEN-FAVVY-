// Per-session feature flags + defaults
export function defaultFlags(env) {
  return {
    autoChat: (env.DEFAULT_AUTO_CHAT || 'false') === 'true',
    antiCall: (env.DEFAULT_ANTI_CALL || 'true') === 'true',
    viewOnceBypass: (env.DEFAULT_VIEW_ONCE_BYPASS || 'true') === 'true',
    antiDelete: (env.DEFAULT_ANTI_DELETE || 'true') === 'true'
  };
}

export function normalizeFlags(flags) {
  return {
    autoChat: !!flags.autoChat,
    antiCall: !!flags.antiCall,
    viewOnceBypass: !!flags.viewOnceBypass,
    antiDelete: !!flags.antiDelete
  };
}