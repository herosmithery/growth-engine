#!/usr/bin/env python3
import re

files = [
    'lib/niches/example-configs.ts',
    'lib/niches/universal-business-config.ts'
]

def fix_apostrophes_in_single_quotes(content):
    """Fix unescaped apostrophes within single-quoted strings"""
    # This regex finds single-quoted strings and replaces unescaped ' with \'
    def replace_func(match):
        string_content = match.group(1)
        # Replace ' with \' only if not already escaped
        fixed_content = re.sub(r"(?<!\\)'", r"\'", string_content)
        return f"'{fixed_content}'"

    # Match single-quoted strings (accounting for already escaped quotes)
    pattern = r"'([^'\\]*(?:\\.[^'\\]*)*)'"
    result = re.sub(pattern, replace_func, content)
    return result

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    fixed = fix_apostrophes_in_single_quotes(content)

    if original != fixed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(fixed)
        print(f'Fixed {filepath}')
    else:
        print(f'No changes needed in {filepath}')

print('Done!')
