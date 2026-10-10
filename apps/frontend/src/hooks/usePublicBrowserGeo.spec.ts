import {
  PUBLIC_BROWSER_GEO_STORAGE_KEY,
  subscribeBrowserCatalogGeo,
} from './usePublicBrowserGeo';

describe('subscribeBrowserCatalogGeo', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('requests a fresh fix and saves it for signed-in and signed-out catalogs', () => {
    const getCurrentPosition = jest.fn(
      (success: (pos: { coords: { latitude: number; longitude: number } }) => void) => {
        success({ coords: { latitude: 4.05, longitude: 9.7 } });
      }
    );
    const onCoords = jest.fn();

    subscribeBrowserCatalogGeo({ getCurrentPosition }, onCoords);

    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ maximumAge: 600_000, timeout: 12_000 })
    );
    expect(onCoords).toHaveBeenCalledWith({ lat: 4.05, lng: 9.7 });
    expect(JSON.parse(localStorage.getItem(PUBLIC_BROWSER_GEO_STORAGE_KEY) ?? '{}')).toEqual({
      lat: 4.05,
      lng: 9.7,
    });
  });

  it('keeps the stored fix when the browser denies a new reading', () => {
    localStorage.setItem(
      PUBLIC_BROWSER_GEO_STORAGE_KEY,
      JSON.stringify({ lat: 3.8, lng: 11.5 })
    );
    const getCurrentPosition = jest.fn(
      (
        _success: (pos: { coords: { latitude: number; longitude: number } }) => void,
        error: () => void
      ) => {
        error();
      }
    );
    const onCoords = jest.fn();

    subscribeBrowserCatalogGeo({ getCurrentPosition }, onCoords);

    expect(onCoords).toHaveBeenCalledTimes(1);
    expect(onCoords).toHaveBeenCalledWith({ lat: 3.8, lng: 11.5 });
  });

  it('ignores a late reading after the catalog unsubscribes', () => {
    let succeed: ((pos: { coords: { latitude: number; longitude: number } }) => void) | null =
      null;
    const getCurrentPosition = jest.fn(
      (success: (pos: { coords: { latitude: number; longitude: number } }) => void) => {
        succeed = success;
      }
    );
    const onCoords = jest.fn();
    const cancel = subscribeBrowserCatalogGeo({ getCurrentPosition }, onCoords);

    cancel();
    succeed?.({ coords: { latitude: 1, longitude: 2 } });

    expect(onCoords).not.toHaveBeenCalled();
  });
});
