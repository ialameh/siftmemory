#!/usr/bin/env bash
node "${CLAUDE_PLUGIN_ROOT}/hooks/post-tool-failure/handler.mjs" "$@"