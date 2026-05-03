#!/usr/bin/env bash
node "${CLAUDE_PLUGIN_ROOT}/hooks/post-tool-batch/handler.mjs" "$@"