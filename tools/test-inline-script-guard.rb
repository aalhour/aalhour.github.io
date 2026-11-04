# frozen_string_literal: true

# Tests for _plugins/inline-script-guard.rb. Run: make test-guard
require 'minitest/autorun'
require_relative '../_plugins/inline-script-guard'

class InlineScriptGuardTest < Minitest::Test
  def comments(js)
    InlineScriptGuard.line_comments(js).length
  end

  # ── Must be flagged: a real // comment ──────────────────────────────────────

  def test_plain_line_comment
    assert_equal 1, comments("var a = 1; // note\nvar b = 2;")
  end

  def test_comment_inside_template_expression
    # Reviewer regression: code inside ${...} is JavaScript, not template text.
    assert_equal 1, comments("var t = `x${ a // note\n }y`;")
  end

  def test_comment_inside_nested_template_expression
    assert_equal 1, comments("var t = `a${ `b${ c // note\n }` }d`;")
  end

  def test_comment_after_division
    assert_equal 1, comments("var x = a / b; // note")
  end

  def test_comment_after_block
    assert_equal 1, comments("if (x) {\n  y();\n} // note")
  end

  def test_comment_after_postfix_division
    # Reviewer regression: postfix ++/-- leaves a value; the `/` is division.
    assert_equal 1, comments("let a = 2, b = 1;\nconst x = a++ / b; // note\nglobalThis.finished = true;")
    assert_equal 1, comments("var y = a-- / 2; // note")
  end

  def test_comment_after_regex
    assert_equal 1, comments("var re = /a/g; // note")
  end

  # ── Must pass: // that is not a comment ─────────────────────────────────────

  def test_url_in_string
    assert_equal 0, comments("var u = 'https://example.com'; var v = \"//cdn\";")
  end

  def test_block_comment
    assert_equal 0, comments("/* see https://example.com // here */ var a;")
  end

  def test_regex_with_escaped_slashes
    # Reviewer regression: a valid regex literal must not fail the build.
    assert_equal 0, comments("var re = /https?:\\/\\//; re.test(u);")
  end

  def test_regex_after_keyword_and_call
    assert_equal 0, comments("function f(s) { return /\\/\\//.test(s); }\ns.replace(/\\/\\/+/g, '/');")
  end

  def test_slash_in_regex_class
    assert_equal 0, comments('var r = /[/]/; var s = /[\\]/]/;')
  end

  def test_template_text
    assert_equal 0, comments('var t = `http://${host}//path`;')
  end

  def test_nested_template_text
    assert_equal 0, comments('var t = `${ `inner // text` }`;')
  end

  def test_object_literal_inside_template_expression
    assert_equal 0, comments('var t = `${ JSON.stringify({ a: { b: 1 } }) }//`;')
  end

  def test_postfix_and_prefix_without_comment
    assert_equal 0, comments('var x = a++ / b / c; var y = ++a / 2; var z = i-- / 3;')
  end

  def test_division_chain
    assert_equal 0, comments('var x = (a) / 2 / 3; var y = n[0] / 4;')
  end

  # ── Source scanning ─────────────────────────────────────────────────────────

  def test_scan_source_reports_file_and_line
    html = "<p>hi</p>\n<script>\n  var a = 1;\n  // note\n</script>\n"
    assert_equal ['x.html:4'], InlineScriptGuard.scan_source(html, 'x.html')
  end

  def test_scan_source_skips_json_ld_and_external_scripts
    html = <<~HTML
      <script type="application/ld+json">{"url": "https://example.com"} // not js</script>
      <script src="/a.js">// ignored</script>
      <script>var u = '{{ site.url }}//path'; /* {% if x %} // {% endif %} */</script>
    HTML
    assert_equal [], InlineScriptGuard.scan_source(html, 'x.html')
  end
end
