#!/usr/bin/env python3
"""
Fix all quote issues in TypeScript files:
1. Replace curly/smart quotes with straight quotes
2. Properly escape apostrophes in single-quoted strings
"""

files = [
    'lib/niches/example-configs.ts',
    'lib/niches/universal-business-config.ts'
]

for filepath in files:
    print(f"Processing {filepath}...")

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Step 1: Replace all Unicode curly quotes with straight ASCII quotes
    replacements = {
        '\u2018': "'",  # Left single quotation mark
        '\u2019': "'",  # Right single quotation mark
        '\u201c': '"',  # Left double quotation mark
        '\u201d': '"',  # Right double quotation mark
    }

    for old, new in replacements.items():
        content = content.replace(old, new)

    # Step 2: Fix escaped quotes at end of strings (from sed damage)
    # Remove backslashes before closing quotes: '\' -> '
    content = content.replace("\\'", "'")
    content = content.replace('\\"', '"')

    # Step 3: Now properly escape apostrophes within single-quoted strings
    lines = content.split('\n')
    fixed_lines = []

    for line in lines:
        # Find single-quoted string assignments (: 'text' or = 'text')
        if (": '" in line or "= '" in line) and not line.strip().startswith('//'):
            # Simple approach: find strings between single quotes after : or =
            import re

            def fix_string(match):
                prefix = match.group(1)
                string_content = match.group(2)

                # Escape any apostrophes in the content
                escaped = string_content.replace("'", "\\'")

                return f"{prefix}'{escaped}'"

            # Match pattern like : 'content' or = 'content'
            # This regex captures the delimiter and the string content
            line = re.sub(r"([:=]\s*)'([^']*)'", fix_string, line)

        fixed_lines.append(line)

    content = '\n'.join(fixed_lines)

    # Write the fixed content
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✓ Fixed {filepath}")

print("\nAll files processed!")
