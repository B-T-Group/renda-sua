import React, { useContext, useEffect, useState } from "react";

// Types pour l'utilisateur client
interface ClientUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  nationality?: string;
  dob?: string;
  // Ajoutez d'autres champs selon vos besoins
}

// Context pour l'utilisateur (à créer plus tard)
interface BTContextType {
  user?: ClientUser;
  setUser?: (user: ClientUser) => void;
}

// Placeholder pour le contexte - sera remplacé par le vrai contexte
const BTContext = {
  user: undefined,
  setUser: undefined,
} as BTContextType;

export default function useUser() {
  const context = useContext(BTContext as React.Context<BTContextType | null>) ?? null;
  const [user, setUser] = useState<ClientUser | undefined>();

  useEffect(() => {
    setUser(context?.user);
  }, [context?.user]);

  return user;
}

