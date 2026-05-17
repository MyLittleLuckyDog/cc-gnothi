// SPDX-License-Identifier: AGPL-3.0-only
// cc-gnothi-mcp — © 2026 ryujaeuk <ryujaeuk@gmail.com>

use crate::loader::Chunk;
use serde::Serialize;

const MAX_RESULTS: usize = 5;
const CONTENT_PREVIEW_CHARS: usize = 800;

pub struct Store {
    chunks: Vec<Chunk>,
}

#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub id: String,
    pub heading: String,
    pub content: String,
    pub cc_version: Option<String>,
    pub source: Option<String>,
    pub bundle_verified: bool,
}

impl Store {
    pub fn new(chunks: Vec<Chunk>) -> Self {
        Self { chunks }
    }

    pub fn len(&self) -> usize {
        self.chunks.len()
    }

    /// QMD search: metadata match (tags, feature, version) weighted higher than body keywords.
    pub fn query(&self, text: &str, version_hint: Option<&str>) -> Vec<QueryResult> {
        let terms: Vec<String> = text
            .to_lowercase()
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();

        if terms.is_empty() {
            return vec![];
        }

        let mut scored: Vec<(usize, &Chunk)> = self
            .chunks
            .iter()
            .filter_map(|chunk| {
                let score = qmd_score(chunk, &terms, version_hint);
                if score > 0 { Some((score, chunk)) } else { None }
            })
            .collect();

        scored.sort_by(|a, b| b.0.cmp(&a.0));

        scored
            .into_iter()
            .take(MAX_RESULTS)
            .map(|(_, chunk)| QueryResult {
                id: chunk.id.clone(),
                heading: chunk.heading.clone(),
                content: truncate(&chunk.content, CONTENT_PREVIEW_CHARS),
                cc_version: chunk.frontmatter.cc_version.clone(),
                source: chunk.frontmatter.source.clone(),
                bundle_verified: chunk.frontmatter.bundle_verified.unwrap_or(false),
            })
            .collect()
    }
}

/// QMD scoring: Q=query terms, M=metadata layer, D=document body.
/// M score is weighted 4× over D score to prioritize metadata matches.
fn qmd_score(chunk: &Chunk, terms: &[String], version_hint: Option<&str>) -> usize {
    let mut score: usize = 0;

    // Version affinity boost: prefer chunks matching the running CC version
    if let (Some(hint), Some(ver)) = (version_hint, &chunk.frontmatter.cc_version) {
        if ver.contains(hint) {
            score += 10;
        }
    }

    // M layer: heading, feature name, tags (high weight)
    let heading_lower = chunk.heading.to_lowercase();
    let feature_lower = chunk.frontmatter.feature.as_deref().unwrap_or("").to_lowercase();
    let tags_lower = chunk.frontmatter.tags.as_ref()
        .map_or(String::new(), |t| t.join(" ").to_lowercase());

    for term in terms {
        if heading_lower.contains(term.as_str()) {
            score += 8;
        }
        if feature_lower.contains(term.as_str()) {
            score += 6;
        }
        if tags_lower.contains(term.as_str()) {
            score += 4;
        }
    }

    // D layer: body content (lower weight)
    let body_lower = chunk.content.to_lowercase();
    for term in terms {
        score += body_lower.matches(term.as_str()).count();
    }

    score
}

fn truncate(s: &str, max_chars: usize) -> String {
    if s.len() <= max_chars {
        s.to_string()
    } else {
        let mut end = max_chars;
        while !s.is_char_boundary(end) {
            end -= 1;
        }
        format!("{}…", &s[..end])
    }
}
