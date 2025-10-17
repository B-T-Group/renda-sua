#!/bin/bash
set -e
export HASURA_ADMIN_SECRET=myadminsecretkey
echo "Running codegen in watch mode with HASURA_ADMIN_SECRET=$HASURA_ADMIN_SECRET"
npx graphql-codegen --config codegen.js --watch
