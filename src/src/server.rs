// SPDX-License-Identifier: AGPL-3.0-only
// cc-gnothi-mcp — © 2026 ryujaeuk <ryujaeuk@gmail.com>

use rmcp::{ServerHandler, handler::server::wrapper::Parameters, tool, tool_handler, tool_router};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::store::Store;

#[derive(Serialize, Deserialize, JsonSchema)]
pub struct QueryRequest {
    /// Search text — slash command name, feature keyword, or question about CC behavior.
    /// Examples: "/goal", "stop hook", "how does /memory work"
    pub text: String,
}

#[derive(Serialize, Deserialize, JsonSchema)]
pub struct GetSpecRequest {
    /// Exact slash command name, e.g. "clear", "compact", "memory".
    pub command: String,
}

#[derive(Serialize, Deserialize, JsonSchema)]
pub struct ListCommandsRequest {}

#[derive(Clone)]
pub struct GnothiServer {
    store: Arc<Store>,
    cc_version: Option<String>,
    tool_router: rmcp::handler::server::router::tool::ToolRouter<Self>,
}

impl GnothiServer {
    pub fn new(store: Store, cc_version: Option<String>) -> Self {
        Self {
            store: Arc::new(store),
            cc_version,
            tool_router: Self::tool_router(),
        }
    }
}

#[tool_router(router = tool_router)]
impl GnothiServer {
    #[tool(
        name = "query",
        description = "Search cc-gnothi for Claude Code behavioral specs. Returns structured JSON chunks with verified feature specs."
    )]
    async fn query(&self, Parameters(req): Parameters<QueryRequest>) -> String {
        let results = self.store.query(&req.text, self.cc_version.as_deref());

        if results.is_empty() {
            return serde_json::json!({
                "results": [],
                "message": "No matching chunks found."
            })
            .to_string();
        }

        serde_json::json!({ "results": results }).to_string()
    }

    #[tool(
        name = "get_spec",
        description = "Return the full behavioral spec for a single Claude Code slash command. Sections are concatenated in canonical order (Overview → Registration → Behavioral Spec → …). Appendix excluded. Use this when you need the complete spec for a known command."
    )]
    async fn get_spec(&self, Parameters(req): Parameters<GetSpecRequest>) -> String {
        match self.store.get_spec(&req.command, self.cc_version.as_deref()) {
            Some(result) => serde_json::to_string(&result).unwrap_or_else(|e| {
                serde_json::json!({ "error": e.to_string() }).to_string()
            }),
            None => serde_json::json!({
                "error": format!("No spec found for command: {}", req.command)
            })
            .to_string(),
        }
    }

    #[tool(
        name = "list_commands",
        description = "List all known Claude Code slash commands with name, description, and type. Use this for discovery before calling get_spec or query."
    )]
    async fn list_commands(&self, _: Parameters<ListCommandsRequest>) -> String {
        let commands = self.store.list_commands(self.cc_version.as_deref());
        serde_json::json!({ "commands": commands }).to_string()
    }
}

#[tool_handler(
    router = self.tool_router,
    name = "cc-gnothi-mcp",
    instructions = "Query Claude Code behavioral specs verified against bundle source. Use `list_commands` to discover available commands, `get_spec` to fetch a full spec, or `query` to search by keyword."
)]
impl ServerHandler for GnothiServer {}
