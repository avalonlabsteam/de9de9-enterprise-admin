# De9De9 Admin — developer shortcuts.
# Thin wrappers over the npm scripts, plus helpers for the HTTP log files
# written by the dev server (see docs/HTTP_LOGGING.md).

.PHONY: help install dev build preview lint typecheck check logs logs-errors logs-table logs-clean

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[1m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

dev: ## Start the Vite dev server (HTTP logging active)
	npm run dev

build: ## Typecheck + production build
	npm run build

preview: ## Serve the production build locally
	npm run preview

lint: ## ESLint over the whole project
	npm run lint

typecheck: ## TypeScript check without emitting
	npx tsc --noEmit

check: typecheck lint build ## Everything CI would run: typecheck, lint, build

logs: ## Tail today's HTTP log file live
	tail -f logs/http-$$(date +%F).log

logs-errors: ## Show failed requests (4xx/5xx/network) from all HTTP logs — needs jq
	jq 'select((.status | type == "string") or .status >= 400)' logs/http-*.log

logs-table: ## Compact table of all logged requests — needs jq
	jq -r '[.ts, .method, .url, .status, .durationMs] | @tsv' logs/http-*.log

logs-clean: ## Delete all HTTP log files
	rm -f logs/http-*.log
