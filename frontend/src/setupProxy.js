const { createProxyMiddleware } = require('http-proxy-middleware');

// This file provides configuration for proxying API requests in development

module.exports = function(app) {
  // Add any proxy settings here if needed
  // Example: 
  // app.use(
  //   '/api',
  //   createProxyMiddleware({
  //     target: 'http://localhost:3002',
  //     changeOrigin: true,
  //   })
  // );
}; 