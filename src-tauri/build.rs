fn main() {
    tauri_build::build();
    println!("cargo:rustc-link-lib=advapi32");
}
