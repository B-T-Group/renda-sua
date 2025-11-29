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
    node = type_node
    while node.get("kind") in {"NON_NULL", "LIST"}:
        if node["kind"] == "LIST":
            is_list = True
        node = node.get("ofType") or {}
    return FieldTypeInfo(
        is_list=is_list,
        base_kind=node.get("kind", ""),
        base_name=node.get("name", ""),
    )


def _to_class_name(type_name: str) -> str:
    parts = type_name.rstrip("s").split("_")
    return "".join(p.capitalize() for p in parts if p)


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


def _collect_types(schema: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, List[str]]]:
    objects: Dict[str, Any] = {}
    enums: Dict[str, List[str]] = {}
    skip = {"query_root", "mutation_root", "subscription_root"}
    for type_def in schema.get("types", []):
        name = type_def.get("name")
        if not name or name.startswith("__"):
            continue
        kind = type_def.get("kind")
        if kind == "OBJECT" and not name.endswith("_aggregate") and name not in skip:
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
    if base in enums:
        enum_name = _to_class_name(base)
        return enum_name, enum_name
    if info.base_kind == "SCALAR":
        return _python_type_for_scalar(base), None
    rel_class = _to_class_name(base)
    relationships.append(rel_class)
    return rel_class, rel_class


def _render_field(
    name: str,
    type_str: str,
    info: FieldTypeInfo,
    is_relationship: bool,
) -> str:
    prefix = "Optional[" if not is_relationship else "Optional["
    if info.is_list:
        py_type = f"List[{type_str}]"
    else:
        py_type = type_str
    return f"{name}: {prefix}{py_type}] | None = None"


def _split_fields(
    type_def: Dict[str, Any],
    enums: Dict[str, List[str]],
) -> Tuple[List[Tuple[str, str, bool]], List[str], List[Tuple[str, List[str]]]]:
    fields_meta: List[Tuple[str, str, bool]] = []
    enum_defs: List[Tuple[str, List[str]]] = []
    relationships: List[str] = []
    for field in type_def.get("fields") or []:
        name = field["name"]
        info = _unwrap_type(field["type"])
        type_name = info.base_name
        is_enum = type_name in enums
        is_scalar = info.base_kind == "SCALAR"
        is_rel = not is_scalar
        py_type, enum_name = _python_type_for_field(info, enums, relationships)
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
        rel_imports = ", ".join(sorted(set(relationships)))
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
) -> None:
    target = _model_file_path(models_dir, type_name)
    if target.exists():
        return
    fields, relationships, enum_defs = _split_fields(type_def, enums)
    code = _render_model(type_name, fields, enum_defs, relationships)
    target.write_text(code, encoding="utf-8")
    print(f"[generate_models] Created model: {target.name}")


def main() -> None:
    try:
        endpoint = _get_env("HASURA_GRAPHQL_ENDPOINT")
        admin_secret = _get_env("HASURA_ADMIN_SECRET")
        schema = _load_schema(endpoint, admin_secret)
        objects, enums = _collect_types(schema)
        base_dir = Path(__file__).resolve().parent
        models_dir = base_dir
        for type_name, type_def in objects.items():
            _generate_for_type(models_dir, type_name, type_def, enums)
    except Exception as exc:  # noqa: BLE001
        print(f"[generate_models] Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()


