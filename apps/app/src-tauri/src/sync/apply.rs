use std::collections::BTreeSet;

use base64::{engine::general_purpose::STANDARD, Engine};
use rusqlite::{
    params, params_from_iter, types::Value as SqlValue, Connection, OptionalExtension, Transaction,
};
use serde_json::{Map, Value};

use super::records::{ensure_account, SyncRecord};
use crate::{
    error::{AppError, AppResult},
    util::now_ms,
};

#[derive(Clone, Copy)]
enum Kind {
    Text,
    OptionalText,
    Integer,
    OptionalInteger,
    Real,
    Blob,
}
use Kind::*;

fn columns(entity: &str) -> Option<&'static [(&'static str, Kind)]> {
    match entity {
        "spaces" => Some(&[
            ("id", Text),
            ("name", Text),
            ("created_at", Integer),
            ("updated_at", Integer),
        ]),
        "cards" => Some(&[
            ("id", Text),
            ("space_id", Text),
            ("front", Text),
            ("back", Text),
            ("tags", OptionalText),
            ("source", Text),
            ("state", Integer),
            ("due", Integer),
            ("stability", Real),
            ("difficulty", Real),
            ("elapsed_days", Integer),
            ("scheduled_days", Integer),
            ("reps", Integer),
            ("lapses", Integer),
            ("last_review", OptionalInteger),
            ("created_at", Integer),
            ("updated_at", Integer),
            ("learning_steps", Integer),
            ("is_suspended", Integer),
            ("explanation", OptionalText),
            ("explanation_generated_at", OptionalInteger),
            ("explanation_payload", OptionalText),
        ]),
        "review_logs" => Some(&[
            ("id", Text),
            ("card_id", Text),
            ("space_id", Text),
            ("grade", Integer),
            ("state", Integer),
            ("due", Integer),
            ("elapsed_days", OptionalInteger),
            ("scheduled_days", OptionalInteger),
            ("review_time", Integer),
        ]),
        "study_days" => Some(&[("space_id", OptionalText), ("day", Text)]),
        "card_images" => Some(&[("id", Text), ("mime_type", Text), ("data", Blob)]),
        "settings" => Some(&[("key", Text), ("value", Text)]),
        _ => None,
    }
}

fn invalid() -> AppError {
    AppError::validation("The remote sync record is invalid.")
}

