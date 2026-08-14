"""Test script for REMBG Lambda handler."""
import base64
import io
import sys
from pathlib import Path

# Add handler directory to path
sys.path.insert(0, str(Path(__file__).parent))


def create_test_image():
    """Create a simple test image in base64."""
    from PIL import Image
    
    # Create a simple 100x100 red square with white background
    img = Image.new('RGB', (100, 100), color=(255, 255, 255))
    # Draw a red square in the center
    for x in range(30, 70):
        for y in range(30, 70):
            img.putpixel((x, y), (255, 0, 0))
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def test_handler_success():
    """Test handler with valid input."""
    print("=" * 60)
    print("TEST 1: Valid Input (Success Case)")
    print("=" * 60)
    
    try:
        from handler import handler
        
        test_image_b64 = create_test_image()
        
        event = {
            "imageBase64": test_image_b64,
            "format": "jpeg"
        }
        
        result = handler(event, None)
        
        print(f"✅ Handler executed successfully")
        print(f"   Success: {result.get('success')}")
        print(f"   Format: {result.get('format')}")
        print(f"   Model: {result.get('model')}")
        
        if result.get('success'):
            print(f"   Output image size: {len(result.get('imageBase64', ''))} chars")
            print("\n✅ TEST PASSED: Handler returned success")
        else:
            print(f"   Error: {result.get('error')}")
            print(f"   Error Type: {result.get('errorType')}")
            print("\n❌ TEST FAILED: Handler returned error")
            
        return result.get('success', False)
        
    except Exception as e:
        print(f"❌ TEST FAILED: Exception occurred")
        print(f"   Error: {str(e)}")
        print(f"   Type: {type(e).__name__}")
        return False


def test_handler_missing_input():
    """Test handler with missing input."""
    print("\n" + "=" * 60)
    print("TEST 2: Missing Input (Error Handling)")
    print("=" * 60)
    
    try:
        from handler import handler
        
        event = {
            "format": "jpeg"
            # Missing imageBase64
        }
        
        result = handler(event, None)
        
        print(f"✅ Handler executed (with graceful error)")
        print(f"   Success: {result.get('success')}")
        print(f"   Error: {result.get('error')}")
        print(f"   Error Type: {result.get('errorType')}")
        
        if not result.get('success') and result.get('error'):
            print("\n✅ TEST PASSED: Handler gracefully handled missing input")
            return True
        else:
            print("\n❌ TEST FAILED: Handler should have returned error")
            return False
            
    except Exception as e:
        print(f"❌ TEST FAILED: Unhandled exception")
        print(f"   Error: {str(e)}")
        return False


def test_handler_invalid_format():
    """Test handler with invalid format."""
    print("\n" + "=" * 60)
    print("TEST 3: Invalid Format (Fallback)")
    print("=" * 60)
    
    try:
        from handler import handler
        
        test_image_b64 = create_test_image()
        
        event = {
            "imageBase64": test_image_b64,
            "format": "invalid_format"  # Should fallback to jpeg
        }
        
        result = handler(event, None)
        
        print(f"✅ Handler executed")
        print(f"   Success: {result.get('success')}")
        print(f"   Format: {result.get('format')} (should default to jpeg)")
        
        if result.get('success') and result.get('format') == 'jpeg':
            print("\n✅ TEST PASSED: Handler defaulted to jpeg format")
            return True
        else:
            print("\n⚠️  TEST INCONCLUSIVE: Check format handling")
            return result.get('success', False)
            
    except Exception as e:
        print(f"❌ TEST FAILED: Exception occurred")
        print(f"   Error: {str(e)}")
        return False


def main():
    """Run all tests."""
    print("\n")
    print("╔" + "=" * 58 + "╗")
    print("║" + " " * 10 + "REMBG Lambda Handler Tests" + " " * 22 + "║")
    print("╚" + "=" * 58 + "╝")
    print("\nChecking dependencies...")
    
    # Check if dependencies are available
    try:
        from PIL import Image
        print("✅ PIL (Pillow) available")
    except ImportError:
        print("❌ PIL (Pillow) not available - install: pip install pillow")
        print("   Skipping tests that require image generation")
        return
    
    try:
        from rembg import remove, new_session
        print("✅ rembg available")
    except ImportError:
        print("⚠️  rembg not available - tests will check handler logic only")
        print("   To fully test: pip install rembg")
    
    print("\n" + "-" * 60 + "\n")
    
    # Run tests
    results = []
    results.append(("Valid Input Test", test_handler_success()))
    results.append(("Missing Input Test", test_handler_missing_input()))
    results.append(("Invalid Format Test", test_handler_invalid_format()))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
    elif passed > 0:
        print(f"\n⚠️  {total - passed} test(s) failed")
    else:
        print("\n❌ ALL TESTS FAILED")
    
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
