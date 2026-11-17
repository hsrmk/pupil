use rusqlite::params;

use super::support::{open_test_connection, seed_card, seed_space, TEST_NOW};

#[test]
fn records_card_changes_and_deletion() {
    let db = open_test_connection();
    db.execute("UPDATE sync_control SET enabled = 1 WHERE id = 1", [])
        .unwrap();
    seed_space(&db, "space", "Study", TEST_NOW);
    seed_card(
        &db, "card", "space", "front", "back", 0, TEST_NOW, false, TEST_NOW,
    );
    db.execute("UPDATE cards SET front = 'new' WHERE id = 'card'", [])
        .unwrap();
    db.execute("DELETE FROM cards WHERE id = 'card'", [])
        .unwrap();
    let mut query = db.prepare("SELECT deleted FROM sync_outbox WHERE entity = 'cards' AND entity_id = 'card' ORDER BY sequence").unwrap();
    let events: Vec<i64> = query
        .query_map([], |row| row.get(0))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    assert_eq!(events, vec![0, 0, 1]);
}

#[test]
fn remote_changes_are_not_requeued() {
    let mut db = open_test_connection();
    db.execute("UPDATE sync_control SET enabled = 1 WHERE id = 1", [])
        .unwrap();
    let tx = db.transaction().unwrap();
    tx.execute(
        "UPDATE sync_control SET applying_remote = 1 WHERE id = 1",
        [],
    )
    .unwrap();
    tx.execute(
        "INSERT INTO spaces (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
        params!["remote", "Remote", TEST_NOW],
    )
    .unwrap();
    tx.execute(
        "UPDATE sync_control SET applying_remote = 0 WHERE id = 1",
        [],
    )
    .unwrap();
    tx.commit().unwrap();
    let count: i64 = db
        .query_row("SELECT count(*) FROM sync_outbox", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 0);
}

#[test]
fn private_settings_are_not_queued() {
    let db = open_test_connection();
    db.execute("UPDATE sync_control SET enabled = 1 WHERE id = 1", [])
        .unwrap();
    db.execute(
        "INSERT INTO settings (key, value) VALUES ('ai.secret', 'private')",
        [],
    )
    .unwrap();
    db.execute(
        "INSERT INTO settings (key, value) VALUES ('study.new_cards_limit', '10')",
        [],
    )
    .unwrap();
    let count: i64 = db
        .query_row(
            "SELECT count(*) FROM sync_outbox WHERE entity = 'settings'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(count, 1);
}
