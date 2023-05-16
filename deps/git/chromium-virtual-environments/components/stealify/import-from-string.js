// Mainly the knowleg from frank-dspeed/esm-loader or direktspeed/esm-loader do not remember the location
export const importFromString = (str) => await import(URL.createObjectURL(new Blob([str], { type: 'text/javascript' })));
