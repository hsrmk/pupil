use base64::{engine::general_purpose::STANDARD, Engine};

use crate::card_images::{load_image, save_image};
use crate::tests::support::open_test_connection;

#[test]
fn image_bytes_round_trip_through_the_database() {
    let connection = open_test_connection();
    let image = b"\x89PNG\r\n\x1a\nexample image bytes";
    let id = save_image(&connection, &STANDARD.encode(image)).unwrap();
    assert_eq!(
        load_image(&connection, &id).unwrap(),
        Some(format!("data:image/png;base64,{}", STANDARD.encode(image)))
    );
    assert_eq!(load_image(&connection, "missing").unwrap(), None);
}

#[test]
fn rejects_non_images_and_invalid_base64() {
    let connection = open_test_connection();
    assert!(save_image(&connection, &STANDARD.encode("<svg onload=alert(1)>")).is_err());
    assert!(save_image(&connection, "not base64!").is_err());
}
