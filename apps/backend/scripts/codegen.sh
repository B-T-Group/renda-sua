#!/bin/bash
set -e
export HASURA_ADMIN_SECRET=myadminsecretkey
echo "Running codegen with HASURA_ADMIN_SECRET=$HASURA_ADMIN_SECRET"
npx graphql-codegen --config codegen.js --verbose
