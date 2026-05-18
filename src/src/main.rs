// SPDX-License-Identifier: AGPL-3.0-only
// cc-gnothi-mcp — © 2026 ryujaeuk <ryujaeuk@gmail.com>
//
// Usage:
//   cc-gnothi-mcp                        # auto-detect CC version, use embedded specs
//   cc-gnothi-mcp --cc-version 2.1.143   # explicit version, use embedded specs
//   cc-gnothi-mcp --fetch                # download specs from GitHub (any version)
//   cc-gnothi-mcp --docs /local/path     # dev mode: read specs from disk

mod embedded;
mod fetcher;
mod loader;
mod server;
mod store;

use anyhow::{Context, Result};
use rmcp::ServiceExt;
use std::path::PathBuf;
use tracing_subscriber::EnvFilter;

struct Args {
    cc_version: Option<String>,
    docs_root: Option<PathBuf>,
    fetch: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .with_writer(std::io::stderr)
        .init();

    let args = parse_args();
    let (chunks, cc_version) = resolve_chunks(&args).await?;

    tracing::info!("loaded {} chunks", chunks.len());

    let store = store::Store::new(chunks);
    let server = server::GnothiServer::new(store, cc_version);

    let transport = rmcp::transport::stdio();
    server
        .serve(transport)
        .await
        .context("MCP server error")?
        .waiting()
        .await
        .context("waiting for shutdown")?;

    Ok(())
}

async fn resolve_chunks(args: &Args) -> Result<(Vec<loader::Chunk>, Option<String>)> {
    // Dev mode: explicit disk path
    if let Some(root) = &args.docs_root {
        tracing::info!("dev mode: loading from {}", root.display());
        let chunks = loader::load_all(root)?;
        return Ok((chunks, args.cc_version.clone()));
    }

    // Determine version (explicit flag → env var → auto-detect)
    let version = args.cc_version.clone()
        .or_else(detect_cc_version)
        .context(
            "cannot determine CC version; pass --cc-version X.Y.Z or set CC_VERSION env var"
        )?;

    tracing::info!("target CC version: {}", version);

    // Embedded specs (primary path for installed binaries)
    match loader::load_embedded(&version) {
        Ok(chunks) => return Ok((chunks, Some(version))),
        Err(e) => tracing::debug!("embedded miss: {}", e),
    }

    // Fallback: fetch from GitHub
    if args.fetch {
        let cache_root = fetcher::default_cache_root();
        let f = fetcher::Fetcher::new(cache_root)?;
        let local = f.fetch(&version).await?;
        let chunks = loader::load_all(&local)?;
        return Ok((chunks, Some(version)));
    }

    anyhow::bail!(
        "no specs embedded for CC {} — update cc-gnothi or run with --fetch",
        version
    )
}

/// Run `claude --version` and extract the X.Y.Z version string.
fn detect_cc_version() -> Option<String> {
    let out = std::process::Command::new("claude")
        .arg("--version")
        .output()
        .ok()?;
    let text = String::from_utf8(out.stdout).ok()?;
    for word in text.split_whitespace() {
        let clean = word.trim_end_matches('.');
        let parts: Vec<&str> = clean.split('.').collect();
        if parts.len() == 3
            && parts.iter().all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
        {
            return Some(clean.to_string());
        }
    }
    None
}

fn parse_args() -> Args {
    let mut cc_version: Option<String> = None;
    let mut docs_root: Option<PathBuf> = None;
    let mut fetch = false;

    let mut iter = std::env::args().skip(1);
    loop {
        match iter.next().as_deref() {
            Some("--cc-version") | Some("--version") => {
                cc_version = iter.next();
            }
            Some("--docs") | Some("--docs-dir") => {
                docs_root = iter.next().map(PathBuf::from);
            }
            Some("--fetch") => {
                fetch = true;
            }
            Some(_) => {}
            None => break,
        }
    }

    if cc_version.is_none() {
        cc_version = std::env::var("CC_VERSION").ok();
    }

    Args { cc_version, docs_root, fetch }
}
