# frozen_string_literal: true

# Lets Markdown work inside <mark> highlights.
#
# Why: kramdown 2.5 lists <mark> as a span element but gives it a :raw content
# model, so `code`, **bold** and [links](...) inside a highlight come out as
# literal text. Giving it the same :span model as <em> fixes that for every
# post, without adding markdown="span" to each tag.

require 'kramdown'

Kramdown::Parser::Html::Constants::HTML_CONTENT_MODEL['mark'] = :span
