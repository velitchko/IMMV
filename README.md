# Interactive Music Mapping Vienna (IMMV)
The project’s focus is the valorisation and the mediation of the capabilities of music as an urban identification tool. The interaction between music and urban texture (identity, political symbolism, mental determination, imagination) should be made accessible to academic and to a wide audience through interactive Visual Analytic Technologies.


## Dependencies
This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 6.0.0.

This project uses [MongoDB](https://www.mongodb.com/) for the database.

NodeJS is required to run the application [NodeJS](https://nodejs.org/en/)

## Demo
Demo can be found online at [immv-app](http://immv-app.cvast.tuwien.ac.at)

## Getting started

```shell
git clone https://github.com/velitchko/IMMV.git immv
cd immv
npm install
npm start
```

## Bulding (Production)
Run `npm run build` to build the project. The build artifacts will be stored in the `dist/app` directory.

Run `npm run build:prod` for a production build.


```shell
npm build:prod
```

## Building (Development)
Two different dev servers are provided:

* The universal dev server which enable SSR (build `browser` and `server` targets) ;
* The [SPA](https://en.wikipedia.org/wiki/Single-page_application) dev server which is a [webpack dev server](https://github.com/webpack/webpack-dev-server) (build `browser` target only).

SPA dev server can be useless (or "broken"): it depends on your server implementation.
Run `npm run dev` (or `npx ng-udkc`) for an universal dev server. Navigate to [http://localhost:4000/](http://localhost:4000/).


Run `npm run dev:spa` (or `npx ng serve --hmr`) for a SPA dev server Navigate to [http://localhost:4200/](http://localhost:4200/).

The app will automatically reload if you change any of the browser source files.

Note: the universal dev server provide an SPA mode too if you navigate to the `index.html`: [http://localhost:4000/index.html](http://localhost:4000/index.html).

```shell
npm run dev
```
### Branches
Currently no branches.


## Generating components

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
