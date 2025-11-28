You have access to the hasura-mcp tool.

Your tasks:

1. Use the hasura-mcp tool to fetch all tables and their columns from the connected Hasura instance.

   - Get every table name
   - Get the columns for each table (name + type)
   - Convert table names to singular (e.g., "orders" → "Order", "users" → "User", "agent_locations" → "AgentLocation")

2. For each table, generate a Python model file in:
   apps/cdk/src/lambda-layer/models/

   Model requirements:

   - Use Pydantic BaseModel
   - Fields should match the Hasura column names
   - Infer Python types from Hasura column types
   - All models must be camelCase class names based on the singular table name (e.g., orders → Order)
   - File name should match the model in snake_case (e.g., order.py)

3. After generating all model files, update the CDK layer configuration so that a Lambda Layer is created for these models.

   - The layer should bundle everything under apps/cdk/src/lambda-layer/models
   - Update CDK to export this layer
   - Ensure Lambda functions can import these models via the layer (e.g., `from models.order import Order`)

4. Print:
   - The summary of tables found
   - All generated file paths
   - Any CDK changes you made

Do NOT guess columns—always fetch them using the hasura-mcp tool first.
Make sure all Python code generated is syntactically correct and fully functional.
