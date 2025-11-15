/// <reference types="@types/google.maps" />

// Declare google maps on window
declare global {
  interface Window {
    google: typeof google;
  }
}

export {};
