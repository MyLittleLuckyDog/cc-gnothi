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
}

#[tool_handler(
    router = self.tool_router,
    name = "cc-gnothi-mcp",
    instructions = "Query Claude Code behavioral specs verified against bundle source. Use the `query` tool with a slash command name or feature keyword."
)]
impl ServerHandler for GnothiServer {}
