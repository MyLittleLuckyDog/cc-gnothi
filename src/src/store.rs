// SPDX-License-Identifier: AGPL-3.0-only
// cc-gnothi-mcp — © 2026 ryujaeuk <ryujaeuk@gmail.com>

use crate::loader::Chunk;
use serde::Serialize;

const MAX_RESULTS: usize = 5;
const CONTENT_PREVIEW_CHARS: usize = 4000;
const GET_SPEC_MAX_CHARS: usize = 15000;

// Section rendering order for get_spec (Appendix excluded — identifier noise).
const SECTION_ORDER: &[&str] = &[
    "Overview",
    "Registration",
    "Input Branching",
    "Behavioral Spec",
    "State & Side Effects",
    "Common Mistakes",
    "Version History",
];

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

#[derive(Debug, Serialize)]
pub struct GetSpecResult {
    pub command: String,
    pub cc_version: Option<String>,
    pub bundle_verified: bool,
    pub content: String,
    /// True when content was truncated to GET_SPEC_MAX_CHARS.
    pub truncated: bool,
}

#[derive(Debug, Serialize)]
pub struct CommandInfo {
    pub name: String,
    pub description: Option<String>,
    pub kind: Option<String>,
    pub cc_version: Option<String>,
}

impl Store {
    pub fn new(chunks: Vec<Chunk>) -> Self {
        Self { chunks }
    }

    pub fn len(&self) -> usize {
        self.chunks.len()
    }

