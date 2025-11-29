You are using the hasura-mcp.

Write a Python generation script that does the following:

1. Use the hasura-mcp introspection API to fetch:

   - All tables
   - All columns for each table
   - Column types
   - Primary keys
   - Foreign keys
   - Object and array relationships
   - Enums defined in Hasura metadata

2. For every table:

   - Generate a singular model name (users → User, order_items → OrderItem).
   - Create a Pydantic `BaseModel` class representing the table.
   - Add all table columns with correct Python typing.
   - Convert Hasura enums into Python `Enum` classes inside the same file.
   - Reference enums in the Pydantic model fields.

3. Handle relationships:

   - For object relationships:
     - Add an optional field named after the related model (e.g., customer: Customer | None).
   - For array relationships:
     - Add a List[RelatedModel] field.
   - **When a relationship adds a field referencing another model, automatically add the necessary import at the top of the file.**
   - **Do NOT recreate models if they already exist—regenerate only missing ones.**
   - If possible, **group related models together** based on foreign-key connectivity.

4. Output:

   - Write each generated model to:
     apps/cdk/src/core-packages/models/<ModelName>.py
   - Create or update:
     apps/cdk/src/core-packages/models/**init**.py
     Export all model classes inside **all**.

5. Lambda Layer:

   - Create a Lambda Layer that includes:
     - The generated models folder
     - A requirements.txt containing: pydantic
   - Ensure Lambda functions can import models like:
     from models.User import User

6. Model Requirements:

   - All models must subclass `pydantic.BaseModel`
   - Enum values must match Hasura enum values
   - Use correct Python types: int, float, str, bool, datetime, Optional[…], List[…]
   - Foreign key references must use the singular model name

7. Produce the following:
   - The Python generator script
   - The folder structure to be created
   - Sample generated model files
   - The Lambda layer directory structure
   - The CDK code modifications needed to include the layer in Lambda functions
   - The `requirements.txt` file for the layer

Ensure the final output is production-ready and idempotent (safe to run multiple times without duplicating models).
