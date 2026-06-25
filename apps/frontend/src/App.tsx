import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Welcome from './pages/Welcome';
import Auth from './pages/Auth';
import Upload from './pages/Upload';
import Interview from './pages/Interview';
import Results from './pages/Results';
import ProtectedRoute from './components/ProtectedRoute';
import Subscription from './pages/Subscription';

function App(){
  return(
    <BrowserRouter>
      <Navbar/>
      <Routes>
        <Route path = "/" element ={<Welcome/>}></Route>
        <Route path = "/Auth" element ={<Auth/>}></Route>
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <Upload/>
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview"
          element={
            <ProtectedRoute>
              <Interview/>
            </ProtectedRoute>
          }
        />
        <Route
          path="/results"
          element={
            <ProtectedRoute>
              <Results/>
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscription"
          element={
            <ProtectedRoute>
              <Subscription/>
            </ProtectedRoute>
          }
        />  
      </Routes>
    </BrowserRouter>
  );
}
export default App; 