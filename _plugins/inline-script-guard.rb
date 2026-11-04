# frozen_string_literal: true

# Fails the build when an inline <script> in a template or page uses a `//`
# line comment.
#
# Why: the production build (Chirpy's `compress` layout, JEKYLL_ENV=production)
# joins each inline script onto one line, so a `//` comment silently swallows
# everything after it. The script still works in `jekyll serve`, so the bug only
# shows on the live site. Use /* block comments */ in inline scripts.
#
# Runs on every build (dev included) so the mistake is caught before deploy.
# External .js files under assets/ are not compressed and are not checked.
#
# Comments are found with a small JavaScript tokenizer that skips strings,
# template literals (including `${...}` expressions, which are code), regex
# literals and block comments. Tests: tools/test-inline-script-guard.rb
# (`make test-guard`).
module InlineScriptGuard
  SOURCES = %w[
    _includes/**/*.html
    _layouts/**/*.html
    _tabs/**/*.{md,html}
    _posts/**/*.{md,html}
    _drafts/**/*.{md,html}
    animations/**/*.{md,html}
    *.{md,html}
  ].freeze

  SCRIPT = %r{<script\b([^>]*)>(.*?)</script>}mi.freeze
  JS_TYPES = ['', 'text/javascript', 'application/javascript', 'module'].freeze

  # After these words a `/` starts a regex, not a division.
  REGEX_KEYWORDS = %w[
    return typeof instanceof in of new delete void throw case do else yield await
  ].freeze

  module_function

  # Offsets of every `//` line comment in a piece of JavaScript.
  def line_comments(code)
    found = []
    n = code.length
    i = 0
    prev = :start # :start / :punct / :keyword allow a regex next; :value means division
    braces = []   # one open-brace counter per `${` we are inside

    while i < n
      c = code[i]
      nxt = code[i + 1]

      if c.match?(/\s/)
        i += 1
      elsif c == '/' && nxt == '/'
        found << i
        i = code.index("\n", i) || n
      elsif c == '/' && nxt == '*'
        close = code.index('*/', i + 2)
        i = close ? close + 2 : n
      elsif c == "'" || c == '"'
        i = skip_string(code, i)
        prev = :value
      elsif c == '`'
        i, opened = skip_template(code, i + 1)
        braces.push(0) if opened
        prev = opened ? :punct : :value
      elsif c == '/'
        if prev == :value
          i += 1
          prev = :punct
        else
          i = skip_regex(code, i)
          prev = :value
        end
      elsif c == '{'
        braces[-1] += 1 unless braces.empty?
        i += 1
        prev = :punct
      elsif c == '}'
        if !braces.empty? && braces[-1].zero?
          # End of a `${...}` expression: back into the template text.
          braces.pop
          i, opened = skip_template(code, i + 1)
          braces.push(0) if opened
          prev = opened ? :punct : :value
        else
          braces[-1] -= 1 unless braces.empty?
          i += 1
          prev = :punct # end of a block; a regex may follow
        end
      elsif c.match?(/[A-Za-z_$]/)
        j = i + 1
        j += 1 while j < n && code[j].match?(/[\w$]/)
        prev = REGEX_KEYWORDS.include?(code[i...j]) ? :keyword : :value
        i = j
      elsif c.match?(/\d/)
        j = i + 1
        j += 1 while j < n && code[j].match?(/[\w.]/)
        prev = :value
        i = j
      elsif c == ')' || c == ']'
        prev = :value
        i += 1
      elsif (c == '+' || c == '-') && nxt == c
        # `a++ / b`: postfix ++/-- leaves a value, so a `/` next is division.
        # Prefix (`++a`) is followed by its operand, which sets prev itself.
        i += 2
        prev = :punct unless prev == :value
      else
        prev = :punct
        i += 1
      end
    end
    found
  end

  # Index just past a '...' or "..." string (strings can't span lines).
  def skip_string(code, i)
    quote = code[i]
    j = i + 1
    while j < code.length
      ch = code[j]
      return j + 1 if ch == quote
      return j if ch == "\n"

      j += ch == '\\' ? 2 : 1
    end
    code.length
  end

  # Scans template text from i. Returns [index, true] just past a `${`, or
  # [index, false] just past the closing backtick.
  def skip_template(code, i)
    j = i
    while j < code.length
      ch = code[j]
      return [j + 1, false] if ch == '`'
      return [j + 2, true] if ch == '$' && code[j + 1] == '{'

      j += ch == '\\' ? 2 : 1
    end
    [code.length, false]
  end

  # Index just past a regex literal starting at i (flags included).
  def skip_regex(code, i)
    j = i + 1
    in_class = false
    while j < code.length
      ch = code[j]
      break if ch == "\n"

      if ch == '\\'
        j += 2
        next
      end
      if in_class
        in_class = false if ch == ']'
      elsif ch == '['
        in_class = true
      elsif ch == '/'
        j += 1
        j += 1 while j < code.length && code[j].match?(/[a-z]/i)
        return j
      end
      j += 1
    end
    j
  end

  # "file:line" for each `//` comment in the inline JS of one source file.
  def scan_source(source, rel)
    problems = []
    source.scan(SCRIPT) do
      match = Regexp.last_match
      attrs, body = match.captures
      body_start = match.begin(2)
      next if attrs =~ /\bsrc\s*=/i

      type = attrs[/\btype\s*=\s*["']?([^"'\s>]+)/i, 1].to_s.downcase
      next unless JS_TYPES.include?(type)

      line_comments(body).each do |offset|
        problems << "#{rel}:#{source[0, body_start + offset].count("\n") + 1}"
      end
    end
    problems
  end

  def check(root)
    problems = SOURCES.flat_map { |glob| Dir.glob(File.join(root, glob)) }.uniq.sort.flat_map do |path|
      scan_source(File.read(path, encoding: 'UTF-8'), path.delete_prefix("#{root}/"))
    end
    return if problems.empty?

    raise Jekyll::Errors::FatalException,
          "Inline <script> uses a // comment (breaks the production build, which joins " \
          "inline scripts onto one line). Use /* */ instead:\n  #{problems.join("\n  ")}"
  end
end

if defined?(Jekyll::Hooks)
  Jekyll::Hooks.register :site, :post_read do |site|
    InlineScriptGuard.check(site.source)
  end
end
