// SPDX-License-Identifier: AGPL-3.0-only
// cc-gnothi-mcp — © 2026 ryujaeuk <ryujaeuk@gmail.com>

use anyhow::{Context, Result};
use serde::Deserialize;
use std::path::Path;
use walkdir::WalkDir;

use crate::embedded::VersionedSpecs;
use rust_embed::Embed as _;

#[derive(Debug, Clone, Deserialize, Default)]
pub struct Frontmatter {
    #[serde(rename = "type")]
    pub doc_type: Option<String>,
    pub feature: Option<String>,
    pub cc_version: Option<String>,
    pub tags: Option<Vec<String>>,
    pub source: Option<String>,
    pub bundle_verified: Option<bool>,
}

#[derive(Debug, Clone)]
pub struct Chunk {
    pub id: String,
    pub file: String,
    pub heading: String,
    pub content: String,
    pub frontmatter: Frontmatter,
}

pub fn load_all(root: &Path) -> Result<Vec<Chunk>> {
    let mut chunks = Vec::new();

    for entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map_or(false, |x| x == "md"))
    {
        let path = entry.path();
        match load_file(path) {
            Ok(file_chunks) => chunks.extend(file_chunks),
            Err(e) => tracing::warn!("skipping {}: {}", path.display(), e),
        }
    }

    tracing::info!("loaded {} chunks from {}", chunks.len(), root.display());
    Ok(chunks)
}

fn load_file(path: &Path) -> Result<Vec<Chunk>> {
    let raw = std::fs::read_to_string(path)
        .with_context(|| format!("read {}", path.display()))?;
    load_str(&raw, &path.to_string_lossy())
}

fn load_str(raw: &str, file_id: &str) -> Result<Vec<Chunk>> {
    let (frontmatter, body) = split_frontmatter(raw);
    let fm: Frontmatter = frontmatter
        .and_then(|s| serde_yaml::from_str(&s).ok())
        .unwrap_or_default();

    let sections = split_sections(body);

    let chunks = sections
        .into_iter()
        .enumerate()
        .map(|(i, (heading, content))| Chunk {
            id: format!("{}#{}", file_id, i),
            file: file_id.to_string(),
            heading: heading.clone(),
            content,
            frontmatter: fm.clone(),
        })
        .collect();

    Ok(chunks)
}

/// Load specs for a specific CC version from embedded data.
/// Falls back to the latest embedded version (with a warning) if exact version not found.
pub fn load_embedded(version: &str) -> Result<Vec<Chunk>> {
    let mut chunks = load_embedded_version(version);

    if chunks.is_empty() {
        let latest = latest_embedded_version()
            .context("binary contains no embedded specs")?;
        tracing::warn!(
            "CC {} not embedded; falling back to {} (update cc-gnothi for exact match)",
            version,
            latest
        );
        chunks = load_embedded_version(&latest);
        anyhow::ensure!(!chunks.is_empty(), "embedded latest version {} is empty", latest);
    }

    tracing::info!("loaded {} chunks from embedded v{}", chunks.len(), version);
    Ok(chunks)
}

fn load_embedded_version(version: &str) -> Vec<Chunk> {
    let prefix = format!("v{}/", version);
    let mut chunks = Vec::new();

    for file_path in VersionedSpecs::iter() {
        if !file_path.starts_with(&prefix) || !file_path.ends_with(".md") {
            continue;
        }
        let Some(file) = VersionedSpecs::get(&file_path) else { continue };
        let Ok(raw) = std::str::from_utf8(file.data.as_ref()) else { continue };

        match load_str(raw, &file_path) {
            Ok(c) => chunks.extend(c),
            Err(e) => tracing::warn!("skipping embedded {}: {}", file_path, e),
        }
    }

    chunks
}

/// Fetch the raw prompt body for a `(version, command)` pair embedded by
/// the `full` build feature. Returns `None` when the file is not present
/// (binary built without `full`, or the prompt was not extractable for
/// that command).
#[cfg(feature = "full")]
pub fn load_embedded_prompt(version: &str, command: &str) -> Option<String> {
    use crate::embedded::VersionedPrompts;
    let key = format!("v{}/{}.txt", version, command);
    let file = VersionedPrompts::get(&key)?;
    std::str::from_utf8(file.data.as_ref()).ok().map(|s| s.to_string())
}

/// List `(version, command)` pairs available in the embedded prompt set.
#[cfg(feature = "full")]
pub fn list_embedded_prompts() -> Vec<(String, String)> {
    use crate::embedded::VersionedPrompts;
    VersionedPrompts::iter()
        .filter_map(|p| {
            let s = p.to_string();
            let rest = s.strip_prefix('v')?;
            let mut it = rest.splitn(2, '/');
            let ver = it.next()?.to_string();
            let file = it.next()?;
            let cmd = file.strip_suffix(".txt")?.to_string();
            Some((ver, cmd))
        })
        .collect()
}

fn latest_embedded_version() -> Option<String> {
    let mut versions: Vec<String> = VersionedSpecs::iter()
        .filter_map(|p| {
            let s = p.to_string();
            s.strip_prefix('v')
                .and_then(|rest| rest.split('/').next())
                .map(|v| v.to_string())
        })
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    versions.sort_by(|a, b| {
        let parse = |s: &str| -> Vec<u32> {
            s.split('.').filter_map(|x| x.parse().ok()).collect()
        };
        parse(a).cmp(&parse(b))
    });

    versions.into_iter().last()
}

fn split_frontmatter(raw: &str) -> (Option<String>, &str) {
    if !raw.starts_with("---") {
        return (None, raw);
    }
    let after = &raw[3..];
    if let Some(end) = after.find("\n---") {
        let yaml = after[..end].trim().to_string();
        let body = &after[end + 4..];
        let body = body.strip_prefix('\n').unwrap_or(body);
        (Some(yaml), body)
    } else {
        (None, raw)
    }
}

fn split_sections(body: &str) -> Vec<(String, String)> {
    let mut sections: Vec<(String, String)> = Vec::new();
    let mut current_heading = String::from("(intro)");
    let mut current_lines: Vec<&str> = Vec::new();

    for line in body.lines() {
        if line.starts_with("## ") {
            if !current_lines.is_empty() {
                sections.push((
                    current_heading.clone(),
                    current_lines.join("\n").trim().to_string(),
                ));
                current_lines.clear();
            }
            current_heading = line[3..].trim().to_string();
        } else {
            current_lines.push(line);
        }
    }

    if !current_lines.is_empty() {
        sections.push((current_heading, current_lines.join("\n").trim().to_string()));
    }

    sections
        .into_iter()
        .filter(|(_, content)| !content.is_empty())
        .collect()
}
