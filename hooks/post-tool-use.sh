#!/usr/bin/env bash
node "${CLAUDE_PLUGIN_ROOT}/hooks/post-tool-use/record-event.mjs" "$@"