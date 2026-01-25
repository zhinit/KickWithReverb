---
name: webdev
description: Web development standards - use when working with .ts, .tsx, .js, .jsx, .css, .html files
---

When writing web code, follow these conventions:

## TypeScript

- Use strict mode, no implicit any
- Prefer interfaces over types for object shapes
- Use named exports over default exports
- Prefer const over let, never use var
- Use template literals for string interpolation

### Type Safety

- Never bypass the type system
- Never disable eslint rules - fix upstream instead
- Never use `any` types
- Never use `as` to get around type safety
- Never use bracket notation to avoid type safety warnings
- Never add type annotations when they can be inferred
- Never use unnecessary `satisfies` statements
- Always provide generic parameters to generic types

## React

- Use functional components with hooks (no class components)
- Keep components small and focused
- Extract custom hooks for reusable logic
- Use React.FC sparingly, prefer explicit prop types
- Memoize expensive computations with useMemo/useCallback

## Component Structure

```tsx
// 1. Imports
// 2. Types/Interfaces
// 3. Component
// 4. Styles (if co-located)
```

## State Management

- Local state: useState/useReducer
- Shared state: Context API or Zustand (adjust as needed)
- Server state: TanStack Query (React Query)

## Styling

- Use CSS variables for theming
- Don't use tailwind

## File Naming

- Components: PascalCase (Button.tsx)
- Utilities/hooks: camelCase (useAuth.ts)
- Test files: Component.test.tsx

## Testing

- Use Vitest or Jest for unit tests
- React Testing Library for component tests
- Test behavior, not implementation

## Performance

- Lazy load routes and heavy components
- Optimize images (WebP, proper sizing)
- Minimize bundle size, use dynamic imports
