module.exports = {
  schema: [
    {
      'http://localhost:8080/v1/graphql': {
        headers: {
          'x-hasura-admin-secret':
            process.env.HASURA_ADMIN_SECRET || 'myadminsecretkey',
        },
      },
    },
  ],
  documents: ['./src/**/*.ts', './src/**/*.graphql'],
  overwrite: true,
  generates: {
    './src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-operations'],
      config: {
        skipTypename: false,
        scalars: {
          uuid: 'string',
          timestamptz: 'string',
          jsonb: 'Record<string, any>',
          numeric: 'number',
        },
      },
    },
    './src/generated/graphql.schema.json': {
      plugins: ['introspection'],
    },
  },
};
