// Example demonstrating the updated address formatting in AddressManager
// This shows how country codes and state codes are converted to full names

const exampleAddresses = [
  {
    id: '1',
    address_line_1: '123 Main Street',
    address_line_2: 'Apt 4B',
    city: 'San Francisco',
    state: 'CA', // State code
    postal_code: '94105',
    country: 'US', // Country code
    address_type: 'home',
    is_primary: true,
  },
  {
    id: '2',
    address_line_1: '456 Queen Street',
    address_line_2: '',
    city: 'Toronto',
    state: 'ON', // State code
    postal_code: 'M5H 2M9',
    country: 'CA', // Country code
    address_type: 'work',
    is_primary: false,
  },
  {
    id: '3',
    address_line_1: '789 Oxford Street',
    address_line_2: '',
    city: 'London',
    state: 'ENG', // State code
    postal_code: 'W1D 2HG',
    country: 'GB', // Country code
    address_type: 'delivery',
    is_primary: false,
  },
];

// Before the update, addresses would display as:
// "123 Main Street, Apt 4B, San Francisco, CA 94105, US"
// "456 Queen Street, Toronto, ON M5H 2M9, CA"
// "789 Oxford Street, London, ENG W1D 2HG, GB"

// After the update, addresses now display as:
// "123 Main Street, Apt 4B, San Francisco, California 94105, United States"
// "456 Queen Street, Toronto, Ontario M5H 2M9, Canada"
// "789 Oxford Street, London, England W1D 2HG, United Kingdom"

export default exampleAddresses;
