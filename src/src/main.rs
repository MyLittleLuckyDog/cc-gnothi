// SPDX-License-Identifier: AGPL-3.0-only
// cc-gnothi-mcp — © 2026 ryujaeuk <ryujaeuk@gmail.com>
//
// Usage:
//   cc-gnothi-mcp --cc-version 2.1.143 [--docs /local/path]
//   cc-gnothi-mcp --cc-version 2.1.143 --fetch   (download from GitHub, then serve)
//
// If --docs is omitted with --fetch, cache is stored at ~/.cc-gnothi/cache/

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

    let docs_root = resolve_docs_root(&args).await?;

    tracing::info!("loading docs from {}", docs_root.display());
    let chunks = loader::load_all(&docs_root)
        .with_context(|| format!("load docs from {}", docs_root.display()))?;
    tracing::info!("loaded {} chunks", chunks.len());

    let store = store::Store::new(chunks);
    let server = server::GnothiServer::new(store, args.cc_version);

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

async fn resolve_docs_root(args: &Args) -> Result<PathBuf> {
    // Explicit --docs path always wins
    if let Some(root) = &args.docs_root {
        return Ok(root.clone());
    }

    if args.fetch {
        let version = args.cc_version.as_deref().context(
            "--fetch requires --cc-version (e.g. --cc-version 2.1.143)",
        )?;
        let cache_root = fetcher::default_cache_root();
        let f = fetcher::Fetcher::new(cache_root)?;
        let local = f.fetch(version).await?;
        return Ok(local);
    }

    // Fallback: infer repo root from exe path
    let exe = std::env::current_exe().context("cannot determine exe path")?;
    let root = exe
        .ancestors()
        .nth(4)
        .context("cannot infer repo root from exe path")?
        .to_path_buf();
    tracing::warn!(
        "no --docs or --fetch provided, inferring repo root as {}",
        root.display()
    );
    Ok(root)
}

fn parse_args() -> Args {
    let mut cc_version: Option<String> = None;
    let mut docs_root: Option<PathBuf> = None;
    let mut fetch = false;

    let mut iter = std::env::args().skip(1);
    loop {
        match iter.next().as_deref() {
            Some("--cc-version") => {
                cc_version = iter.next();
            }
            Some("--docs") => {
                docs_root = iter.next().map(PathBuf::from);
            }
            Some("--fetch") => {
                fetch = true;
            }
            Some(_) => {}
            None => break,
        }
    }

    // Also accept CC_VERSION env var
    if cc_version.is_none() {
        cc_version = std::env::var("CC_VERSION").ok();
    }

    Args { cc_version, docs_root, fetch }
}
