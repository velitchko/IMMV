// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `environment.ts`, but if you do
// `ng build --env=prod` then `environment.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `.angular-cli.json`.

export const environment = {
  production: false,
  MAPBOX_API_KEY: 'pk.eyJ1IjoidmVsaXRjaGtvIiwiYSI6ImNqOGJkeXE1dzBobWYzMnFybW4zeHJ6eWwifQ.kqTgrJJpLhuqLpm-LL5ghQ',
  GMAPS_API_KEY: 'AIzaSyD0b5xJBAt5-SchLgwQ83YHzLo51ZfEvCA',
  GPLACES_API_KEY: 'AIzaSyAZJmjLUv7d5SB1XbL96t-7cNd2eZKBd5Y',
  API_URL: 'http://localhost:4000/api/v1/',
  APP_URL: 'http://localhost:4000/'
};

/*
 * In development mode, to ignore zone related error stack frames such as
 * `zone.run`, `zoneDelegate.invokeTask` for easier debugging, you can
 * import the following file, but please comment it out in production mode
 * because it will have performance impact when throw error
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
