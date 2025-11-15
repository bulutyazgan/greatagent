console.log('Environment variables test:');
console.log('VITE_GOOGLE_MAPS_API_KEY:', import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
console.log('All VITE_ vars:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')));
