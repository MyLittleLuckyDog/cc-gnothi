// SPDX-License-Identifier: AGPL-3.0-only
// cc-gnothi-mcp self-update
//
// On startup, asynchronously checks GitHub Releases for a newer build of this
// binary, picks the asset matching the compile-time TARGET_TRIPLE, and
// atomically replaces the running binary in place.
//
// Safety invariants:
//   - Failure NEVER blocks server startup (every error path = log + skip).
//   - Atomic rename(2) inside the install dir keeps the old inode alive,
//     so processes that have the previous binary mmap'd are not corrupted.
//   - Advisory file lock (non-blocking) means only one concurrent startup
//     does the actual download; the others skip silently.
//   - Tmp file lives in the SAME directory as the install path — guarantees
//     same filesystem, guarantees rename atomicity.
//
// Disable: CC_GNOTHI_NO_AUTO_UPDATE=1
// Cooldown: CC_GNOTHI_UPDATE_MIN_INTERVAL_SEC=<seconds> (default 0 = every start)

use anyhow::{Context, Result, anyhow, bail};
use fs2::FileExt;
use serde::Deserialize;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");
const TARGET_TRIPLE: &str = env!("TARGET_TRIPLE");
const REPO: &str = "MyLittleLuckyDog/cc-gnothi";
const RELEASES_URL: &str = "https://api.github.com/repos/MyLittleLuckyDog/cc-gnothi/releases/latest";
const USER_AGENT: &str = concat!("cc-gnothi-mcp/", env!("CARGO_PKG_VERSION"));

#[derive(Debug)]
pub enum Outcome {
    Disabled,
    Skipped(String),
    Installed { from: String, to: String },
}

/// Entry point. Never panics. Caller should run this as a `tokio::spawn`.
pub async fn try_update() -> Outcome {
    if std::env::var("CC_GNOTHI_NO_AUTO_UPDATE").ok().as_deref() == Some("1") {
        return Outcome::Disabled;
    }

    let ctx = match UpdateCtx::resolve() {
        Ok(c) => c,
        Err(e) => return Outcome::Skipped(format!("resolve ctx: {e}")),
    };

    // Best-effort cleanup of stale tmp files from previous crashes.
    ctx.purge_stale_tmps();

    if !ctx.cooldown_elapsed() {
        return Outcome::Skipped("cooldown not elapsed".into());
    }

    // Non-blocking lock. If another startup is mid-update, just bail.
    let _guard = match ctx.try_lock() {
        Ok(g) => g,
        Err(e) => return Outcome::Skipped(format!("lock not acquired: {e}")),
    };

    // Re-check after lock: another process may have just bumped the marker.
    if !ctx.cooldown_elapsed() {
        return Outcome::Skipped("cooldown elapsed during lock wait".into());
    }

    let release = match fetch_latest_release().await {
        Ok(r) => r,
        Err(e) => {
            ctx.mark_checked();
            return Outcome::Skipped(format!("fetch release: {e}"));
        }
    };

    let latest = release.tag_name.trim_start_matches('v').to_string();

    if release.prerelease {
        ctx.mark_checked();
        return Outcome::Skipped(format!("latest is prerelease ({latest})"));
    }

    if !version_is_newer(&latest, CURRENT_VERSION) {
        ctx.mark_checked();
        return Outcome::Skipped(format!(
            "no newer release ({latest} <= {CURRENT_VERSION})"
        ));
    }

    let asset = match pick_asset(&release.assets) {
        Some(a) => a,
        None => {
            ctx.mark_checked();
            return Outcome::Skipped(format!(
                "no asset matching target {TARGET_TRIPLE} in release {latest}"
            ));
        }
    };

    let tmp_bin = match download_and_extract(&asset.browser_download_url, &ctx.install_path).await
    {
        Ok(p) => p,
        Err(e) => {
            ctx.mark_checked();
            return Outcome::Skipped(format!("download/extract: {e}"));
        }
    };

    if let Err(e) = atomic_install(&tmp_bin, &ctx.install_path) {
        let _ = fs::remove_file(&tmp_bin);
        ctx.mark_checked();
        return Outcome::Skipped(format!("install: {e}"));
    }

    ctx.mark_checked();
    Outcome::Installed {
        from: CURRENT_VERSION.to_string(),
        to: latest,
    }
}

// ─── HTTP types ──────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    assets: Vec<Asset>,
}

#[derive(Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
}

async fn fetch_latest_release() -> Result<Release> {
    let resp = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?
        .get(RELEASES_URL)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .context("GET releases/latest")?
        .error_for_status()
        .context("releases/latest non-2xx")?;
    let release: Release = resp.json().await.context("parse release json")?;
    Ok(release)
}

