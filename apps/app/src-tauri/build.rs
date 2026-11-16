/// Runs Tauri's build-time code generation so the desktop shell has the metadata
/// and bindings it needs at compile time.
fn main() {
    println!("cargo:rerun-if-changed=icons/32x32.png");
    println!("cargo:rerun-if-changed=icons/128x128.png");
    println!("cargo:rerun-if-changed=icons/128x128@2x.png");
    println!("cargo:rerun-if-changed=icons/512x512.png");
    println!("cargo:rerun-if-changed=icons/icon.icns");
    println!("cargo:rerun-if-changed=icons/icon.ico");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        use std::{env, path::PathBuf, process::Command};
        let arch = match env::var("CARGO_CFG_TARGET_ARCH").as_deref() {
            Ok("aarch64") => "arm64",
            Ok("x86_64") => "x86_64",
            _ => panic!("unsupported macOS architecture"),
        };
        let source = "../macos/widget_bridge.m";
        let out = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR"));
        let object = out.join("widget_bridge.o");
        let archive = out.join("libpupil_widget_bridge.a");
        println!("cargo:rerun-if-changed={source}");
        let compile = Command::new("xcrun")
            .args(["clang", "-arch", arch, "-fobjc-arc", "-c", source, "-o"])
            .arg(&object)
            .status()
            .expect("run clang");
        assert!(compile.success(), "failed to compile widget bridge");
        let archive_result = Command::new("xcrun")
            .args(["ar", "crs"])
            .arg(&archive)
            .arg(&object)
            .status()
            .expect("run ar");
        assert!(archive_result.success(), "failed to archive widget bridge");
        println!("cargo:rustc-link-search=native={}", out.display());
        println!("cargo:rustc-link-lib=static=pupil_widget_bridge");
        println!("cargo:rustc-link-lib=framework=Foundation");
    }
    tauri_build::build()
}