    /// QMD search. Excludes Appendix chunks unless the query explicitly asks for identifiers.
    pub fn query(&self, text: &str, version_hint: Option<&str>) -> Vec<QueryResult> {
        let terms: Vec<String> = text
            .to_lowercase()
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();

        if terms.is_empty() {
            return vec![];
        }

        let include_appendix = terms.iter().any(|t| t == "identifier" || t == "appendix");

        let mut scored: Vec<(usize, &Chunk)> = self
            .chunks
            .iter()
            .filter(|c| include_appendix || !is_appendix(c))
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

    /// Return all sections for one command, concatenated in canonical order.
    /// Appendix is excluded. Content is capped at GET_SPEC_MAX_CHARS.
    pub fn get_spec(&self, command: &str, version_hint: Option<&str>) -> Option<GetSpecResult> {
        let cmd_lower = command.to_lowercase();

        // Collect chunks belonging to this command.
        let mut cmd_chunks: Vec<&Chunk> = self
            .chunks
            .iter()
            .filter(|c| {
                let feature_match = c
                    .frontmatter
                    .feature
                    .as_deref()
                    .map(|f| f.to_lowercase() == cmd_lower)
                    .unwrap_or(false);
                if !feature_match {
                    return false;
                }
                // Version preference: if hint given, prefer matching version.
                // But still return results when no matching version exists.
                if let (Some(hint), Some(ver)) = (version_hint, &c.frontmatter.cc_version) {
                    let _ = (hint, ver); // accept any — caller filters via get_spec
                }
                true
            })
            .collect();

        if cmd_chunks.is_empty() {
            return None;
        }

        // If version hint given, prefer chunks from that version.
        if let Some(hint) = version_hint {
            let versioned: Vec<&Chunk> = cmd_chunks
                .iter()
                .copied()
                .filter(|c| {
                    c.frontmatter
                        .cc_version
                        .as_deref()
                        .map(|v| v.contains(hint))
                        .unwrap_or(false)
                })
                .collect();
            if !versioned.is_empty() {
                cmd_chunks = versioned;
            }
        }

        // Sort by canonical section order; Appendix goes last and is excluded.
        cmd_chunks.sort_by_key(|c| section_rank(&c.heading));
        cmd_chunks.retain(|c| !is_appendix(c));

        let cc_version = cmd_chunks
            .first()
            .and_then(|c| c.frontmatter.cc_version.clone());
        let bundle_verified = cmd_chunks
            .iter()
            .all(|c| c.frontmatter.bundle_verified.unwrap_or(false));

        // Concatenate sections.
        let mut buf = String::new();
        for chunk in &cmd_chunks {
            buf.push_str(&format!("## {}\n\n", chunk.heading));
            buf.push_str(&chunk.content);
            buf.push_str("\n\n");
        }

        let truncated = buf.len() > GET_SPEC_MAX_CHARS;
        let content = if truncated {
            let mut end = GET_SPEC_MAX_CHARS;
            while !buf.is_char_boundary(end) {
                end -= 1;
            }
            format!(
                "{}…\n\n[Truncated — full spec exceeds {} chars. Use `query` for specific sections.]",
                &buf[..end],
                GET_SPEC_MAX_CHARS
            )
        } else {
            buf
        };

        Some(GetSpecResult {
            command: command.to_string(),
            cc_version,
            bundle_verified,
            content,
            truncated,
        })
    }

    /// Return a summary list of all known commands (one entry per unique feature/version).
    pub fn list_commands(&self, version_hint: Option<&str>) -> Vec<CommandInfo> {
        let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
        let mut result: Vec<CommandInfo> = Vec::new();

        for chunk in &self.chunks {
            let feature = match &chunk.frontmatter.feature {
                Some(f) => f.clone(),
                None => continue,
            };
            let ver = chunk.frontmatter.cc_version.as_deref().unwrap_or("");
            let key = format!("{}@{}", feature, ver);
            if seen.contains(&key) {
                continue;
            }

            if let Some(hint) = version_hint {
                if !ver.is_empty() && !ver.contains(hint) {
                    continue;
                }
            }

            // Extract description and type from Registration chunk for this feature.
            let reg_chunk = self.chunks.iter().find(|c| {
                c.frontmatter.feature.as_deref() == Some(&feature)
                    && c.heading == "Registration"
            });

            let description = reg_chunk.and_then(|c| extract_description(&c.content));
            let kind = reg_chunk.and_then(|c| extract_type(&c.content));

            seen.insert(key);
            result.push(CommandInfo {
                name: feature,
                description,
                kind,
                cc_version: chunk.frontmatter.cc_version.clone(),
            });
        }

        result.sort_by(|a, b| a.name.cmp(&b.name));
        result
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn is_appendix(chunk: &Chunk) -> bool {
    chunk.heading.starts_with("Appendix")
}

fn section_rank(heading: &str) -> usize {
    SECTION_ORDER
        .iter()
        .position(|&s| s == heading)
        .unwrap_or(usize::MAX)
}

/// QMD scoring: Q=query terms, M=metadata layer, D=document body.
fn qmd_score(chunk: &Chunk, terms: &[String], version_hint: Option<&str>) -> usize {
    let mut score: usize = 0;

    if let (Some(hint), Some(ver)) = (version_hint, &chunk.frontmatter.cc_version) {
        if ver.contains(hint) {
            score += 10;
        }
    }

    let heading_lower = chunk.heading.to_lowercase();
    let feature_lower = chunk.frontmatter.feature.as_deref().unwrap_or("").to_lowercase();
    let tags_lower = chunk
        .frontmatter
        .tags
        .as_ref()
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

/// Extract description value from a Registration section table.
/// Matches: `| description | text |` or `| description | `text` |`
fn extract_description(content: &str) -> Option<String> {
    for line in content.lines() {
        let lower = line.to_lowercase();
        if lower.starts_with("| description |") || lower.starts_with("|description|") {
            let parts: Vec<&str> = line.splitn(4, '|').collect();
            if parts.len() >= 3 {
                let v = parts[2].trim().trim_matches('`').trim().to_string();
                if !v.is_empty() && v != "..." {
                    return Some(v);
                }
            }
        }
    }
    None
}

/// Extract type value (local / local-jsx) from a Registration section table.
fn extract_type(content: &str) -> Option<String> {
    for line in content.lines() {
        let lower = line.to_lowercase();
        if lower.starts_with("| type |") || lower.starts_with("|type|") {
            let parts: Vec<&str> = line.splitn(4, '|').collect();
            if parts.len() >= 3 {
                let v = parts[2].trim().trim_matches('`').trim().to_string();
                if !v.is_empty() && v != "---" {
                    return Some(v);
                }
            }
        }
    }
    None
}
