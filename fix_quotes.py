#!/usr/bin/env python3
import sys

files = [
    'lib/niches/example-configs.ts',
    'lib/niches/universal-business-config.ts'
]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace all curly apostrophes/quotes with straight ones
    content = content.replace('\u2019', "'")  # Right single quotation mark
    content = content.replace('\u2018', "'")  # Left single quotation mark
    content = content.replace('\u201d', '"')  # Right double quotation mark
    content = content.replace('\u201c', '"')  # Left double quotation mark

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f'Fixed {filepath}')

print('All files fixed!')
