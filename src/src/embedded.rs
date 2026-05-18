// SPDX-License-Identifier: AGPL-3.0-only
// cc-gnothi-mcp — © 2026 ryujaeuk <ryujaeuk@gmail.com>

use rust_embed::RustEmbed;

/// All versioned spec files embedded at compile time.
/// Files are stored as `v{version}/{command}.md`.
#[derive(RustEmbed)]
#[folder = "../versions/"]
#[include = "v*/*.md"]
pub struct VersionedSpecs;