fn checked_payload(record: &SyncRecord) -> AppResult<Option<Map<String, Value>>> {
    let expected = columns(&record.entity).ok_or_else(invalid)?;
    if record.entity_id.is_empty()
        || record.entity_id.len() > 512
        || record.logical_clock <= 0
        || record.logical_clock > 9_007_199_254_740_991
        || record.device_id.is_empty()
        || record.device_id.len() > 128
        || !record
            .device_id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return Err(invalid());
    }
    if record.deleted {
        if record.payload.is_some() {
            return Err(invalid());
        }
        if record.entity == "settings" && record.entity_id != "study.new_cards_limit" {
            return Err(invalid());
        }
        if record.entity == "study_days" {
            study_key(&record.entity_id)?;
        }
        return Ok(None);
    }
    let object = record
        .payload
        .as_ref()
        .and_then(Value::as_object)
        .ok_or_else(invalid)?;
    let keys: BTreeSet<_> = object.keys().map(String::as_str).collect();
    let expected_keys: BTreeSet<_> = expected.iter().map(|(name, _)| *name).collect();
    if keys != expected_keys {
        return Err(invalid());
    }
    for (key, kind) in expected {
        let v = &object[*key];
        let valid = match kind {
            Text => v.as_str().is_some_and(|s| s.len() <= 32 * 1024 * 1024),
            OptionalText => v.is_null() || v.as_str().is_some_and(|s| s.len() <= 32 * 1024 * 1024),
            Integer => v.as_i64().is_some(),
            OptionalInteger => v.is_null() || v.as_i64().is_some(),
            Real => v.as_f64().is_some_and(f64::is_finite),
            Blob => v.as_str().is_some_and(|s| s.len() <= 14 * 1024 * 1024),
        };
        if !valid {
            return Err(invalid());
        }
    }
    match record.entity.as_str() {
        "study_days" => {
            let (space, day) = study_key(&record.entity_id)?;
            if object["space_id"].as_str() != space.as_deref()
                || object["day"].as_str() != Some(day.as_str())
            {
                return Err(invalid());
            }
        }
        "settings" => {
            if record.entity_id != "study.new_cards_limit"
                || object["key"] != record.entity_id
                || object["value"]
                    .as_str()
                    .and_then(|s| s.parse::<i64>().ok())
                    .is_none_or(|n| n <= 0)
            {
                return Err(invalid());
            }
        }
        _ if object["id"] != record.entity_id => return Err(invalid()),
        _ => {}
    }
    if record.entity == "spaces" {
        let name = object["name"].as_str().ok_or_else(invalid)?;
        if name.trim() != name || name.is_empty() || name.chars().count() > 80 {
            return Err(invalid());
        }
    }
    if record.entity == "cards" {
        if object["front"].as_str().is_none_or(|s| s.trim().is_empty())
            || object["back"].as_str().is_none_or(|s| s.trim().is_empty())
            || !matches!(object["source"].as_str(), Some("manual" | "ai" | "anki"))
            || !matches!(object["state"].as_i64(), Some(0..=3))
            || !matches!(object["is_suspended"].as_i64(), Some(0..=1))
        {
            return Err(invalid());
        }
        if let Some(tags) = object["tags"].as_str() {
            let parsed: Vec<String> = serde_json::from_str(tags).map_err(|_| invalid())?;
            if parsed.len() > 100_000 {
                return Err(invalid());
            }
        }
        for key in [
            "due",
            "elapsed_days",
            "scheduled_days",
            "reps",
            "lapses",
            "created_at",
            "updated_at",
            "learning_steps",
        ] {
            if object[key].as_i64().is_none_or(|n| n < 0) {
                return Err(invalid());
            }
        }
        if object["stability"].as_f64().is_none_or(|n| n < 0.0)
            || object["difficulty"].as_f64().is_none_or(|n| n < 0.0)
        {
            return Err(invalid());
        }
    }
    if record.entity == "review_logs"
        && (!matches!(object["grade"].as_i64(), Some(1..=4))
            || !matches!(object["state"].as_i64(), Some(0..=3)))
    {
        return Err(invalid());
    }
    if record.entity == "card_images" {
        let bytes = STANDARD
            .decode(object["data"].as_str().ok_or_else(invalid)?)
            .map_err(|_| invalid())?;
        if bytes.len() > 10 * 1024 * 1024 {
            return Err(invalid());
        }
        let mime = object["mime_type"].as_str().ok_or_else(invalid)?;
        let good = match mime {
            "image/png" => bytes.starts_with(b"\x89PNG\r\n\x1a\n"),
            "image/jpeg" => bytes.starts_with(b"\xff\xd8\xff"),
            "image/gif" => bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a"),
            "image/webp" => bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP",
            _ => false,
        };
        if !good {
            return Err(invalid());
        }
    }
    Ok(Some(object.clone()))
}

fn study_key(id: &str) -> AppResult<(Option<String>, String)> {
    let (space, day): (Option<String>, String) = serde_json::from_str(id).map_err(|_| invalid())?;
    if day.len() != 10
        || space
            .as_ref()
            .is_some_and(|s| s.is_empty() || s.len() > 256)
    {
        return Err(invalid());
    }
    Ok((space, day))
}

fn sql_value(value: &Value, kind: Kind) -> AppResult<SqlValue> {
    if value.is_null() {
        return Ok(SqlValue::Null);
    }
    Ok(match kind {
        Text | OptionalText => SqlValue::Text(value.as_str().ok_or_else(invalid)?.to_owned()),
        Integer | OptionalInteger => SqlValue::Integer(value.as_i64().ok_or_else(invalid)?),
        Real => SqlValue::Real(value.as_f64().ok_or_else(invalid)?),
        Blob => SqlValue::Blob(
            STANDARD
                .decode(value.as_str().ok_or_else(invalid)?)
                .map_err(|_| invalid())?,
        ),
    })
}

