#!/usr/bin/env python3
"""
Comprehensive quote fixer - handles all apostrophes in single-quoted strings
"""
import re

files = [
    'lib/niches/example-configs.ts',
    'lib/niches/universal-business-config.ts'
]

def fix_single_quoted_strings(line):
    """Fix apostrophes in single-quoted string values"""
    # Pattern to match key: 'value' or key = 'value'
    # We need to handle strings that may span the entire line

    # Find all patterns like : 'xxx' or = 'xxx'
    result = []
    i = 0

    while i < len(line):
        # Look for : ' or = '
        if i < len(line) - 2 and line[i:i+2] in (": '", "= '"):
            # Found start of a single-quoted string
            result.append(line[i:i+2])  # Add ": '" or "= '"
            i += 2

            # Now collect everything until the closing unescaped '
            string_content = []
            while i < len(line):
                if line[i] == "'" and (i == 0 or line[i-1] != '\\'):
                    # Found closing quote
                    # Escape all apostrophes in the content
                    content = ''.join(string_content)
                    # Remove any existing escapes first
                    content = content.replace("\\'", "'")
                    # Now escape all apostrophes
                    content = content.replace("'", "\\'")
                    result.append(content)
                    result.append("'")  # Add closing quote
                    i += 1
                    break
                elif line[i] == '\\' and i + 1 < len(line) and line[i+1] == "'":
                    # Already escaped apostrophe, skip both characters
                    string_content.append(line[i:i+2])
                    i += 2
                else:
                    string_content.append(line[i])
                    i += 1
        else:
            result.append(line[i])
            i += 1

    return ''.join(result)

for filepath in files:
    print(f"Processing {filepath}...")

    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    fixed_lines = []
    for line in lines:
        # Skip comments and template strings
        stripped = line.strip()
        if stripped.startswith('//') or '`' in line:
            fixed_lines.append(line)
        elif (": '" in line or "= '" in line):
            fixed_line = fix_single_quoted_strings(line)
            fixed_lines.append(fixed_line)
        else:
            fixed_lines.append(line)

    content = ''.join(fixed_lines)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✓ Fixed {filepath}")

print("\n✅ All files fixed!")
