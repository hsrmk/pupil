use base64::{engine::general_purpose::STANDARD, Engine};
use nanoid::nanoid;
use rusqlite::{params, Connection, OptionalExtension};

use crate::error::{AppError, AppResult};

const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024;

pub(crate) fn save_image(connection: &Connection, encoded: &str) -> AppResult<String> {
    // Check before decoding so an oversized IPC payload cannot allocate without bound.
    if encoded.len() > MAX_IMAGE_BYTES.div_ceil(3) * 4 {
        return Err(AppError::validation("Images must be 10 MB or smaller."));
    }
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|_| AppError::validation("This image could not be read."))?;
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err(AppError::validation("Images must be 10 MB or smaller."));
    }
    let mime = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        "image/png"
    } else if bytes.starts_with(b"\xff\xd8\xff") {
        "image/jpeg"
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        "image/gif"
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        "image/webp"
    } else {
        return Err(AppError::validation(
            "Choose a PNG, JPEG, GIF, or WebP image.",
        ));
    };
    let id = nanoid!(12);
    connection.execute(
        "INSERT INTO card_images (id, mime_type, data) VALUES (?1, ?2, ?3)",
        params![id, mime, bytes],
    )?;
    Ok(id)
}

pub(crate) fn load_image(connection: &Connection, id: &str) -> AppResult<Option<String>> {
    let image: Option<(String, Vec<u8>)> = connection
        .query_row(
            "SELECT mime_type, data FROM card_images WHERE id = ?1",
            [id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    Ok(image.map(|(mime, data)| format!("data:{mime};base64,{}", STANDARD.encode(data))))
}
