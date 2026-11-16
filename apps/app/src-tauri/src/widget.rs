//! Publishes only aggregate calendar data to the optional macOS widget.
#[cfg(target_os = "macos")]
pub(crate) fn publish(connection: &rusqlite::Connection) {
    use std::ffi::CStr;
    use std::os::raw::{c_char, c_int};
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_SNAPSHOT: AtomicU64 = AtomicU64::new(0);

    unsafe extern "C" {
        fn pupil_widget_snapshot_path(buffer: *mut c_char, capacity: usize) -> c_int;
    }

    let mut buffer = [0 as c_char; 4096];
    // The native bridge returns an absolute path only when a group is configured.
    if unsafe { pupil_widget_snapshot_path(buffer.as_mut_ptr(), buffer.len()) } == 0 {
        return;
    }
    let path = unsafe { CStr::from_ptr(buffer.as_ptr()) }
        .to_string_lossy()
        .into_owned();
    let result = (|| -> Result<(), Box<dyn std::error::Error>> {
        let stats = crate::analytics::load_dashboard_stats(connection, crate::util::now_ms())?;
        let snapshot = serde_json::json!({ "studyDays": stats.study_days, "globalStreak": stats.global_streak });
        let path = std::path::Path::new(&path);
        let temporary = path.with_extension(format!(
            "json.{}.{}.tmp",
            std::process::id(),
            NEXT_SNAPSHOT.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::write(&temporary, serde_json::to_vec(&snapshot)?)?;
        std::fs::rename(temporary, path)?;
        Ok(())
    })();
    if let Err(error) = result {
        tracing::warn!(%error, "failed to update study calendar widget");
    }
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn publish(_connection: &rusqlite::Connection) {}
