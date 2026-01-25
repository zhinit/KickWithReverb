---
name: python
description: Python coding standards - use when working with .py files
---

When writing Python code, follow these conventions:

## Style & Formatting
- Use type hints for all function signatures and class attributes
- Maximum line length: 88 characters
- Use double quotes for strings

## Preferred Patterns
- Use dataclasses for simple data structures
- Use Pydantic for data validation and settings
- Prefer list/dict comprehensions over map/filter when readable
- Use context managers for resource handling

## Imports
- Group imports: stdlib, third-party, local (separated by blank lines)
- Prefer explicit imports over wildcard imports
- Use absolute imports

## Documentation
- Docstrings in Google style for public functions/classes
- Include Args, Returns, and Raises sections where applicable

## Error Handling
- Use specific exception types, avoid bare except
- Create custom exceptions for domain-specific errors

## Testing
- Use pytest as the test framework
- Name test files as test_*.py
- Use fixtures for shared setup
