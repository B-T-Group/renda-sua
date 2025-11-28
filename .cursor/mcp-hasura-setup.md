# Hasura GraphQL Server MCP Setup Guide

This guide explains how to configure the Hasura GraphQL Server MCP in Cursor to enable AI agents to discover schema, execute GraphQL queries/mutations, and interact with your Hasura instance.

## Prerequisites

- Cursor IDE installed
- Access to your Hasura GraphQL endpoint
- Hasura admin secret

## Hasura Endpoints

Based on your project configuration:

- **Development**: `https://healthy-mackerel-72.hasura.app/v1/graphql`
- **Production**: `https://rendasua-prod.hasura.app/v1/graphql`
- **Local**: `http://localhost:8080/v1/graphql`

**Admin Secret**: `myadminsecretkey`

## Setup Instructions

### Step 1: Open Cursor Settings

1. Open Cursor Settings

   - **macOS**: `Cmd + ,` or `Cursor > Settings`
   - **Windows/Linux**: `Ctrl + ,` or `File > Preferences > Settings`

2. Navigate to MCP Settings
   - Go to **Features > MCP** (or search for "MCP" in settings)

### Step 2: Add Hasura MCP Server

1. Click the **"+ Add New MCP Server"** button

2. Configure the server with the following:

   **Name**: `Hasura GraphQL Server` (or any name you prefer)

   **Type**: `stdio` (standard input/output)

   **Command**: `/bin/bash`

   **Arguments**:

   ```
   /Users/besongsamuel/Documents/Github/rs/rendasua/hasura_mcp/start.sh
   ```

   **Working Directory** (optional but recommended):

   ```
   /Users/besongsamuel/Documents/Github/rs/rendasua/hasura_mcp
   ```

   **Environment Variables** (optional - defaults are set in the script):

   - `HASURA_GRAPHQL_ENDPOINT`: `https://healthy-mackerel-72.hasura.app/v1/graphql`
   - `HASURA_GRAPHQL_ADMIN_SECRET`: `myadminsecretkey`

### Step 3: Alternative Configuration (Using Environment Variables)

If you prefer to use environment variables, create a wrapper script:

**For macOS/Linux** (`~/.cursor/mcp-hasura.sh`):

```bash
#!/bin/bash
export HASURA_GRAPHQL_ENDPOINT="https://healthy-mackerel-72.hasura.app/v1/graphql"
export HASURA_GRAPHQL_ADMIN_SECRET="myadminsecretkey"
npx -y @modelcontextprotocol/server-hasura-graphql "$HASURA_GRAPHQL_ENDPOINT" --admin-secret "$HASURA_GRAPHQL_ADMIN_SECRET"
```

Then use:

- **Command**: `bash ~/.cursor/mcp-hasura.sh`

**For Windows** (`%USERPROFILE%\.cursor\mcp-hasura.bat`):

```batch
@echo off
set HASURA_GRAPHQL_ENDPOINT=https://healthy-mackerel-72.hasura.app/v1/graphql
set HASURA_GRAPHQL_ADMIN_SECRET=myadminsecretkey
npx -y @modelcontextprotocol/server-hasura-graphql %HASURA_GRAPHQL_ENDPOINT% --admin-secret %HASURA_GRAPHQL_ADMIN_SECRET%
```

Then use:

- **Command**: `%USERPROFILE%\.cursor\mcp-hasura.bat`

### Step 4: Verify Configuration

1. After adding the server, click the **refresh** button to populate the tool list
2. You should see Hasura MCP tools available:
   - `hasura-mcp_list_tables`
   - `hasura-mcp_describe_table`
   - `hasura-mcp_run_graphql_query`
   - `hasura-mcp_run_graphql_mutation`
   - And more...

### Step 5: Test the Connection

Try using the MCP tools in Composer:

- Ask: "List all tables in Hasura"
- The agent should use `hasura-mcp_list_tables` to fetch the schema

## Troubleshooting

### "Invalid URL" Error

If you see an "Invalid URL" error:

1. Verify the endpoint URL is correct
2. Check that the admin secret is correct
3. Ensure the Hasura instance is accessible
4. Try using the full URL with `/v1/graphql` path

### Connection Timeout

If connection times out:

1. Check your network connection
2. Verify the Hasura instance is running
3. Check firewall settings
4. Try the local endpoint if available: `http://localhost:8080/v1/graphql`

### Tools Not Appearing

If tools don't appear:

1. Click the refresh button in MCP settings
2. Restart Cursor
3. Check the MCP server logs in Cursor's output panel
4. Verify the command is correct and executable

## Environment-Specific Configuration

### Development Environment

```bash
npx -y @modelcontextprotocol/server-hasura-graphql https://healthy-mackerel-72.hasura.app/v1/graphql --admin-secret myadminsecretkey
```

### Production Environment

```bash
npx -y @modelcontextprotocol/server-hasura-graphql https://rendasua-prod.hasura.app/v1/graphql --admin-secret <production-admin-secret>
```

### Local Development

```bash
npx -y @modelcontextprotocol/server-hasura-graphql http://localhost:8080/v1/graphql --admin-secret myadminsecretkey
```

## Security Notes

⚠️ **Important**: The admin secret provides full access to your Hasura instance. Keep it secure and:

- Don't commit secrets to version control
- Use environment variables for sensitive values
- Consider using different secrets for different environments
- Rotate secrets regularly

## Additional Resources

- [Hasura MCP Documentation](https://cursor.directory/mcp/hasura-graphql-serve)
- [Model Context Protocol Guide](https://modelcontextprotocol.io)
- [Hasura GraphQL Documentation](https://hasura.io/docs)
