import { init } from '@noriginmedia/norigin-spatial-navigation';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Initialise LRUD spatial navigation.
// shouldFocusDOMNode: true  → also calls .focus() on the DOM node (enables :focus CSS).
// throttle: 180             → matches Samsung TV remote repeat rate; prevents double-moves.
// throttleKeypresses: true  → extra safety against double-fire on Tizen.
init({
  debug: false,
  visualDebug: false,
  shouldFocusDOMNode: true,
  throttle: 180,
  throttleKeypresses: true,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
);