// ─── Asset selection ─────────────────────────────────────────────────────────

fn pick_asset(assets: &[Asset]) -> Option<&Asset> {
    // release.yml names assets as: cc-gnothi-mcp-<tag>-<target>.{tar.gz,exe}
    // Match by target triple substring; format is inferred from extension.
    assets
        .iter()
        .find(|a| a.name.contains(TARGET_TRIPLE) && is_known_asset(&a.name))
}

fn is_known_asset(name: &str) -> bool {
    name.ends_with(".tar.gz") || name.ends_with(".exe")
}

// ─── Download + extract ──────────────────────────────────────────────────────

async fn download_and_extract(url: &str, install_path: &Path) -> Result<PathBuf> {
    let install_dir = install_path
        .parent()
        .ok_or_else(|| anyhow!("install path has no parent"))?;
    fs::create_dir_all(install_dir)?;

    let bin_name = install_path
        .file_name()
        .ok_or_else(|| anyhow!("install path has no filename"))?
        .to_string_lossy()
        .into_owned();

    // tmp lives in the same dir → guaranteed same-fs rename later
    let tmp_bin = install_dir.join(format!(".{bin_name}.tmp.{}", std::process::id()));

    let bytes = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()?
        .get(url)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .send()
        .await
        .context("GET asset")?
        .error_for_status()
        .context("asset download non-2xx")?
        .bytes()
        .await
        .context("read asset body")?;

    if url.ends_with(".tar.gz") {
        extract_binary_from_targz(&bytes, &bin_name, &tmp_bin)?;
    } else if url.ends_with(".exe") {
        fs::write(&tmp_bin, &bytes).context("write exe tmp")?;
    } else {
        bail!("unknown asset format: {url}");
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&tmp_bin)?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&tmp_bin, perms)?;
    }

    Ok(tmp_bin)
}

fn extract_binary_from_targz(bytes: &[u8], bin_name: &str, out: &Path) -> Result<()> {
    let gz = flate2::read::GzDecoder::new(bytes);
    let mut archive = tar::Archive::new(gz);

    // Strip ".exe" when matching, since on Windows the tar may not carry it
    // — but in practice release.yml uses tar.gz only for non-Windows, so the
    // entry name should match bin_name exactly. Be permissive anyway.
    let target_no_ext = bin_name.trim_end_matches(".exe");

    for entry in archive.entries().context("read tar entries")? {
        let mut entry = entry.context("tar entry")?;
        let entry_path = entry.path().context("tar entry path")?.into_owned();
        let entry_name = entry_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");

        if entry_name == bin_name
            || entry_name == target_no_ext
            || entry_name == format!("{target_no_ext}.exe")
        {
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf).context("read tar payload")?;
            fs::write(out, &buf).context("write extracted binary")?;
            return Ok(());
        }
    }

    bail!("no '{bin_name}' entry in tar archive")
}

// ─── Install (atomic rename) ─────────────────────────────────────────────────

fn atomic_install(tmp_bin: &Path, install_path: &Path) -> Result<()> {
    #[cfg(windows)]
    {
        // Windows can't rename over a running .exe. Move existing to .old
        // (which IS allowed even while running), then rename new into place.
        // The .old will be unlinked on the next update when not in use.
        let backup = install_path.with_extension("exe.old");
        let _ = fs::remove_file(&backup); // best effort
        if install_path.exists() {
            fs::rename(install_path, &backup).context("backup running exe")?;
        }
        fs::rename(tmp_bin, install_path).context("rename new exe into place")?;
    }
    #[cfg(not(windows))]
    {
        // rename(2) is atomic on the same filesystem. The previous binary's
        // inode stays alive for any process that has it mmap'd / open —
        // including the very process running THIS code right now.
        fs::rename(tmp_bin, install_path).context("rename new binary into place")?;
    }
    Ok(())
}

// ─── Version comparison ──────────────────────────────────────────────────────

fn parse_version(s: &str) -> Option<(u64, u64, u64)> {
    let s = s.trim_start_matches('v');
    // Strip any prerelease/build metadata: 1.2.3-rc1 → 1.2.3
    let s = s.split(['-', '+']).next().unwrap_or(s);
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() < 3 {
        return None;
    }
    Some((
        parts[0].parse().ok()?,
        parts[1].parse().ok()?,
        parts[2].parse().ok()?,
    ))
}

fn version_is_newer(candidate: &str, current: &str) -> bool {
    match (parse_version(candidate), parse_version(current)) {
        (Some(c), Some(cur)) => c > cur,
        _ => false,
    }
}

