import { pickupDirectionsUrl } from './pickupDirectionsUrl';

describe('pickupDirectionsUrl', () => {
  it('routes from the current location to the encoded address', () => {
    expect(pickupDirectionsUrl("  1 Rue de l'Église, Montréal  ")).toBe(
      `https://www.google.com/maps/dir/?api=1&origin=Current%20Location&destination=${encodeURIComponent("1 Rue de l'Église, Montréal")}&travelmode=driving`
    );
  });
});
