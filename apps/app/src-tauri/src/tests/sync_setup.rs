use super::support::{open_test_connection, seed_card, seed_space, TEST_NOW};
use crate::sync::enable_sync;

#[test]
fn enabling_sync_seeds_existing_data_once_and_tracks_later_edits() {
    let mut db = open_test_connection();
    seed_space(&db, "space", "Study", TEST_NOW);
    seed_card(
        &db, "card", "space", "front", "back", 0, TEST_NOW, false, TEST_NOW,
    );
    enable_sync(&mut db, "user-a").unwrap();
    enable_sync(&mut db, "user-a").unwrap();
    let count: i64 = db
        .query_row("SELECT count(*) FROM sync_outbox", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 2);
    db.execute("DELETE FROM cards WHERE id = 'card'", [])
        .unwrap();
    let deleted: i64 = db
        .query_row(
            "SELECT count(*) FROM sync_outbox WHERE entity = 'cards' AND deleted = 1",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(deleted, 1);
}

#[test]
fn another_account_cannot_take_over_a_bound_collection() {
    let mut db = open_test_connection();
    enable_sync(&mut db, "user-a").unwrap();
    assert!(enable_sync(&mut db, "user-b").is_err());
    let uid: String = db
        .query_row(
            "SELECT account_uid FROM sync_control WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(uid, "user-a");
}
