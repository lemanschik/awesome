import babel from "@rollup/plugin-babel";
import { append, prepend } from "rollup-plugin-insert";
import { terser } from "rollup-plugin-terser";

// @babel/core  @babel/preset-env @rollup/plugin-babel "rollup rollup-plugin-insert rollup-plugin-terser

export default { // Todo use the source correctly
  input: 'deps/jsmpeg/jsmpeg.min.js',
  output: { file: 'jsmpeg.js', format: "esm", sourcemap: true,  },
  plugins: [
    prepend('var document = typeof document === "undefined" ? { addEventListener: function() {} } : document;'),
    prepend('var window = self;'),
    append('export default JSMpeg;'),
    babel({ babelHelpers: "bundled",
      presets: [["@babel/preset-env",  { targets: { esmodules: true } }]],
    }),
    terser(),
  ],
}
