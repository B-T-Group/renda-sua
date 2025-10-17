# Generated GraphQL Types

This directory contains auto-generated TypeScript types from the GraphQL schema.

## Files

- `graphql.ts` - TypeScript types and interfaces for GraphQL operations
- `graphql.schema.json` - Introspection result of the GraphQL server

## Usage

These files are automatically generated and should not be manually edited. They are generated from the Hasura GraphQL schema and any GraphQL queries/mutations defined in the codebase.

## Regeneration

To regenerate these files:

```bash
npm run codegen
```

To watch for changes and auto-regenerate:

```bash
npm run codegen:watch
```

## Environment Variables

Make sure to set the following environment variable:

- `HASURA_ADMIN_SECRET` - The admin secret for Hasura (defaults to 'myadminsecretkey')
