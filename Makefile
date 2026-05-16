.PHONY: help install update build build-prod serve serve-drafts css-coverage check-lychee lint-lychee lint-categories clean

CATEGORY_FILE := _data/categories.yaml
LYCHEE_PORT ?= 4001
LYCHEE_BASE_URL := http://127.0.0.1:$(LYCHEE_PORT)
LYCHEE_BUILD_DIR ?= /private/tmp/aalhour-lychee-site
LYCHEE_CONFIG ?= /private/tmp/aalhour-lychee.yml
LYCHEE_SERVER_LOG ?= /tmp/aalhour-lychee-server.log
LYCHEE_EXCLUDES := \
	--exclude '/webfonts/' \
	--exclude 'https://shop.app/' \
	--exclude 'http://www.adobe.com/' \
	--exclude 'https://medium.datadriveninvestor.com/2025-paxos-made-really-simple-64174ac8feb5' \
	--exclude 'https://mitpress.mit.edu/books/elements-computing-systems' \
	--exclude 'https://www.tripadvisor.com/' \
	--exclude 'https://online.stanford.edu/courses/soe-ycscs1-compilers' \
	--exclude 'https://web.archive.org/web/20140829024154/https://d1g.com/' \
	--exclude 'https://www.goodreads.com/book/show/7489.The_Optimistic_Child'

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-17s %s\n", $$1, $$2}'

install: ## Runs gitsubmodule init and bundle install
	git submodule init
	git submodule update --init --recursive assets/lib
	bundle install

update: ## Update gems and git submodule
	bundle update
	git submodule update --remote

build: ## Build the site
	bundle exec jekyll build

build-prod: ## Builds the site for PROD ENV
	JEKYLL_ENV=production bundle exec jekyll build

serve: ## Start local dev server
	bundle exec jekyll serve --port 4000

serve-drafts: ## Start local dev server with drafts
	bundle exec jekyll serve --port 4000 --drafts

css-coverage: ## Build PROD site and run Chrome CSS coverage audit
	node tools/css-coverage.mjs

check-lychee: ## Check that lychee is installed
	@command -v lychee >/dev/null 2>&1 || { \
		echo "lychee is not installed. Install it separately, then rerun make lint-lychee." >&2; \
		exit 1; \
	}

lint-lychee: check-lychee ## Build a temporary local site and run lychee
	@set -e; \
		rm -rf "$(LYCHEE_BUILD_DIR)"; \
		printf 'url: %s\ndestination: %s\n' "$(LYCHEE_BASE_URL)" "$(LYCHEE_BUILD_DIR)" > "$(LYCHEE_CONFIG)"; \
		JEKYLL_ENV=production bundle exec jekyll build --config _config.yml,"$(LYCHEE_CONFIG)"; \
		ruby -run -e httpd "$(LYCHEE_BUILD_DIR)" -p "$(LYCHEE_PORT)" -b 127.0.0.1 >"$(LYCHEE_SERVER_LOG)" 2>&1 & \
		server_pid=$$!; \
		trap 'kill "$$server_pid" 2>/dev/null || true; rm -f "$(LYCHEE_CONFIG)"' EXIT INT TERM; \
		for _ in 1 2 3 4 5 6 7 8 9 10; do \
			curl -fsS "$(LYCHEE_BASE_URL)/" >/dev/null 2>&1 && break; \
			kill -0 "$$server_pid" 2>/dev/null || { cat "$(LYCHEE_SERVER_LOG)" >&2; exit 1; }; \
			sleep 0.5; \
		done; \
		curl -fsS "$(LYCHEE_BASE_URL)/" >/dev/null || { cat "$(LYCHEE_SERVER_LOG)" >&2; exit 1; }; \
		lychee --base-url "$(LYCHEE_BASE_URL)" "$(LYCHEE_BUILD_DIR)/" $(LYCHEE_EXCLUDES)

lint-categories: ## Check category front matter against _data/categories.yaml
	@ruby -ryaml -rdate -e '\
		category_file = "$(CATEGORY_FILE)"; \
		known = YAML.safe_load_file(category_file).keys; \
		counts = Hash.new(0); \
		tags = Hash.new(0); \
		unknown = Hash.new { |h, k| h[k] = [] }; \
		Dir.glob(["_posts/*.{md,markdown}", "_drafts/*.{md,markdown}"]).sort.each do |path| \
			text = File.read(path); \
			match = text.match(/\A---\s*\n(.*?)\n---\s*\n/m); \
			next unless match; \
			data = YAML.safe_load(match[1], permitted_classes: [Date, Time], aliases: true) || {}; \
			categories = Array(data["categories"] || data["category"]); \
			categories.each do |category| \
				category = category.to_s; \
				counts[category] += 1; \
				unknown[category] << path unless known.include?(category); \
			end; \
			Array(data["tags"]).each { |tag| tags[tag.to_s] += 1 }; \
		end; \
		puts "Known categories:"; \
		known.each { |category| puts "\t#{category}" }; \
		puts "------------------"; \
		puts "Categories in use:"; \
		counts.sort_by { |category, count| [-count, category] }.each { |category, count| puts "\t#{count} #{category}" }; \
		unless unknown.empty?; \
			puts "------------------"; \
			puts "Unknown categories:"; \
			unknown.each { |category, paths| puts "\t#{category}: #{paths.join(", ")}" }; \
			exit 1; \
		end; \
		puts "------------------"; \
		puts "Tags in use:"; \
		tags.sort_by { |tag, count| [-count, tag] }.each { |tag, count| puts "\t#{count} #{tag}" } \
	'

clean: ## Remove all build artifacts
	rm -rf _site .jekyll-cache .sass-cache .jekyll-metadata
