.PHONY: help install update build build-prod serve serve-drafts css-coverage lint clean

CATEGORY_FILE := _data/categories.yaml

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-10s %s\n", $$1, $$2}'

install: ## Runs bundle install
	git submodule init
	git submodule update --init --recursive assets/lib
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

serve-drafts: ## Start local dev server with drafts
	bundle exec jekyll serve --port 4000 --drafts

css-coverage: ## Build PROD site and run Chrome CSS coverage audit
	node tools/css-coverage.mjs

lint: ## Check category front matter against _data/categories.yaml
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
