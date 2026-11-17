mod apply;
mod records;

use nanoid::nanoid;
use rusqlite::{params, Connection};

use crate::error::{AppError, AppResult};

/// Bind a local collection to one account and journal the existing data once.
/// The binding and seed are atomic: a crash cannot leave a partially seeded
/// collection marked as enabled. Switching accounts needs an explicit future
/// disconnect/reset flow; silently uploading the previous user's data is unsafe.
pub(crate) fn enable_sync(connection: &mut Connection, account_uid: &str) -> AppResult<()> {
    if account_uid.is_empty() || account_uid.len() > 128 {
        return Err(AppError::validation("Invalid sync account."));
    }
    let transaction = connection.transaction()?;
    let (enabled, current): (bool, Option<String>) = transaction.query_row(
        "SELECT enabled, account_uid FROM sync_control WHERE id = 1",
        [],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    if current.as_deref().is_some_and(|uid| uid != account_uid) {
        return Err(AppError::validation(
            "This collection is already linked to another sync account.",
        ));
    }
    if !enabled {
        transaction.execute(
            "UPDATE sync_control SET device_id = COALESCE(device_id, ?1) WHERE id = 1",
            [nanoid!(21)],
        )?;
        transaction.execute_batch(
            "INSERT INTO sync_outbox (entity, entity_id, deleted, logical_clock) SELECT 'spaces', id, 0, max(1, updated_at * 1000) FROM spaces;
             INSERT INTO sync_outbox (entity, entity_id, deleted, logical_clock) SELECT 'cards', id, 0, max(1, updated_at * 1000) FROM cards;
             INSERT INTO sync_outbox (entity, entity_id, deleted, logical_clock) SELECT 'review_logs', id, 0, max(1, review_time * 1000) FROM review_logs;
             INSERT INTO sync_outbox (entity, entity_id, deleted) SELECT 'study_days', json_array(space_id, day), 0 FROM study_days;
             INSERT INTO sync_outbox (entity, entity_id, deleted) SELECT 'card_images', id, 0 FROM card_images;
             INSERT INTO sync_outbox (entity, entity_id, deleted) SELECT 'settings', key, 0 FROM settings WHERE key = 'study.new_cards_limit';",
        )?;
        transaction.execute(
            "UPDATE sync_control SET enabled = 1, account_uid = ?1 WHERE id = 1",
            params![account_uid],
        )?;
    }
    transaction.commit()?;
    Ok(())
}

pub(crate) use apply::apply;
pub(crate) use records::{acknowledge, pending, SyncRecord};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LocalSyncStatus {
    enabled: bool,
    account_uid: Option<String>,
    pending_count: i64,
}

pub(crate) fn status(connection: &Connection) -> AppResult<LocalSyncStatus> {
    Ok(connection.query_row(
        "SELECT enabled, account_uid, (SELECT count(DISTINCT entity || char(0) || entity_id) FROM sync_outbox) FROM sync_control WHERE id = 1",
        [],
        |row| Ok(LocalSyncStatus { enabled: row.get(0)?, account_uid: row.get(1)?, pending_count: row.get(2)? }),
    )?)
}
