"""Structural validation of REMBG Lambda handler (no deps required)."""
import ast
import sys
from pathlib import Path

def validate_handler_structure():
    """Validate handler.py structure without importing it."""
    print("=" * 60)
    print("VALIDATING LAMBDA HANDLER STRUCTURE")
    print("=" * 60)
    
    handler_path = Path(__file__).parent / "handler.py"
    
    with open(handler_path, 'r') as f:
        code = f.read()
    
    try:
        tree = ast.parse(code)
        print("✅ Python syntax valid")
    except SyntaxError as e:
        print(f"❌ Syntax error: {e}")
        return False
    
    # Check for required imports
    required_imports = ['base64', 'io', 'PIL', 'rembg']
    found_imports = []
    
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                found_imports.append(alias.name.split('.')[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                found_imports.append(node.module.split('.')[0])
    
    print("\nChecking imports:")
    for imp in required_imports:
        if imp in found_imports:
            print(f"  ✅ {imp}")
        else:
            print(f"  ❌ {imp} - MISSING")
            return False
    
    # Check for handler function
    has_handler = False
    handler_params = []
    
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == 'handler':
            has_handler = True
            handler_params = [arg.arg for arg in node.args.args]
            break
    
    print("\nChecking handler function:")
    if has_handler:
        print(f"  ✅ handler() function exists")
        print(f"  ✅ Parameters: {handler_params}")
        if len(handler_params) == 2:
            print(f"  ✅ Correct parameter count (2)")
        else:
            print(f"  ❌ Wrong parameter count (expected 2, got {len(handler_params)})")
            return False
    else:
        print(f"  ❌ handler() function not found")
        return False
    
    # Check for error handling
    has_try_except = False
    for node in ast.walk(tree):
        if isinstance(node, ast.Try):
            has_try_except = True
            break
    
    print("\nChecking error handling:")
    if has_try_except:
        print(f"  ✅ try-except block found")
    else:
        print(f"  ⚠️  No try-except found (may not be critical)")
    
    return True


def validate_requirements():
    """Validate requirements.txt."""
    print("\n" + "=" * 60)
    print("VALIDATING REQUIREMENTS.TXT")
    print("=" * 60)
    
    req_path = Path(__file__).parent / "requirements.txt"
    
    with open(req_path, 'r') as f:
        requirements = f.read().strip().split('\n')
    
    required_packages = ['rembg', 'pillow', 'onnxruntime']
    
    print("\nChecking required packages:")
    for pkg in required_packages:
        found = any(pkg.lower() in req.lower() for req in requirements)
        if found:
            print(f"  ✅ {pkg}")
        else:
            print(f"  ❌ {pkg} - MISSING")
            return False
    
    return True


def validate_handler_logic():
    """Validate handler logic patterns."""
    print("\n" + "=" * 60)
    print("VALIDATING HANDLER LOGIC")
    print("=" * 60)
    
    handler_path = Path(__file__).parent / "handler.py"
    
    with open(handler_path, 'r') as f:
        code = f.read()
    
    checks = {
        "Returns success/error dict": '"success"' in code,
        "Handles imageBase64 input": 'imageBase64' in code or 'image_base64' in code,
        "Handles format parameter": 'format' in code,
        "Base64 encoding": 'base64.b64encode' in code,
        "Base64 decoding": 'base64.b64decode' in code,
        "Error handling": 'except Exception' in code,
        "Image processing": 'Image.open' in code or 'remove(' in code,
    }
    
    all_passed = True
    for check, result in checks.items():
        status = "✅" if result else "❌"
        print(f"  {status} {check}")
        if not result:
            all_passed = False
    
    return all_passed


def main():
    """Run all validations."""
    print("\n")
    print("╔" + "=" * 58 + "╗")
    print("║" + " REMBG Lambda Handler - Structure Validation" + " " * 14 + "║")
    print("╚" + "=" * 58 + "╝")
    print()
    
    results = []
    results.append(validate_handler_structure())
    results.append(validate_requirements())
    results.append(validate_handler_logic())
    
    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY")
    print("=" * 60)
    
    tests = ["Handler Structure", "Requirements", "Handler Logic"]
    for test, result in zip(tests, results):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test}")
    
    passed = sum(results)
    total = len(results)
    print(f"\nResults: {passed}/{total} validations passed")
    
    if passed == total:
        print("\n🎉 ALL VALIDATIONS PASSED!")
        print("\n✅ Lambda handler is structurally correct and ready to deploy.")
        print("   Note: Full functional testing requires AWS Lambda deployment")
        print("   with rembg dependencies installed.")
    else:
        print(f"\n❌ {total - passed} validation(s) failed")
    
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
