You are using the hasura-mcp.  
Write a script that:

1. Uses the hasura-mcp introspection to fetch:

   - All tables
   - Columns for each table
   - Column types
   - Primary keys
   - Foreign keys / relationships
   - Enums defined in Hasura metadata

2. For every table:

   - Create a singular Python model name (e.g., users → User, order_items → OrderItem).
   - Create a Python Pydantic model for each table.
   - Include fields for every column with correct Python typing.
   - Convert Hasura enum types into Python Enums in the same file:
     - Use Python's `enum.Enum`
     - Reference the enum in the Pydantic model

3. Relationships:

   - For object relationships:
     - Add an optional field named after the related table’s singular model.
   - For array relationships:
     - Add a List[] field referencing the related type.
   - These relationship fields must be optional and default to None.

4. Output directory:
   - Write all generated models to:
     apps/cdk/src/lambda-layer/models/
     One file per model:
     <model_name>.py
5. Add an **init**.py file exporting all models.

6. Lambda Layer:

   - Create a new Lambda Layer in the CDK project for these models.
   - The layer should include:
     - The generated models folder
     - Pydantic (add it to requirements)
   - Update the CDK stack so that Lambda functions can import from:
     layer/models
     Example import:
     from models.User import User

7. Ensure:
   - All models are Pydantic BaseModel subclasses
   - Enum values come directly from Hasura enum definitions
   - Correct typing: Optional, List, int, float, str, datetime, bool, etc.
   - Foreign key references use the singular model name.

Finally:
Generate all the code, including:

- The Python generator script
- The generated models
- The Lambda layer folder structure
- The CDK modifications needed to include the layer
- Requirements file for the layer with pydantic
