// SPDX-License-Identifier: AGPL-3.0-only
// cc-gnothi-mcp — © 2026 ryujaeuk <ryujaeuk@gmail.com>
//
// Downloads cc-gnothi docs from GitHub for a specific CC version.
// Cache directory: ~/.cc-gnothi/cache/v{VERSION}/

use anyhow::{Context, Result, bail};
use serde::Deserialize;
use std::path::PathBuf;

const REPO: &str = "MyLittleLuckyDog/cc-gnothi";
const BRANCH: &str = "main";
const GITHUB_API: &str = "https://api.github.com";
const GITHUB_RAW: &str = "https://raw.githubusercontent.com";

#[derive(Deserialize)]
struct GhTreeItem {
    path: String,
    #[serde(rename = "type")]
    kind: String,
    sha: String,
}

#[derive(Deserialize)]
struct GhTree {
    tree: Vec<GhTreeItem>,
}

pub struct Fetcher {
    client: reqwest::Client,
    cache_root: PathBuf,
}

impl Fetcher {
    pub fn new(cache_root: PathBuf) -> Result<Self> {
        let client = reqwest::Client::builder()
            .user_agent("cc-gnothi-mcp/0.1")
            .build()
            .context("build HTTP client")?;
        Ok(Self { client, cache_root })
    }

    /// Fetch docs for a CC version. Returns the local directory containing the MD files.
    /// Uses cached files if the SHA matches; re-downloads on mismatch.
    pub async fn fetch(&self, cc_version: &str) -> Result<PathBuf> {
        let version_cache = self.cache_root.join(format!("v{}", cc_version));
        let sha_file = version_cache.join(".sha");

        let tree = self.fetch_tree().await?;

        // collect docs/ and versions/v{VERSION}/ paths from tree
        let version_prefix = format!("versions/v{}/", cc_version);
        let md_items: Vec<&GhTreeItem> = tree
            .tree
            .iter()
            .filter(|item| {
                item.kind == "blob"
                    && item.path.ends_with(".md")
                    && (item.path.starts_with("docs/") || item.path.starts_with(&version_prefix))
            })
            .collect();

        if md_items.is_empty() {
            bail!(
                "no docs found for v{} in GitHub repo {}",
                cc_version,
                REPO
            );
        }

        // compute a simple combined hash to detect changes
        let combined_sha: String = md_items
            .iter()
            .map(|i| i.sha.as_str())
            .collect::<Vec<_>>()
            .join(",");

        let cached_sha = std::fs::read_to_string(&sha_file).unwrap_or_default();
        if cached_sha.trim() == combined_sha.trim() {
            tracing::info!("cache hit for v{}", cc_version);
            return Ok(version_cache);
        }

        tracing::info!(
            "downloading {} files for v{} from GitHub",
            md_items.len(),
            cc_version
        );

        for item in &md_items {
            let dest = version_cache.join(&item.path);
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)
                    .with_context(|| format!("mkdir {}", parent.display()))?;
            }
            let content = self.download_raw(&item.path).await?;
            std::fs::write(&dest, content)
                .with_context(|| format!("write {}", dest.display()))?;
        }

        std::fs::write(&sha_file, &combined_sha).context("write .sha")?;
        Ok(version_cache)
    }

    async fn fetch_tree(&self) -> Result<GhTree> {
        let url = format!(
            "{}/repos/{}/git/trees/{}?recursive=1",
            GITHUB_API, REPO, BRANCH
        );
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .context("fetch GitHub tree")?;

        if !resp.status().is_success() {
            bail!("GitHub API returned {}", resp.status());
        }

        resp.json::<GhTree>().await.context("parse GitHub tree")
    }

    async fn download_raw(&self, path: &str) -> Result<String> {
        let url = format!("{}/{}/{}/{}", GITHUB_RAW, REPO, BRANCH, path);
        let text = self
            .client
            .get(&url)
            .send()
            .await
            .with_context(|| format!("download {}", path))?
            .text()
            .await
            .with_context(|| format!("read body {}", path))?;
        Ok(text)
    }
}

pub fn default_cache_root() -> PathBuf {
    dirs_next::home_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join(".cc-gnothi")
        .join("cache")
}

// Simple fallback when dirs_next is not available — inline the logic
mod dirs_next {
    use std::path::PathBuf;
    pub fn home_dir() -> Option<PathBuf> {
        std::env::var_os("HOME").map(PathBuf::from)
    }
}
