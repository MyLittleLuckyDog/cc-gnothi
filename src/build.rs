// SPDX-License-Identifier: AGPL-3.0-only
// Expose the build's target triple (e.g. aarch64-apple-darwin) at compile time
// via TARGET_TRIPLE. Consumed by self_update to pick the right release asset.

fn main() {
    let target = std::env::var("TARGET").expect("TARGET set by cargo");
    println!("cargo:rustc-env=TARGET_TRIPLE={target}");
    println!("cargo:rerun-if-changed=build.rs");
    // rust-embed bakes versions/ at compile time; force a rebuild when any
    // spec under that tree changes so the binary picks up new specs.
    println!("cargo:rerun-if-changed=../versions");
}
