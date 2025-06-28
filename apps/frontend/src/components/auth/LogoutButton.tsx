import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Button } from "@mui/material";
import { Logout } from "@mui/icons-material";

const LogoutButton = () => {
  const { logout } = useAuth0();

  return (
    <Button
      variant="contained"
      color="error"
      startIcon={<Logout />}
      onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
      size="medium"
      sx={{
        bgcolor: 'rgba(255, 255, 255, 0.15)',
        color: 'white',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        '&:hover': {
          bgcolor: 'rgba(255, 255, 255, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
        },
        fontWeight: 500,
        textTransform: 'none',
        px: 2,
      }}
    >
      Log Out
    </Button>
  );
};

export default LogoutButton; 