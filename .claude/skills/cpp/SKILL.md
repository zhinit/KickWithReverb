---
name: cpp
description: C++ coding standards - use when working with .cpp, .hpp, .h, .cc files
---

When writing C++ code, follow these conventions:

## Standard & Compiler
- Target C++20 or later (adjust as needed)
- Compile with -Wall -Wextra -Werror

## Style & Formatting
- Use clang-format for formatting with "Mozilla" style
- Naming: PascalCase for types, camelCase for functions/variables, SCREAMING_SNAKE for macros
- Braces on new line for functions and control structures
- 4-space indentation (adjust as needed)

## Memory & Resources
- Prefer smart pointers (unique_ptr, shared_ptr) over raw pointers
- Use RAII for resource management
- Avoid manual new/delete

## Modern C++ Practices
- Use auto for complex types, explicit types for clarity
- Prefer range-based for loops
- Use constexpr where possible
- Prefer std::array over C-style arrays
- Use std::optional for nullable values
- Use std::string_view for non-owning string references

## Headers
- Use #pragma once for header guards
- Forward declare when possible to reduce compile times
- Include what you use (IWYU)

## Error Handling
- Use exceptions for exceptional cases
- Use std::expected or error codes for expected failures (C++23)
- noexcept for functions that don't throw

## Documentation
- Doxygen-style comments for public APIs
- Brief description, @param, @return, @throws
