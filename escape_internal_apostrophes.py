#!/usr/bin/env python3
import re

files = [
    'lib/niches/example-configs.ts',
    'lib/niches/universal-business-config.ts'
]

def escape_apostrophes_in_string(match):
    """Escape apostrophes within a single-quoted string, but not the delimiters"""
    opening_quote = match.group(1)
    content = match.group(2)
    closing_quote = match.group(3)

    # Escape any unescaped apostrophes in the content
    # Replace ' with \' only if not already escaped
    escaped_content = content.replace("\\'", "<<<ALREADY_ESCAPED>>>")
    escaped_content = escaped_content.replace("'", "\\'")
    escaped_content = escaped_content.replace("<<<ALREADY_ESCAPED>>>", "\\'")

    return opening_quote + escaped_content + closing_quote

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Match single-quoted strings: opening ', content, closing '
    # This regex captures strings that may already have escaped quotes
    pattern = r"(: |= )('([^']*(?:\\'[^']*)*)')"

    def replace_string(match):
        prefix = match.group(1)
        full_string = match.group(2)
        string_content = match.group(3)

        # Skip if it's already properly escaped (no unescaped ' inside)
        # Check for unescaped apostrophes
        temp = string_content.replace("\\'", "")  # Remove escaped ones
        if "'" in temp:
            # Has unescaped apostrophes, need to escape them
            escaped = string_content.replace("\\'", "<<<TEMP>>>")
            escaped = escaped.replace("'", "\\'")
            escaped = escaped.replace("<<<TEMP>>>", "\\'")
            return prefix + "'" + escaped + "'"
        else:
            return match.group(0)  # No changes needed

    fixed = re.sub(pattern, replace_string, content)

    if original != fixed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(fixed)
        print(f'Fixed {filepath}')
    else:
        print(f'No changes needed in {filepath}')

print('Done!')
