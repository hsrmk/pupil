use serde_json::json;

use super::support::{open_test_connection, seed_card, seed_space, TEST_NOW};
use crate::sync::{apply, enable_sync, pending, SyncRecord};

fn remote_space(id: &str, name: &str, clock: i64) -> SyncRecord {
    SyncRecord {
        entity: "spaces".into(),
        entity_id: id.into(),
        logical_clock: clock,
        device_id: "other-device".into(),
        deleted: false,
        sequence: 0,
        payload: Some(
            json!({"id": id, "name": name, "created_at": TEST_NOW, "updated_at": TEST_NOW}),
        ),
    }
}

#[test]
fn newer_remote_record_replaces_local_and_clears_obsolete_journal() {
    let mut db = open_test_connection();
    seed_space(&db, "space", "Local", TEST_NOW);
    enable_sync(&mut db, "user-a").unwrap();
    let record = remote_space("space", "Remote", TEST_NOW * 1000 + 10);
    assert!(apply(&mut db, "user-a", &record).unwrap());
    let name: String = db
        .query_row("SELECT name FROM spaces WHERE id = 'space'", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(name, "Remote");
    assert!(pending(&mut db, "user-a").unwrap().is_empty());
    assert!(!apply(&mut db, "user-a", &record).unwrap());
}

#[test]
fn older_remote_record_does_not_override_offline_edit() {
    let mut db = open_test_connection();
    seed_space(&db, "space", "Local", TEST_NOW);
    enable_sync(&mut db, "user-a").unwrap();
    let record = remote_space("space", "Old remote", TEST_NOW * 1000 - 1);
    assert!(!apply(&mut db, "user-a", &record).unwrap());
    assert_eq!(
        pending(&mut db, "user-a").unwrap()[0]
            .payload
            .as_ref()
            .unwrap()["name"],
        "Local"
    );
}

#[test]
fn duplicate_names_keep_both_spaces_and_queue_the_deterministic_rename() {
    let mut db = open_test_connection();
    seed_space(&db, "z-space", "Biology", TEST_NOW);
    enable_sync(&mut db, "user-a").unwrap();
    assert!(apply(
        &mut db,
        "user-a",
        &remote_space("a-space", "Biology", TEST_NOW * 1000 + 1)
    )
    .unwrap());
    let names: Vec<String> = db
        .prepare("SELECT name FROM spaces ORDER BY id")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    assert_eq!(names, ["Biology", "Biology (z-space)"]);
    let renamed = pending(&mut db, "user-a")
        .unwrap()
        .into_iter()
        .find(|r| r.entity_id == "z-space")
        .unwrap();
    assert_eq!(renamed.payload.unwrap()["name"], "Biology (z-space)");
}

#[test]
fn parent_deletion_does_not_cascade_away_a_newer_child_edit() {
    let mut db = open_test_connection();
    seed_space(&db, "space", "Study", TEST_NOW);
    seed_card(
        &db, "card", "space", "front", "back", 0, TEST_NOW, false, TEST_NOW,
    );
    enable_sync(&mut db, "user-a").unwrap();
    db.execute("UPDATE cards SET front = 'New work' WHERE id = 'card'", [])
        .unwrap();
    let child_clock: i64 = db
        .query_row(
            "SELECT logical_clock FROM sync_versions WHERE entity='cards' AND entity_id='card'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    let mut deletion = remote_space("space", "Study", child_clock - 1);
    deletion.deleted = true;
    deletion.payload = None;
    assert!(apply(&mut db, "user-a", &deletion).unwrap());
    let front: String = db
        .query_row("SELECT front FROM cards WHERE id='card'", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(front, "New work");
    let space = pending(&mut db, "user-a")
        .unwrap()
        .into_iter()
        .find(|r| r.entity == "spaces")
        .unwrap();
    assert!(space.logical_clock > deletion.logical_clock);
}

#[test]
fn invalid_remote_data_leaves_database_and_journal_unchanged() {
    let mut db = open_test_connection();
    seed_space(&db, "space", "Local", TEST_NOW);
    enable_sync(&mut db, "user-a").unwrap();
    let mut record = remote_space("space", "Remote", TEST_NOW * 1000 + 1);
    record.payload.as_mut().unwrap()["unexpected"] = json!(true);
    assert!(apply(&mut db, "user-a", &record).is_err());
    assert_eq!(
        pending(&mut db, "user-a").unwrap()[0]
            .payload
            .as_ref()
            .unwrap()["name"],
        "Local"
    );
}

#[test]
fn missing_parent_rolls_back_apply_and_does_not_disable_journaling() {
    let mut source = open_test_connection();
    seed_space(&source, "space", "Study", TEST_NOW);
    seed_card(
        &source, "card", "space", "front", "back", 0, TEST_NOW, false, TEST_NOW,
    );
    enable_sync(&mut source, "user-a").unwrap();
    let card = pending(&mut source, "user-a")
        .unwrap()
        .into_iter()
        .find(|r| r.entity == "cards")
        .unwrap();
    let mut target = open_test_connection();
    target.execute_batch("PRAGMA foreign_keys = ON").unwrap();
    enable_sync(&mut target, "user-a").unwrap();
    assert!(apply(&mut target, "user-a", &card).is_err());
    seed_space(&target, "new", "New", TEST_NOW);
    assert_eq!(pending(&mut target, "user-a").unwrap().len(), 1);
}

#[test]
fn image_round_trips_through_the_sync_record() {
    let mut source = open_test_connection();
    source
        .execute(
            "INSERT INTO card_images (id, mime_type, data) VALUES ('image', 'image/png', ?1)",
            [b"\x89PNG\r\n\x1a\nexample".as_slice()],
        )
        .unwrap();
    enable_sync(&mut source, "user-a").unwrap();
    let image = pending(&mut source, "user-a")
        .unwrap()
        .into_iter()
        .find(|r| r.entity == "card_images")
        .unwrap();
    let mut target = open_test_connection();
    enable_sync(&mut target, "user-a").unwrap();
    assert!(apply(&mut target, "user-a", &image).unwrap());
    let bytes: Vec<u8> = target
        .query_row(
            "SELECT data FROM card_images WHERE id = 'image'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(bytes, b"\x89PNG\r\n\x1a\nexample");
}
