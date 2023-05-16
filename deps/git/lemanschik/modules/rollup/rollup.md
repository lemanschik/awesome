# Rollup ECMAScript Loader with a hook based Plugin System
The Rollup ECMAScript loader helps you to load ECMAScript that is written for a variation of environments
As most Module/Package Maintainers today fail to Produce code that does run out of the box this is the essential part
to get them Running. 

## The NodeJS Case
To get software Running with NodeJS you need to write package.json files as else it is not able to run your code if it is not
directly a file named .mjs a file extension they invented to vendor lock and block the system like they did with package.json
they also avoid support for cli flags that would allow to interact with any files that are not correctly reference able
as .mjs or a package.json containing type module

Rollup can bypass that via usage of the filesystem load mechanics and then pass that to import to create modules. 

## The Browser Case
Often Authors do reference for faster development or because they do not plan for multiple environments globals and modules
that are not easy to replace. Rollup Loader can Patch Inject the module references as also the code on load. It has AST Parsing
and Modification Support Including Source Maps.

## The GraalJS Case
to shim the fs modules and get something like a working runtime in graaljs you need to lookup the project es4x and rebuild that. 


## JSON Bundling / Caching
Rollup Loader produces a JSON Serializeable Loader Result that is formated in a way that it can be used to generate loadable code.


## How to build the rollup loader
The Main Repo is written in TypeScript which has its clear down sides but as it at last does only contain JSON and ECMAScript Syntax
It is relativ adjustable. The Most Stable results are archiveable via takeing the rollup-esm build strip the imports so load it with it self
and generate a rollup-esm version that runs in your target environment. As rule of thumb this is most time the most efficent way to adopt a code base.
Generate the source and link up the correct types via a addition types.js file that uses JSDOC to import the types. So it is the concept of Type Auxiality. 

```
git clone https://github.com/rollup/rollup && cd rollup
npm i --ignore-scripts
npx tsc --outDir .. 
cp src/rollup/types.d.ts ../rollup.d.ts && cp LICENSE.md ../rollup.LICENSE
```

Plugins are a total diffrent kind of beast they are not maintained at last the build is not. 
So we need to incremental adopt them via the following pattern

```js
git clone https://github.com/rollup/plugins then run
npx rollup-workspace -c rollup.plugins.config.js

```


## License of this docs and added crafts
Everything that is not 1:1 Rollup is directly Unlicensed. Including the types rollup.types.js which are drived from the original rollupTypes for adoption
we will later when they are finished contribute them back. 
