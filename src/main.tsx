import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { PolarisDataProvider } from './context/PolarisDataContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <PolarisDataProvider>
    <App />
  </PolarisDataProvider>
);
