"""
Hasura-driven Pydantic model generator.

This script introspects the Hasura GraphQL schema and generates Pydantic
models for each table-like object type. It is designed to be idempotent:
it will only create models that do not already exist.

Configuration:
    HASURA_GRAPHQL_ENDPOINT - HTTP endpoint for Hasura GraphQL
    HASURA_ADMIN_SECRET     - Hasura admin secret
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from textwrap import indent
from typing import Any, Dict, List, Optional, Tuple

import json
import os
import sys

import requests


INTROSPECTION_QUERY = """
query IntrospectSchema {
  __schema {
    types {
      kind
      name
      fields {
        name
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
            }
          }
        }
      }
      enumValues {
        name
      }
    }
  }
}
"""


@dataclass
class FieldTypeInfo:
    is_list: bool
    base_kind: str
    base_name: str
    is_nullable: bool


def _get_env(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _call_hasura(
    endpoint: str,
    admin_secret: str,
    query: str,
    variables: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    payload = {"query": query, "variables": variables or {}}
    headers = {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": admin_secret,
    }
    response = requests.post(endpoint, json=payload, headers=headers, timeout=15)
    response.raise_for_status()
    data = response.json()
    if "errors" in data:
        raise RuntimeError(f"Hasura errors: {json.dumps(data['errors'], indent=2)}")
    return data.get("__schema") or data.get("data", {})


def _unwrap_type(type_node: Dict[str, Any]) -> FieldTypeInfo:
    is_list = False
    # Check if the outermost wrapper is NON_NULL (field is required)
    is_nullable = type_node.get("kind") != "NON_NULL"
    
    node = type_node
    while node.get("kind") in {"NON_NULL", "LIST"}:
        if node["kind"] == "LIST":
            is_list = True
        node = node.get("ofType") or {}
    return FieldTypeInfo(
        is_list=is_list,
        base_kind=node.get("kind", ""),
        base_name=node.get("name", ""),
        is_nullable=is_nullable,
    )


def _to_singular(word: str) -> str:
    """
    Convert a single word from plural to singular.
    
    Explicit mappings:
    - addresses -> address
    - businesses -> business
    - categories -> category
    
    For all other words ending in 's', simply remove the trailing 's'.
    """
    # Explicit mappings for special cases
    explicit_mappings = {
        "addresses": "address",
        "businesses": "business",
        "categories": "category",
    }
    
    # Check explicit mappings first
    if word in explicit_mappings:
        return explicit_mappings[word]
    
    # For all other words ending in 's', remove the trailing 's'
    # But not if word ends with "ss" (like "address" which is already singular)
    if word.endswith("s") and len(word) > 1 and not word.endswith("ss"):
        return word[:-1]
    
    return word


def _to_class_name(type_name: str) -> str:
    """
    Convert plural table names to singular class names.
    
    Processes each underscore-separated part individually to handle cases like:
    - user_types -> UserType (types -> type)
    - item_categories -> ItemCategory (categories -> category)
    - addresses -> Address (addresses -> address)
    """
    parts = type_name.split("_")
    # Convert each part to singular individually
    singular_parts = [_to_singular(part) for part in parts]
    return "".join(p.capitalize() for p in singular_parts if p)


def _python_type_for_scalar(name: str) -> str:
    mapping = {
        "Int": "int",
        "bigint": "int",
        "numeric": "float",
        "float8": "float",
        "Float": "float",
        "String": "str",
        "text": "str",
        "uuid": "str",
        "Boolean": "bool",
        "timestamptz": "datetime.datetime",
        "date": "datetime.date",
        "time": "datetime.time",
    }
    return mapping.get(name, "str")


def _load_schema(endpoint: str, admin_secret: str) -> Dict[str, Any]:
    data = _call_hasura(endpoint, admin_secret, INTROSPECTION_QUERY)
    return data.get("__schema") or data


def _should_skip_type(name: str) -> bool:
    """
    Check if a type should be skipped (excluded from model generation).
    
    Skips:
    - GraphQL built-in types (query_root, mutation_root, subscription_root)
    - Aggregate types (ending with _aggregate)
    - Field types (ending with Field, like AvgField, MinField, MaxField, etc.)
    - Mutation response types (ending with MutationResponse)
    """
    skip_names = {"query_root", "mutation_root", "subscription_root"}
    if name in skip_names:
        return True
    
    # Skip aggregate types
    if name.endswith("_aggregate"):
        return True
    
    # Skip field types (AvgField, MinField, MaxField, AggregateField, etc.)
    if name.endswith("fields"):
        return True
    
    # Skip mutation response types
    if name.endswith("mutation_response"):
        return True

    print(f"Skipping type: {name}")
    
    return False


def _collect_types(schema: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, List[str]]]:
    objects: Dict[str, Any] = {}
    enums: Dict[str, List[str]] = {}
    for type_def in schema.get("types", []):
        name = type_def.get("name")
        if not name or name.startswith("__"):
            continue
        
        # Skip generated types (aggregates, fields, mutation responses)
        if _should_skip_type(name):
            continue
        
        kind = type_def.get("kind")
        if kind == "OBJECT":
            objects[name] = type_def
        if kind == "ENUM":
            values = [v["name"] for v in type_def.get("enumValues") or []]
            enums[name] = values
    return objects, enums


def _model_file_path(models_dir: Path, type_name: str) -> Path:
    class_name = _to_class_name(type_name)
    return models_dir / f"{class_name}.py"


def _python_type_for_field(
    info: FieldTypeInfo,
    enums: Dict[str, List[str]],
    relationships: List[str],
) -> Tuple[str, Optional[str]]:
    base = info.base_name
    if not base or not base.strip():
        return "str", None  # Default to str for unknown types
    
    if base in enums:
        enum_name = _to_class_name(base)
        return enum_name, enum_name
    if info.base_kind == "SCALAR":
        return _python_type_for_scalar(base), None
    if info.base_kind == "OBJECT":
        rel_class = _to_class_name(base)
        if rel_class:
            relationships.append(rel_class)
            return rel_class, rel_class
    # Fallback for unknown types
    return "str", None


def _render_field(
    name: str,
    type_str: str,
    info: FieldTypeInfo,
    is_relationship: bool,
) -> str:
    # type_str should already be validated before calling this function
    if info.is_list:
        py_type = f"List[{type_str}]"
    else:
        py_type = type_str
    
    # Relationships should always be optional, regardless of GraphQL nullability
    if is_relationship:
        return f"{name}: Optional[{py_type}] | None = None"
    # Only make other fields optional if they are nullable
    elif info.is_nullable:
        return f"{name}: Optional[{py_type}] | None = None"
    else:
        # Required field - no Optional, no default value
        return f"{name}: {py_type}"


def _split_fields(
    type_def: Dict[str, Any],
    enums: Dict[str, List[str]],
    valid_object_names: set[str] | None = None,
) -> Tuple[List[Tuple[str, str, bool]], List[str], List[Tuple[str, List[str]]]]:
    fields_meta: List[Tuple[str, str, bool]] = []
    enum_defs: List[Tuple[str, List[str]]] = []
    relationships: List[str] = []
    for field in type_def.get("fields") or []:
        name = field["name"]
        if not name or name.startswith("__"):
            continue
        # Skip aggregate fields
        if name.endswith("_aggregate"):
            continue
        
        info = _unwrap_type(field["type"])
        type_name = info.base_name
        
        # Skip fields with missing or invalid type names
        if not type_name or not type_name.strip():
            continue
        
        # Skip fields that reference aggregate types
        if type_name.endswith("_aggregate"):
            continue
        
        # Skip fields that reference types we're not tracking (for relationships)
        if info.base_kind == "OBJECT":
            if valid_object_names and type_name not in valid_object_names:
                continue
        
        is_enum = type_name in enums
        is_scalar = info.base_kind == "SCALAR"
        is_rel = not is_scalar
        
        py_type, enum_name = _python_type_for_field(info, enums, relationships)
        
        # Skip if we couldn't determine a valid Python type or got empty string
        if not py_type or not py_type.strip() or py_type == "str":
            # If it's a relationship (not scalar) and we got "str", skip it
            if is_rel:
                continue
        
        if is_enum and enum_name:
            enum_defs.append((enum_name, enums[type_name]))
        field_line = _render_field(name, py_type, info, is_rel)
        fields_meta.append((name, field_line, is_rel))
    return fields_meta, relationships, enum_defs


def _render_enum(name: str, values: List[str]) -> str:
    lines = [f"class {name}(Enum):"]
    for value in values:
        lines.append(f"    {value.upper()} = \"{value}\"")
    return "\n".join(lines)


def _render_model(
    type_name: str,
    fields: List[Tuple[str, str, bool]],
    enum_defs: List[Tuple[str, List[str]]],
    relationships: List[str],
) -> str:
    class_name = _to_class_name(type_name)
    imports = [
        "from __future__ import annotations",
        "from typing import List, Optional, TYPE_CHECKING",
        "import datetime",
        "from enum import Enum",
        "from pydantic import BaseModel",
    ]
    if relationships:
        # Filter out empty strings and get unique sorted relationship names
        rel_names = sorted(set(r for r in relationships if r and r.strip()))
        if rel_names:
            rel_imports = ", ".join(rel_names)
            imports.append(f"if TYPE_CHECKING:\n    from . import {rel_imports}")
    header = "\n".join(imports) + "\n\n"
    enum_blocks = [
        _render_enum(name, values) for name, values in enum_defs
    ]
    enums_code = "\n\n\n".join(enum_blocks) + ("\n\n\n" if enum_blocks else "")
    class_header = f"class {class_name}(BaseModel):"
    if not fields:
        body = "    pass"
    else:
        body_lines = [line for _, line, _ in fields]
        body = indent("\n".join(body_lines), "    ")
    return header + enums_code + class_header + "\n" + body + "\n"


def _generate_for_type(
    models_dir: Path,
    type_name: str,
    type_def: Dict[str, Any],
    enums: Dict[str, List[str]],
    valid_object_names: set[str] | None = None,
) -> None:
    target = _model_file_path(models_dir, type_name)
    fields, relationships, enum_defs = _split_fields(type_def, enums, valid_object_names)
    code = _render_model(type_name, fields, enum_defs, relationships)
    target.write_text(code, encoding="utf-8")
    action = "Updated" if target.exists() else "Created"
    print(f"[generate_models] {action} model: {target.name}")


def main() -> None:
    try:
        endpoint = _get_env("HASURA_GRAPHQL_ENDPOINT")
        admin_secret = _get_env("HASURA_ADMIN_SECRET")
        schema = _load_schema(endpoint, admin_secret)
        objects, enums = _collect_types(schema)
        valid_object_names = set(objects.keys())
        # Generate models in the same directory as this script
        # This ensures models are always generated in apps/cdk/src/core-packages/rendasua_core_packages/models
        models_dir = Path(__file__).resolve().parent
        print(f"[generate_models] Generating models in: {models_dir}")
        for type_name, type_def in objects.items():
            _generate_for_type(models_dir, type_name, type_def, enums, valid_object_names)
    except Exception as exc:  # noqa: BLE001
        print(f"[generate_models] Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()


