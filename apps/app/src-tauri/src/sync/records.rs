use base64::{engine::general_purpose::STANDARD, Engine};
use rusqlite::{params, types::ValueRef, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::error::{AppError, AppResult};

/// A complete row at the journal's latest sequence, or a deletion tombstone.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SyncRecord {
    pub(crate) entity: String,
    pub(crate) entity_id: String,
    pub(crate) logical_clock: i64,
    pub(crate) device_id: String,
    pub(crate) deleted: bool,
    pub(crate) payload: Option<Value>,
    #[serde(default)]
    pub(crate) sequence: i64,
}

const MAX_BATCH: i64 = 50;

fn table_query(entity: &str) -> Option<&'static str> {
    match entity {
        "spaces" => Some("SELECT * FROM spaces WHERE id = ?1"),
        "cards" => Some("SELECT * FROM cards WHERE id = ?1"),
        "review_logs" => Some("SELECT * FROM review_logs WHERE id = ?1"),
        "card_images" => Some("SELECT * FROM card_images WHERE id = ?1"),
        "study_days" => Some("SELECT * FROM study_days WHERE json_array(space_id, day) = ?1"),
        "settings" => {
            Some("SELECT * FROM settings WHERE key = ?1 AND key = 'study.new_cards_limit'")
        }
        _ => None,
    }
}

fn read_payload(connection: &Connection, entity: &str, id: &str) -> AppResult<Option<Value>> {
    let sql = table_query(entity).ok_or_else(|| AppError::validation("Unknown sync entity."))?;
    let mut statement = connection.prepare(sql)?;
    let columns: Vec<String> = statement
        .column_names()
        .iter()
        .map(|name| (*name).into())
        .collect();
    statement
        .query_row([id], |row| {
            let mut object = Map::new();
            for (index, column) in columns.iter().enumerate() {
                let value = match row.get_ref(index)? {
                    ValueRef::Null => Value::Null,
                    ValueRef::Integer(value) => Value::from(value),
                    ValueRef::Real(value) => Value::from(value),
                    ValueRef::Text(value) => {
                        Value::String(String::from_utf8_lossy(value).into_owned())
                    }
                    ValueRef::Blob(value) => Value::String(STANDARD.encode(value)),
                };
                object.insert(column.clone(), value);
            }
            Ok(Value::Object(object))
        })
        .optional()
        .map_err(Into::into)
}

pub(crate) fn pending(connection: &mut Connection, uid: &str) -> AppResult<Vec<SyncRecord>> {
    let tx = connection.transaction()?;
    ensure_account(&tx, uid)?;
    // The read transaction gives the rows and their sequence a consistent view;
    // later edits get higher sequences and cannot be acknowledged accidentally.
    let mut statement = tx.prepare(
        "SELECT o.entity, o.entity_id, o.logical_clock, v.device_id, o.deleted, o.sequence
         FROM sync_outbox o
         JOIN sync_versions v ON v.entity = o.entity AND v.entity_id = o.entity_id
         WHERE o.sequence = (SELECT MAX(s.sequence) FROM sync_outbox s WHERE s.entity = o.entity AND s.entity_id = o.entity_id)
         ORDER BY CASE o.entity WHEN 'spaces' THEN 0 WHEN 'card_images' THEN 1 WHEN 'cards' THEN 2 WHEN 'review_logs' THEN 3 WHEN 'study_days' THEN 4 ELSE 5 END, o.sequence
         LIMIT ?1",
    )?;
    let rows = statement.query_map([MAX_BATCH], |row| {
        Ok(SyncRecord {
            entity: row.get(0)?,
            entity_id: row.get(1)?,
            logical_clock: row.get(2)?,
            device_id: row.get(3)?,
            deleted: row.get(4)?,
            sequence: row.get(5)?,
            payload: None,
        })
    })?;
    let mut records = rows.collect::<rusqlite::Result<Vec<_>>>()?;
    drop(statement);
    for record in &mut records {
        if !record.deleted {
            record.payload = read_payload(&tx, &record.entity, &record.entity_id)?;
            if record.payload.is_none() {
                return Err(AppError::storage_message(
                    "A pending sync record is missing its local data.",
                ));
            }
        }
    }
    tx.commit()?;
    Ok(records)
}

pub(crate) fn acknowledge(
    connection: &mut Connection,
    uid: &str,
    record: &SyncRecord,
) -> AppResult<()> {
    let tx = connection.transaction()?;
    ensure_account(&tx, uid)?;
    tx.execute(
        "DELETE FROM sync_outbox WHERE entity = ?1 AND entity_id = ?2 AND sequence <= ?3",
        params![record.entity, record.entity_id, record.sequence],
    )?;
    tx.commit()?;
    Ok(())
}

pub(super) fn ensure_account(connection: &Connection, uid: &str) -> AppResult<()> {
    let matches: bool = connection.query_row(
        "SELECT enabled = 1 AND account_uid = ?1 FROM sync_control WHERE id = 1",
        [uid],
        |row| row.get(0),
    )?;
    if matches {
        Ok(())
    } else {
        Err(AppError::validation(
            "Sync is not enabled for this account.",
        ))
    }
}
