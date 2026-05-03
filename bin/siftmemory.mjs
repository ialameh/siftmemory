#!/usr/bin/env node
/**
 * SiftMemory CLI entry point
 */

const { parseArgs } = await import('node:util');

const commands = {
  start: 'Start the SiftMemory daemon',
  stop: 'Stop the SiftMemory daemon',
  status: 'Check daemon status',
  check: 'Check installation',
  search: 'Search memory',
};

async function main() {
  const { positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
  });

  const [cmd, ...args] = positionals;

  if (!cmd) {
    console.log('SiftMemory CLI\n');
    console.log('Usage: siftmemory <command> [options]\n');
    console.log('Commands:');
    for (const [name, desc] of Object.entries(commands)) {
      console.log(`  ${name.padEnd(12)} ${desc}`);
    }
    process.exit(0);
  }

  switch (cmd) {
    case 'check':
      console.log('Checking SiftMemory installation...');
      console.log('Run /siftmemory:check in Claude Code for full status.');
      break;
    case 'status':
      console.log('SiftMemory status check');
      console.log('Run /siftmemory:status in Claude Code for full status.');
      break;
    case 'start':
      console.log('Starting SiftMemory daemon...');
      console.log('Run /siftmemory:start in Claude Code to start the daemon.');
      break;
    case 'stop':
      console.log('Stopping SiftMemory daemon...');
      console.log('Run /siftmemory:stop in Claude Code to stop the daemon.');
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      console.log('Run siftmemory without args to see available commands.');
      process.exit(1);
  }
}

main();
