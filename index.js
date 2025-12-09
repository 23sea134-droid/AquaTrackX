import { registerRootComponent } from 'expo';
import App from './App';

// Since App.js now includes SafeAreaProvider, we don't need it here
registerRootComponent(App);