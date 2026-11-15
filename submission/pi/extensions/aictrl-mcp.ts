import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerMcpServer("aictrl", {
    url: "https://aictrl.dev/mcp",
    description: "Run cloud code reviews, retrieve and judge PR findings, and work with tasks and backlog issues in aictrl.",
    // Pi reports required sign-ins for enabled servers at startup. Keep this
    // optional connection quiet until the user enables it in /mcp, then signs in.
    enabled: false,
    // Pi 1.5.2 accepts the same exposure controls here as in mcp.json.
    // Unknown and unrelated tools stay unreachable, including future additions.
    exposure: "hidden",
    toolExposure: {
      list_organizations: "deferred",
      query_context: "deferred",
      update_backlog: "deferred",
      list_tasks: "deferred",
      start_task: "deferred",
      get_task_execution: "deferred",
      list_pr_findings: "deferred",
      record_finding_verdict: "deferred",
      // Required by execute-workflow and implement-code-change connected mode.
      list_workflows: "deferred",
      get_workflow: "deferred",
      start_workflow: "deferred",
      get_workflow_run: "deferred",
      approve_workflow_step: "deferred",
      cancel_workflow_run: "deferred",
    },
  });
}
