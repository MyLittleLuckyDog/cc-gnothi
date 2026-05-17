// SPDX-License-Identifier: AGPL-3.0-only
// cc-gnothi-mcp — © 2026 ryujaeuk <ryujaeuk@gmail.com>

use anyhow::{Context, Result};
use serde::Deserialize;
use std::path::Path;
use walkdir::WalkDir;

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

    let (frontmatter, body) = split_frontmatter(&raw);
    let fm: Frontmatter = frontmatter
        .and_then(|s| serde_yaml::from_str(&s).ok())
        .unwrap_or_default();

    let file_id = path.to_string_lossy().to_string();
    let sections = split_sections(body);

    let chunks = sections
        .into_iter()
        .enumerate()
        .map(|(i, (heading, content))| Chunk {
            id: format!("{}#{}", file_id, i),
            file: file_id.clone(),
            heading: heading.clone(),
            content,
            frontmatter: fm.clone(),
        })
        .collect();

    Ok(chunks)
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
