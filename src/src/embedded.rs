// SPDX-License-Identifier: AGPL-3.0-only
// cc-gnothi-mcp — © 2026 ryujaeuk <ryujaeuk@gmail.com>

use rust_embed::RustEmbed;

/// All versioned spec files embedded at compile time.
/// Files are stored as `v{version}/{command}.md`.
#[derive(RustEmbed)]
#[folder = "../versions/"]
#[include = "v*/*.md"]
pub struct VersionedSpecs;

/// Prompt-body dumps mirrored from cc-gnothi extract-ast.js into the
/// private caludeCodeAVX2 repo. Embedded only with the `full` build
/// feature so the default public-release artifact does not carry
/// bundle-derived text (© Anthropic PBC).
///
/// Files are stored as `v{version}/{command}.txt` and read through
/// `loader::load_embedded_prompt`.
#[cfg(feature = "full")]
#[derive(RustEmbed)]
#[folder = "../../caludeCodeAVX2/prompts/"]
#[include = "v*/*.txt"]
pub struct VersionedPrompts;
