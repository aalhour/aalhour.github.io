.PHONY: help update build serve

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-10s %s\n", $$1, $$2}'

install: ## Runs bundle install
	git submodule init
	bundle install

update: ## Update gems and submodule
	bundle update
	git submodule update --remote

build: ## Build the site
	bundle exec jekyll build

build-prod: ## Builds the site for PROD ENV
	JEKYLL_ENV=production bundle exec jekyll build

serve: ## Start local dev server
	bundle exec jekyll serve --port 4000

drafts: ## Start local dev server with drafts
	bundle exec jekyll serve --port 4000 --drafts

