import { useQuery } from "@apollo/client";
import { useEffect, useState } from "react";
import { gql } from "@apollo/client";

// Types pour les terrains
interface PlotListing {
  id: number;
  name: string;
  plotListingTypeId: number;
  plotListingLocationId: number;
  published: boolean;
  sizeUnitId: number;
  size: number;
  price: number;
  currency: string;
  numberOfUnits: number;
  additionalNotes: string;
  plotNumber?: string;
  createdAt: string;
  address?: {
    address: string;
    state: string;
    city: string;
    country: string;
    postCode: string;
    appartmentNumber?: string;
    phoneNumber?: string;
  };
  plotListingType: {
    id: number;
    name: string;
    display: string;
    description?: string;
  };
  sizeUnit: {
    id: number;
    name: string;
    display: string;
  };
  reservations: Array<{
    id: number;
    status: string;
    productApplication: {
      client: {
        firstName: string;
        lastName: string;
        email: string;
      };
    };
  }>;
}

const GET_PLOT_LISTINGS = gql`
  query plotListings($all: Boolean) {
    plotListings(all: $all) {
      id
      name
      plotListingTypeId
      plotListingLocationId
      published
      sizeUnitId
      size
      price
      currency
      numberOfUnits
      additionalNotes
      plotNumber
      createdAt
      address {
        address
        state
        city
        country
        postCode
        appartmentNumber
        phoneNumber
      }
      plotListingType {
        id
        name
        display
        description
      }
      sizeUnit {
        id
        name
        display
      }
      reservations {
        id
        status
        productApplication {
          client {
            firstName
            lastName
            email
          }
        }
      }
    }
  }
`;

const usePlotListings = (all: boolean = false) => {
  const [plotListings, setPlotListings] = useState<PlotListing[]>([]);
  const [loading, setLoading] = useState(false);

  const { refetch } = useQuery(GET_PLOT_LISTINGS, {
    skip: true,
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await refetch({ all });
        if (data.data.plotListings) {
          setPlotListings(data.data.plotListings);
        }
      } catch (e) {
        console.log(
          `An error occured while trying to load plot listings`,
          e
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [all]);

  return { loading, plotListings };
};

export default usePlotListings;


