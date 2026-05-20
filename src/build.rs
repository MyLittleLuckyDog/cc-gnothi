// SPDX-License-Identifier: AGPL-3.0-only
// Expose the build's target triple (e.g. aarch64-apple-darwin) at compile time
// via TARGET_TRIPLE. Consumed by self_update to pick the right release asset.

fn main() {
    let target = std::env::var("TARGET").expect("TARGET set by cargo");
    println!("cargo:rustc-env=TARGET_TRIPLE={target}");
    println!("cargo:rerun-if-changed=build.rs");
}
