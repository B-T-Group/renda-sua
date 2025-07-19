# Frontend Application

## Google Maps Integration

To enable Google Places Autocomplete for address input, you need to set up a Google Maps API key:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Places API
   - Geocoding API
   - Maps JavaScript API
4. Create credentials (API Key)
5. Set the API key in your environment variables:

```bash
# For Create React App
REACT_APP_GOOGLE_MAPS_API_KEY=your_api_key_here

# For Next.js
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

### Troubleshooting Google Maps API Issues

If you encounter the error `Cannot destructure property 'jI' of '(intermediate value)' as it is undefined`, it usually means:

1. **Invalid API Key**: The API key is not valid or has restrictions
2. **API Not Enabled**: The Places API is not enabled for the project
3. **Billing Issues**: The Google Cloud project has billing issues
4. **Quota Exceeded**: The API quota has been exceeded

**To fix this:**

1. **Verify API Key**: Make sure your API key is correct and not restricted
2. **Enable APIs**: Ensure all required APIs are enabled in Google Cloud Console
3. **Check Billing**: Verify that billing is enabled for your Google Cloud project
4. **Set Environment Variable**: Make sure the environment variable is properly set:

```bash
# Create a .env file in the frontend directory
echo "REACT_APP_GOOGLE_MAPS_API_KEY=your_actual_api_key_here" > .env
```

5. **Restart Development Server**: After setting the environment variable, restart your development server

### Google Places API Migration

This application uses a smart fallback approach for Google Places Autocomplete:

- **Primary**: Uses `PlaceAutocompleteElement` when available (future-proof)
- **Fallback**: Automatically falls back to traditional `Autocomplete` class for compatibility
- **Best Performance**: Uses `loading=async` parameter for optimal loading
- **Error Handling**: Graceful error handling and user feedback

The fallback approach ensures:

- **Maximum Compatibility**: Works with all Google Maps API versions
- **Future-Proof**: Ready for new API features when available
- **No Breaking Changes**: Seamless transition between API versions
- **Better UX**: Clear loading states and error messages

For more information, see:

- [Google Places Migration Guide](https://developers.google.com/maps/documentation/javascript/places-migration-overview)
- [PlaceAutocompleteElement Documentation](https://developers.google.com/maps/documentation/javascript/reference/places-autocomplete-element)

## Features

- **Address Autocomplete**: Users can search for addresses using Google Places API
- **Country-State-City Integration**: Addresses are automatically converted to proper country/state/city codes
- **Manual Input Fallback**: Users can still manually enter addresses if needed
- **Multi-language Support**: Full internationalization support for English and French