// ─── Context ─────────────────────────────────────────────────────────────────

struct UpdateCtx {
    install_path: PathBuf,
    lock_path: PathBuf,
    marker_path: PathBuf,
    min_interval: Duration,
}

impl UpdateCtx {
    fn resolve() -> Result<Self> {
        let install_path = std::env::current_exe().context("current_exe")?;
        let state_dir = dirs::home_dir()
            .ok_or_else(|| anyhow!("no home dir"))?
            .join(".cc-gnothi");
        let min_interval = std::env::var("CC_GNOTHI_UPDATE_MIN_INTERVAL_SEC")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .map(Duration::from_secs)
            .unwrap_or(Duration::ZERO);
        Ok(Self {
            install_path,
            lock_path: state_dir.join("update.lock"),
            marker_path: state_dir.join("last-update-check"),
            min_interval,
        })
    }

    fn cooldown_elapsed(&self) -> bool {
        if self.min_interval.is_zero() {
            return true;
        }
        let last = fs::read_to_string(&self.marker_path)
            .ok()
            .and_then(|s| s.trim().parse::<u64>().ok());
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        match last {
            Some(t) => now.saturating_sub(t) >= self.min_interval.as_secs(),
            None => true,
        }
    }

    fn mark_checked(&self) {
        if let Some(parent) = self.marker_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(d) = SystemTime::now().duration_since(UNIX_EPOCH) {
            let _ = fs::write(&self.marker_path, d.as_secs().to_string());
        }
    }

    fn try_lock(&self) -> Result<LockGuard> {
        if let Some(parent) = self.lock_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let file = File::create(&self.lock_path).context("create lock file")?;
        file.try_lock_exclusive()
            .context("another process is updating")?;
        Ok(LockGuard(file))
    }

    /// Remove orphaned `.{bin}.tmp.*` siblings from crashed previous downloads.
    /// Best-effort, errors ignored.
    fn purge_stale_tmps(&self) {
        let Some(dir) = self.install_path.parent() else {
            return;
        };
        let Some(bin_name) = self.install_path.file_name().and_then(|n| n.to_str()) else {
            return;
        };
        let prefix = format!(".{bin_name}.tmp.");
        let Ok(entries) = fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            let Ok(name) = entry.file_name().into_string() else {
                continue;
            };
            if name.starts_with(&prefix) {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}

struct LockGuard(File);

impl Drop for LockGuard {
    fn drop(&mut self) {
        let _ = fs2::FileExt::unlock(&self.0);
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_parsing() {
        assert_eq!(parse_version("0.1.0"), Some((0, 1, 0)));
        assert_eq!(parse_version("v0.2.3"), Some((0, 2, 3)));
        assert_eq!(parse_version("1.2.3-rc1"), Some((1, 2, 3)));
        assert_eq!(parse_version("1.2.3+build.4"), Some((1, 2, 3)));
        assert_eq!(parse_version("nope"), None);
        assert_eq!(parse_version("1.2"), None);
    }

    #[test]
    fn version_comparison() {
        assert!(version_is_newer("0.2.0", "0.1.0"));
        assert!(version_is_newer("1.0.0", "0.99.0"));
        assert!(!version_is_newer("0.1.0", "0.1.0"));
        assert!(!version_is_newer("0.1.0", "0.2.0"));
        assert!(!version_is_newer("garbage", "0.1.0"));
    }

    #[test]
    fn asset_picker_matches_target() {
        let assets = vec![
            Asset {
                name: "cc-gnothi-mcp-v0.2.0-x86_64-unknown-linux-gnu.tar.gz".into(),
                browser_download_url: "http://example/linux".into(),
            },
            Asset {
                name: format!("cc-gnothi-mcp-v0.2.0-{TARGET_TRIPLE}.tar.gz"),
                browser_download_url: "http://example/me".into(),
            },
        ];
        let picked = pick_asset(&assets).expect("should match");
        assert_eq!(picked.browser_download_url, "http://example/me");
    }

    #[test]
    fn asset_picker_rejects_unknown_ext() {
        let assets = vec![Asset {
            name: format!("cc-gnothi-mcp-v0.2.0-{TARGET_TRIPLE}.zip"),
            browser_download_url: "http://example/zip".into(),
        }];
        assert!(pick_asset(&assets).is_none());
    }
}

// Reference REPO at module scope so unused-const warning doesn't fire in builds
// where the const is read only inside RELEASES_URL formatting. (Currently
// RELEASES_URL is a literal — keep REPO as documentation for future refactors.)
#[allow(dead_code)]
const _REPO_REF: &str = REPO;
