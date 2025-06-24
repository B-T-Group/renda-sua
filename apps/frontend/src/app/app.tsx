import { Route, Routes, Link } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
  Card,
  CardContent,
} from '@mui/material';
import { Home, Info } from '@mui/icons-material';

export function App() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Rendasua App
          </Typography>
          <Button color="inherit" component={Link} to="/" startIcon={<Home />}>
            Home
          </Button>
          <Button color="inherit" component={Link} to="/page-2" startIcon={<Info />}>
            Page 2
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Routes>
          <Route
            path="/"
            element={
              <Box>
                <Typography variant="h4" component="h1" gutterBottom>
                  Welcome to Rendasua
                </Typography>
                <Typography variant="body1" paragraph>
                  This is your React frontend application with Material-UI integration.
                </Typography>
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  <Card sx={{ flex: '1 1 300px', minWidth: 0 }}>
                    <CardContent>
                      <Typography variant="h6" component="h2">
                        Feature 1
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Description of your first feature goes here.
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card sx={{ flex: '1 1 300px', minWidth: 0 }}>
                    <CardContent>
                      <Typography variant="h6" component="h2">
                        Feature 2
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Description of your second feature goes here.
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    component={Link}
                    to="/page-2"
                    startIcon={<Info />}
                  >
                    Go to Page 2
                  </Button>
                </Box>
              </Box>
            }
          />
          <Route
            path="/page-2"
            element={
              <Box>
                <Typography variant="h4" component="h1" gutterBottom>
                  Page 2
                </Typography>
                <Typography variant="body1" paragraph>
                  This is the second page of your application.
                </Typography>
                <Button
                  variant="outlined"
                  component={Link}
                  to="/"
                  startIcon={<Home />}
                >
                  Back to Home
                </Button>
              </Box>
            }
          />
        </Routes>
      </Container>
    </Box>
  );
}

export default App;