fn put_row(
    tx: &Transaction<'_>,
    record: &SyncRecord,
    object: &Map<String, Value>,
) -> AppResult<()> {
    if record.entity == "study_days" {
        let (space, day) = study_key(&record.entity_id)?;
        tx.execute(
            "INSERT OR IGNORE INTO study_days (space_id, day) VALUES (?1, ?2)",
            params![space, day],
        )?;
        return Ok(());
    }
    let cols = columns(&record.entity).ok_or_else(invalid)?;
    let names: Vec<_> = cols.iter().map(|(name, _)| *name).collect();
    let key = if record.entity == "settings" {
        "key"
    } else {
        "id"
    };
    let assignments = names
        .iter()
        .filter(|name| **name != key)
        .map(|name| format!("{name} = excluded.{name}"))
        .collect::<Vec<_>>()
        .join(", ");
    let placeholders = (1..=cols.len())
        .map(|n| format!("?{n}"))
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "INSERT INTO {} ({}) VALUES ({}) ON CONFLICT({}) DO UPDATE SET {}",
        record.entity,
        names.join(", "),
        placeholders,
        key,
        assignments
    );
    let values = cols
        .iter()
        .map(|(name, kind)| sql_value(&object[*name], *kind))
        .collect::<AppResult<Vec<_>>>()?;
    tx.execute(&sql, params_from_iter(values))?;
    Ok(())
}

fn delete_row(tx: &Transaction<'_>, record: &SyncRecord) -> AppResult<()> {
    if record.entity == "study_days" {
        let (space, day) = study_key(&record.entity_id)?;
        tx.execute(
            "DELETE FROM study_days WHERE space_id IS ?1 AND day = ?2",
            params![space, day],
        )?;
    } else {
        let key = if record.entity == "settings" {
            "key"
        } else {
            "id"
        };
        tx.execute(
            &format!("DELETE FROM {} WHERE {key} = ?1", record.entity),
            [&record.entity_id],
        )?;
    }
    Ok(())
}

fn available_name(tx: &Transaction<'_>, name: &str, id: &str) -> AppResult<String> {
    for number in 0..10_000 {
        let suffix = if number == 0 {
            format!(" ({id})")
        } else {
            format!(" ({id}-{number})")
        };
        let prefix: String = name
            .chars()
            .take(80_usize.saturating_sub(suffix.chars().count()))
            .collect();
        let candidate = format!("{prefix}{suffix}");
        let exists: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM spaces WHERE lower(name) = lower(?1) AND id != ?2)",
            params![candidate, id],
            |row| row.get(0),
        )?;
        if !exists {
            return Ok(candidate);
        }
    }
    Err(AppError::storage_message(
        "Unable to resolve duplicate space names.",
    ))
}

/// Preserve both spaces, choosing the same unsuffixed ID on all devices.
fn resolve_space_name(
    tx: &Transaction<'_>,
    record: &SyncRecord,
    object: &mut Map<String, Value>,
) -> AppResult<Option<String>> {
    let name = object["name"].as_str().ok_or_else(invalid)?.to_owned();
    let other: Option<String> = tx
        .query_row(
            "SELECT id FROM spaces WHERE lower(name) = lower(?1) AND id != ?2",
            params![name, record.entity_id],
            |row| row.get(0),
        )
        .optional()?;
    let Some(other) = other else {
        return Ok(None);
    };
    if record.entity_id < other {
        let renamed = available_name(tx, &name, &other)?;
        tx.execute(
            "UPDATE spaces SET name = ?1, updated_at = ?2 WHERE id = ?3",
            params![renamed, now_ms(), other],
        )?;
        Ok(Some(other))
    } else {
        let renamed = available_name(tx, &name, &record.entity_id)?;
        object.insert("name".into(), Value::String(renamed));
        object.insert("updated_at".into(), Value::from(now_ms()));
        Ok(Some(record.entity_id.clone()))
    }
}

