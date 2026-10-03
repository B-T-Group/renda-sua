import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BusinessLocation } from '../../../hooks/useBusinessLocations';
import BasicsSection from './BasicsSection';
import { LocationSectionActions } from './sectionTypes';

const mockEnqueueSnackbar = jest.fn();
const mockPresignUploadLibraryImage = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
  }),
}));

jest.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

jest.mock('../../../hooks/useAws', () => ({
  useAws: () => ({ generateImageUploadUrl: jest.fn() }),
}));

jest.mock('../onboarding/onboardingPresignedUpload', () => ({
  presignUploadLibraryImage: (...args: unknown[]) =>
    mockPresignUploadLibraryImage(...args),
}));

jest.mock('../../dialogs/AddressDialog', () => (props: {
  open: boolean;
  error?: string | null;
  onSave: () => void;
}) =>
  props.open ? (
    <div>
      <button type="button" onClick={props.onSave}>
        Save address
      </button>
      {props.error ? <div role="alert">{props.error}</div> : null}
    </div>
  ) : null
);

function location(): BusinessLocation {
  return {
    id: 'loc-1',
    name: 'Akwa',
    address: {
      id: 'a',
      address_line_1: 'Rue Joss',
      city: 'Douala',
      state: 'LT',
      postal_code: '',
      country: 'CM',
    },
    is_active: true,
    is_primary: false,
    location_type: 'store',
    created_at: '',
    updated_at: '',
    email: 'shop@example.com',
  };
}

function renderSection(updateLocation: LocationSectionActions['updateLocation']) {
  const loc = location();
  const actions: LocationSectionActions = {
    location: loc,
    locations: [loc],
    businessId: 'biz-1',
    isStripeRail: false,
    railLoading: false,
    isOwnBusiness: true,
    updateLocation,
    deleteLocation: jest.fn(),
    onManageItems: jest.fn(),
  };
  return render(<BasicsSection {...actions} />);
}

describe('BasicsSection', () => {
  beforeEach(() => {
    mockEnqueueSnackbar.mockClear();
    mockPresignUploadLibraryImage.mockReset();
  });

  it('does not save a blank name', () => {
    const updateLocation = jest.fn();
    renderSection(updateLocation);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Location name'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a name.');
    expect(updateLocation).not.toHaveBeenCalled();
  });

  it('keeps the name editor open when the save fails', async () => {
    const updateLocation = jest.fn().mockRejectedValue(new Error('nope'));
    renderSection(updateLocation);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Location name'), {
      target: { value: 'Bonapriso' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(
      await screen.findByText(
        "Couldn't save this location's name. Please try again."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save details' })).toBeInTheDocument();
    expect(
      (screen.getByLabelText('Location name') as HTMLInputElement).value
    ).toBe('Bonapriso');
  });

  it('rejects an unsupported logo and saves an uploaded one', async () => {
    const updateLocation = jest.fn().mockResolvedValue({});
    mockPresignUploadLibraryImage.mockResolvedValue({
      image_url: 'https://cdn.example/logo.png',
    });
    renderSection(updateLocation);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(['gif'], 'logo.gif', { type: 'image/gif' })] },
    });
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Failed to upload logo', {
      variant: 'error',
    });
    expect(mockPresignUploadLibraryImage).not.toHaveBeenCalled();

    fireEvent.change(input, {
      target: { files: [new File(['png'], 'logo.png', { type: 'image/png' })] },
    });
    expect(await screen.findByRole('button', { name: 'Remove logo' })).toBeInTheDocument();
    expect(mockPresignUploadLibraryImage).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'logo.png' }),
      'rendasua-uploads',
      'businesses/biz-1/location-logos',
      expect.any(Function),
      'Failed to upload logo'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    await waitFor(() =>
      expect(updateLocation).toHaveBeenCalledWith('loc-1', {
        name: 'Akwa',
        email: 'shop@example.com',
        logo_url: 'https://cdn.example/logo.png',
      })
    );
  });

  it('keeps the address dialog open when the address save fails', async () => {
    const updateLocation = jest.fn().mockRejectedValue(new Error('nope'));
    renderSection(updateLocation);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit address' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(
      await screen.findByText("Couldn't save this address. Please try again.")
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save address' })).toBeInTheDocument();
    expect(updateLocation).toHaveBeenCalledWith(
      'loc-1',
      expect.objectContaining({
        address: expect.objectContaining({ city: 'Douala' }),
      })
    );
  });
});
