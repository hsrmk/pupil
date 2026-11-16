pub(crate) const SPACE_NAME_MAX_LENGTH: usize = 80;
#[cfg(debug_assertions)]
pub(crate) const DEVELOPER_OPEN_DEVTOOLS_MENU_ID: &str = "developer.open_devtools";
#[cfg(debug_assertions)]
pub(crate) const DEVELOPER_RESET_ONBOARDING_MENU_ID: &str = "developer.reset_onboarding";
#[cfg(debug_assertions)]
pub(crate) const DEVELOPER_RESET_ONBOARDING_EVENT: &str = "developer://reset-onboarding";
pub(crate) const FRONTEND_LOG_MAX_MESSAGE_CHARS: usize = 2_000;
pub(crate) const FRONTEND_LOG_MAX_CONTEXT_CHARS: usize = 4_000;
pub(crate) const RECENT_ACTIVITY_SESSION_GAP_MS: i64 = 30 * 60 * 1000;
pub(crate) const RECENT_ACTIVITY_FETCH_MULTIPLIER: i64 = 50;
pub(crate) const MIN_RECENT_ACTIVITY_FETCH_LIMIT: i64 = 200;
pub(crate) const EXPLAIN_SCHEMA_VERSION: i64 = 1;
pub(crate) const EXPLAIN_MAX_PAYLOAD_BYTES: usize = 32_000;
pub(crate) const EXPLAIN_MAX_PARAGRAPHS: usize = 7;
pub(crate) const EXPLAIN_MAX_NODES: usize = 8;
pub(crate) const EXPLAIN_MAX_EDGES: usize = 10;
pub(crate) const EXPLAIN_MAX_LABEL_LENGTH: usize = 80;