fn has_newer_child(tx: &Transaction<'_>, record: &SyncRecord) -> AppResult<bool> {
    let sql = match record.entity.as_str() {
        "spaces" => "SELECT EXISTS(SELECT 1 FROM cards c JOIN sync_versions v ON v.entity = 'cards' AND v.entity_id = c.id WHERE c.space_id = ?1 AND (v.logical_clock > ?2 OR (v.logical_clock = ?2 AND v.device_id > ?3)) UNION ALL SELECT 1 FROM study_days d JOIN sync_versions v ON v.entity = 'study_days' AND v.entity_id = json_array(d.space_id, d.day) WHERE d.space_id = ?1 AND (v.logical_clock > ?2 OR (v.logical_clock = ?2 AND v.device_id > ?3)))",
        "cards" => "SELECT EXISTS(SELECT 1 FROM review_logs r JOIN sync_versions v ON v.entity = 'review_logs' AND v.entity_id = r.id WHERE r.card_id = ?1 AND (v.logical_clock > ?2 OR (v.logical_clock = ?2 AND v.device_id > ?3)))",
        _ => return Ok(false),
    };
    Ok(tx.query_row(
        sql,
        params![record.entity_id, record.logical_clock, record.device_id],
        |row| row.get(0),
    )?)
}

/// Applies a single remote version atomically; older local versions are not
/// allowed to overwrite newer offline edits. Returns whether visible data changed.
pub(crate) fn apply(
    connection: &mut Connection,
    uid: &str,
    record: &SyncRecord,
) -> AppResult<bool> {
    let mut payload = checked_payload(record)?;
    let tx = connection.transaction()?;
    ensure_account(&tx, uid)?;
    let current: Option<(i64, String)> = tx.query_row("SELECT logical_clock, device_id FROM sync_versions WHERE entity = ?1 AND entity_id = ?2", params![record.entity, record.entity_id], |row| Ok((row.get(0)?, row.get(1)?))).optional()?;
    tx.execute(
        "UPDATE sync_control SET logical_clock = max(logical_clock, ?1) WHERE id = 1",
        [record.logical_clock],
    )?;
    if current.as_ref().is_some_and(|(clock, device)| {
        (*clock, device.as_str()) >= (record.logical_clock, record.device_id.as_str())
    }) {
        tx.commit()?;
        return Ok(false);
    }
    // A later child edit wins over an earlier parent deletion, preserving the
    // parent rather than cascading away newer local work.
    if record.deleted && has_newer_child(&tx, record)? {
        let table = if record.entity == "spaces" {
            "spaces"
        } else {
            "cards"
        };
        let changed = tx.execute(
            &format!("UPDATE {table} SET updated_at = ?1 WHERE id = ?2"),
            params![now_ms(), record.entity_id],
        )?;
        if changed > 0 {
            tx.commit()?;
            return Ok(true);
        }
    }
    tx.execute(
        "UPDATE sync_control SET applying_remote = 1 WHERE id = 1",
        [],
    )?;
    let mut renamed = None;
    if let Some(object) = payload.as_mut() {
        if record.entity == "spaces" {
            renamed = resolve_space_name(&tx, record, object)?;
        }
        put_row(&tx, record, object)?;
    } else {
        delete_row(&tx, record)?;
    }
    tx.execute("INSERT INTO sync_versions (entity, entity_id, logical_clock, device_id) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(entity, entity_id) DO UPDATE SET logical_clock = excluded.logical_clock, device_id = excluded.device_id", params![record.entity, record.entity_id, record.logical_clock, record.device_id])?;
    tx.execute(
        "DELETE FROM sync_outbox WHERE entity = ?1 AND entity_id = ?2",
        params![record.entity, record.entity_id],
    )?;
    tx.execute(
        "UPDATE sync_control SET applying_remote = 0 WHERE id = 1",
        [],
    )?;
    if let Some(id) = renamed {
        tx.execute(
            "INSERT INTO sync_outbox (entity, entity_id, deleted) VALUES ('spaces', ?1, 0)",
            [id],
        )?;
    }
    tx.commit()?;
    Ok(true)
}
