import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './src/App.js';

console.log("Mocking window...");
global.window = {};
global.navigator = { userAgent: 'node' };

console.log("Testing Demo Mode Crash");
