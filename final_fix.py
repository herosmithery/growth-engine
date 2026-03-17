#!/usr/bin/env python3
"""
Final fix: escape ALL apostrophes in single-quoted strings
"""
import re

files = [
    'lib/niches/example-configs.ts',
    'lib/niches/universal-business-config.ts'
]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace contractions with escaped versions
    replacements = {
        "': 'I'm": "': 'I\\'m",
        " I'm ": " I\\'m ",
        "you're": "you\\'re",
        "we'll": "we\\'ll",
        "We're": "We\\'re",
        "It's": "It\\'s",
        "Let's": "Let\\'s",
        "What's": "What\\'s",
        "That's": "That\\'s",
        "don't": "don\\'t",
        "haven't": "haven\\'t",
        "we'd": "we\\'d",
        "You're": "You\\'re",
        "I'll": "I\\'ll",
        "We'd": "We\\'d",
        "Haven't": "Haven\\'t",
        "Can't": "Can\\'t"
    }

    for old, new in replacements.items():
        content = content.replace(old, new)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"Fixed {filepath}")

print("Done!")
