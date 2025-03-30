/**
 * This file provides a safer way to import server-only modules.
 * It prevents client-side code from importing modules that only work on the server.
 */

// This function returns a proxy for server-only modules
// It throws a clear error if accidentally imported on the client
export function createServerOnlyModule(moduleName) {
  if (typeof window !== 'undefined') {
    // We're on the client side
    return new Proxy({}, {
      get() {
        throw new Error(
          `The "${moduleName}" module can only be used on the server. ` +
          `Please move this code to a Server Component or API route.`
        );
      }
    });
  }
  
  // On the server side, try to load the module safely
  try {
    // Use dynamic import to avoid webpack trying to bundle the module
    // This will only run on the server
    return require(moduleName);
  } catch (err) {
    console.error(`Error loading server module "${moduleName}":`, err);
    return null;
  }
}

// Export pre-configured proxies for common server-only modules
export const bcrypt = createServerOnlyModule('bcrypt');
export const nodePregGyp = createServerOnlyModule('@mapbox/node-pre-gyp'); 