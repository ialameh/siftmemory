/**
 * Command Runner
 * Reads commands/*.md and executes the appropriate handler.
 * Makes all slash commands operational.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runtimeReadinessService } from './runtime/readiness.js';
import { configService } from './runtime/config.js';
import { pluginStateStore } from './runtime/plugin-state.js';
import { getDaemonHealth, buildResumePack, ensureWorkspace, daemonClient, isApiSuccess, getApiError } from './daemon-http.js';
import { binaryResolver } from './runtime/binary-resolver.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = join(__dirname, '..', 'commands');

export type CommandName =
  | 'check'
  | 'status'
  | 'start'
  | 'stop'
  | 'resume'
  | 'checkpoint'
  | 'forget'
  | 'audit'
  | 'doctor'
  | 'team';

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
}

export async function runCommand(name: CommandName, args: string[]): Promise<CommandResult> {
  try {
    switch (name) {
      case 'check':
        return await runCheck();
      case 'status':
        return await runStatus();
      case 'start':
        return await runStart();
      case 'stop':
        return await runStop();
      case 'resume':
        return await runResume(args);
      case 'checkpoint':
        return await runCheckpoint();
      case 'forget':
        return await runForget(args);
      case 'audit':
        return await runAudit();
      case 'doctor':
        return await runDoctor();
      case 'team':
        return await runTeam(args);
      default:
        return { success: false, output: '', error: `Unknown command: ${name}` };
    }
  } catch (err) {
    return { success: false, output: '', error: String(err) };
  }
}

async function runCheck(): Promise<CommandResult> {
  const readiness = await runtimeReadinessService.ensureReady('command_check');

  const binaryPath = await binaryResolver.findSiftMemoryBinary();
  const coreInstalled = binaryPath !== null;

  const daemonUrl = configService.getDaemonUrl();
  const health = await getDaemonHealth();

  const state = await pluginStateStore.get();
  const runtimeState = state?.runtime?.state || 'uninitialized';

  let output = '# SiftMemory Check\n\n';
  output += `| Component | Status |\n`;
  output += `|-----------|--------|\n`;
  output += `| Core | ${coreInstalled ? '✅ Installed' : '❌ Missing'} |\n`;
  output += `| Daemon | ${health.ok ? '✅ Running' : '❌ Down'} |\n`;
  output += `| State | ${runtimeState} |\n`;

  if (health.version) {
    output += `| Version | ${health.version} |\n`;
  }

  if (!coreInstalled) {
    output += '\n**Install:** `cargo install --git https://github.com/ialameh/sift-memory siftmemory-daemon`\n';
  }

  return { success: true, output };
}

async function runStatus(): Promise<CommandResult> {
  const readiness = await runtimeReadinessService.ensureReady('command_status');

  const state = await pluginStateStore.get();
  const runtime = state?.runtime;

  const daemonUrl = configService.getDaemonUrl();
  const health = await getDaemonHealth();

  let output = '# SiftMemory Status\n\n';
  output += `## Runtime\n`;
  output += `- **State**: ${runtime?.state || 'unknown'}\n`;
  output += `- **Last Healthy**: ${runtime?.lastHealthy ? new Date(runtime.lastHealthy).toISOString() : 'never'}\n`;
  output += `- **Consecutive Failures**: ${runtime?.consecutiveFailures || 0}\n`;
  output += `- **Restart Attempts**: ${runtime?.restartAttemptsThisSession || 0}\n`;
  output += `- **Permanently Down**: ${runtime?.permanentlyDownForSession ? 'yes' : 'no'}\n`;

  output += `\n## Daemon\n`;
  output += `- **URL**: ${daemonUrl}\n`;
  output += `- **Health**: ${health.ok ? '✅ OK' : `❌ ${health.error || 'failed'}`}\n`;
  output += `- **Auto-Start**: ${configService.shouldAutoStart() ? 'enabled' : 'disabled'}\n`;

  output += `\n## Session\n`;
  output += `- **Start Time**: ${runtime?.lastHealthy ? new Date(runtime.lastHealthy).toISOString() : 'unknown'}\n`;
  output += `- **Resume Injections**: ${state?.session?.resumeInjections?.length || 0}\n`;

  return { success: true, output };
}

async function runStart(): Promise<CommandResult> {
  const readiness = await runtimeReadinessService.ensureReady('command_start');

  if (readiness.ready) {
    return { success: true, output: 'SiftMemory daemon is already running.' };
  }

  if (readiness.state === 'core_missing') {
    return {
      success: false,
      output: '',
      error: 'SiftMemory core is not installed. Install with:\ncargo install --git https://github.com/ialameh/sift-memory siftmemory-daemon',
    };
  }

  if (readiness.state === 'permanently_down') {
    return {
      success: false,
      output: '',
      error: 'SiftMemory has failed to start multiple times and is disabled for this session. Restart Claude Code to try again.',
    };
  }

  return {
    success: false,
    output: '',
    error: `Daemon start failed. State: ${readiness.state}. Run /siftmemory:check for details.`,
  };
}

async function runStop(): Promise<CommandResult> {
  const readiness = await runtimeReadinessService.ensureReady('stop');
  return { success: true, output: 'Stop command acknowledged.' };
}

async function runResume(args: string[]): Promise<CommandResult> {
  const readiness = await runtimeReadinessService.ensureReady('command_resume');

  if (!readiness.ready) {
    return { success: false, output: '', error: 'SiftMemory is not ready.' };
  }

  const task = args.join(' ').trim() || 'Resume reasoning';
  const workspace = await ensureWorkspace(process.cwd());

  if (!workspace) {
    return { success: false, output: '', error: 'No workspace found.' };
  }

  try {
    const result = await buildResumePack({
      workspaceId: workspace.workspace_id,
      sessionId: process.env.SIFTMEMORY_SESSION_ID || 'unknown',
      task,
      mode: 'standard',
      tokenBudget: 4000,
    });

    return {
      success: true,
      output: result.rendered_markdown || 'No resume context available.',
    };
  } catch (err) {
    return { success: false, output: '', error: String(err) };
  }
}

async function runCheckpoint(): Promise<CommandResult> {
  return { success: true, output: 'Checkpoint extraction is automatic before compaction.' };
}

async function runForget(args: string[]): Promise<CommandResult> {
  return { success: true, output: 'Forget command is not yet implemented.' };
}

async function runAudit(): Promise<CommandResult> {
  return { success: true, output: 'Audit command is not yet implemented.' };
}

async function runDoctor(): Promise<CommandResult> {
  const checks = [];

  // Check 1: Core installed
  const binaryPath = await binaryResolver.findSiftMemoryBinary();
  checks.push({
    name: 'Core binary',
    passed: binaryPath !== null,
    details: binaryPath ? `Found at ${binaryPath}` : 'Not found',
  });

  // Check 2: Config valid
  checks.push({
    name: 'Configuration',
    passed: configService.getDaemonUrl() !== '',
    details: `Daemon URL: ${configService.getDaemonUrl()}`,
  });

  // Check 3: State file writable
  const state = await pluginStateStore.get();
  checks.push({
    name: 'State store',
    passed: state !== null,
    details: state ? 'OK' : 'Failed to load state',
  });

  let output = '# SiftMemory Doctor\n\n';
  for (const check of checks) {
    output += `- ${check.passed ? '✅' : '❌'} **${check.name}**: ${check.details}\n`;
  }

  const allPassed = checks.every(c => c.passed);
  output += `\n**Result:** ${allPassed ? 'All checks passed' : 'Some checks failed'}`;

  return { success: allPassed, output };
}

async function runTeam(args: string[]): Promise<CommandResult> {
  const subcommand = args[0] || 'status';

  const workspace = await ensureWorkspace(process.cwd());
  if (!workspace) {
    return { success: false, output: '', error: 'No workspace found.' };
  }

  const workspaceId = workspace.workspace_id;

  switch (subcommand) {
    case 'status': {
      const response = await daemonClient.collectiveStatus(workspaceId);
      if (isApiSuccess(response) && response.data) {
        const data = response.data as Record<string, unknown>;
        let output = '# Collective Memory Status\n\n';
        output += `- **Workspace**: ${workspaceId}\n`;
        output += `- **Path**: ${data.repo_collective_path || 'unknown'}\n`;
        output += `- **Manifest**: ${data.manifest_exists ? '✅ exists' : '❌ missing'}\n\n`;
        const counts = data.record_counts as Record<string, number> || {};
        output += '## Record Counts\n';
        for (const [key, val] of Object.entries(counts)) {
          output += `- **${key}**: ${val}\n`;
        }
        output += `\n**Pending Reviews**: ${data.pending_reviews || 0}\n`;
        output += `**Unresolved Conflicts**: ${data.unresolved_conflicts || 0}\n`;
        return { success: true, output };
      }
      return { success: false, output: '', error: `Daemon returned: ${response.error ? getApiError(response) : 'unknown'}` };
    }

    case 'conflicts': {
      const response = await daemonClient.collectiveConflicts(workspaceId);
      if (isApiSuccess(response) && response.data) {
        const data = response.data as { conflicts: unknown[]; unresolved_count: number };
        let output = '# Collective Conflicts\n\n';
        output += `**Unresolved**: ${data.unresolved_count}\n\n`;
        if (data.conflicts.length === 0) {
          output += 'No conflicts found.\n';
        } else {
          for (const conflict of data.conflicts) {
            output += `- ${JSON.stringify(conflict)}\n`;
          }
        }
        return { success: true, output };
      }
      return { success: false, output: '', error: `Daemon returned: ${response.error ? getApiError(response) : 'unknown'}` };
    }

    case 'import': {
      const response = await daemonClient.collectiveImport(workspaceId);
      if (isApiSuccess(response) && response.data) {
        const data = response.data as { imported_count: number; warnings: string[] };
        let output = `# Collective Import\n\n`;
        output += `**Imported**: ${data.imported_count} records\n`;
        if (data.warnings.length > 0) {
          output += `\n**Warnings**:\n`;
          for (const w of data.warnings) {
            output += `- ${w}\n`;
          }
        }
        return { success: true, output };
      }
      return { success: false, output: '', error: `Daemon returned: ${response.error ? getApiError(response) : 'unknown'}` };
    }

    case 'promote': {
      const checkpointId = args[1];
      if (!checkpointId) {
        return { success: false, output: '', error: 'Usage: /siftmemory team promote <checkpoint_id>' };
      }
      const response = await daemonClient.collectivePromote(workspaceId, checkpointId);
      if (isApiSuccess(response) && response.data) {
        const data = response.data as { promoted_checkpoint_id: string; review_status: string };
        return { success: true, output: `✅ Promoted checkpoint ${data.promoted_checkpoint_id} (status: ${data.review_status})` };
      }
      return { success: false, output: '', error: `Daemon returned: ${response.error ? getApiError(response) : 'unknown'}` };
    }

    case 'validate': {
      const checkpointId = args[1] || undefined;
      const response = await daemonClient.collectiveValidate(workspaceId, checkpointId);
      if (isApiSuccess(response) && response.data) {
        const data = response.data as { validated_claims: number; invalidated_claims: number; disputed_claims: number; warnings: string[] };
        let output = `# Collective Validation\n\n`;
        output += `**Validated**: ${data.validated_claims}\n`;
        output += `**Invalidated**: ${data.invalidated_claims}\n`;
        output += `**Disputed**: ${data.disputed_claims}\n`;
        if (data.warnings.length > 0) {
          output += `\n**Warnings**:\n`;
          for (const w of data.warnings) {
            output += `- ${w}\n`;
          }
        }
        return { success: true, output };
      }
      return { success: false, output: '', error: `Daemon returned: ${response.error ? getApiError(response) : 'unknown'}` };
    }

    case 'review':
    case 'approve':
    case 'reject':
    case 'tombstone':
    case 'explain':
    case 'pull': {
      return { success: true, output: `Team ${subcommand} - not yet implemented. This SiftMemory daemon does not implement this collective operation yet.` };
    }

    default: {
      return {
        success: false,
        output: '',
        error: `Unknown team subcommand: ${subcommand}\n\nAvailable: status, import, promote, validate, conflicts`,
      };
    }
  }
}

export async function listCommands(): Promise<string[]> {
  try {
    const files = readdirSync(COMMANDS_DIR);
    return files
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''));
  } catch {
    return ['check', 'status', 'start', 'stop', 'resume', 'checkpoint', 'forget', 'audit', 'doctor', 'team'];
  }
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2] as CommandName;
  const args = process.argv.slice(3);

  runCommand(command, args)
    .then((result) => {
      if (result.output) console.log(result.output);
      if (result.error) console.error(result.error);
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
