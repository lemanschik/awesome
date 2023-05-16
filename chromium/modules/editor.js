export const html = `<html><head><!-- Note: as of time of writing every single line here exempt the scriptName 
logging is meaning full this solves quircs between the contexts. -->
<meta name="viewport" content="width=device-width">
<!-- the absolute path to assets needs to end with / -->
<base href="https://github.lemanschik.com/monaco-editor/node_modules/monaco-editor/" />
<!-- the absolute path to assets relative to that js needs to start relaive eg no / -->
<script>globalThis.require = { paths: { vs: 'min/vs/' } };
const monacoLoaded = new ReadableStream({ start: (controller) => 
  (observer = new MutationObserver((mutationsList, observer) => 
    globalThis.monaco && controller.enqueue(globalThis.monaco) && Promise.resolve().then(()=>(observer.disconnect(), controller.close())
  )).observe(document, { attributes: false, childList: true, subtree: true })
});
const loadedScripts = new ReadableStream({ start: (controller) => 
  new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
      (mutation.type === 'childList') &&
         Array.from (mutation.addedNodes)
           .filter (node => node.tagName === 'SCRIPT')
           .forEach (script => script.addEventListener ('load', () => 
              controller.enqueue(script.src)));};
  }).observe(document, { attributes: false, childList: true, subtree: true })
});
</script><script type="module">
//window.define = (d) => console.log({d}) window.AMDLoader = { global: window }
window.addEventListener('DOMContentLoaded', (_event) => {});

loadedScripts.pipeTo(new WritableStream({ write: (scriptName) =>
  console.log(scriptName)
}));

monacoLoaded.pipeTo(new WritableStream({ write: (monaco) => {
  console.log('Loaded: ',{ monaco });
  customElements.define('line-parser',
    class extends HTMLDivElement { connectedCallback() {
      Object.assign(this.style, { height: "100vh", width: "100vw" })
      this.editor = monaco.editor.create(this, {
        value: \`// First line
function hello() {
  alert('Hello world!');
}
// Last line\`,
        language: 'javascript',
        lineNumbers: 'on',
        roundedSelection: false,
        scrollBeyondLastLine: false,
        readOnly: false,
        theme: 'vs-dark'
      });
      //editor.updateOptions({ lineNumbers: 'on' });
      this.resize = addEventListener("resize", (event) => { this.editor?.layout()});
    } // Needs div explicitly
  }, {extends: "div"});
}}));
</script><script 
  src="https://cdnjs.cloudflare.com/ajax/libs/jquery/1.9.1/jquery.min.js"
	integrity="sha256-wS9gmOZBqsqWxgIVgA8Y9WcQOa7PgSIX+rPA0VL2rbQ="
	crossorigin="anonymous"
> </script><script
  src="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/2.3.0/bootstrap.min.js"
	integrity="sha256-u+l2mGjpmGK/mFgUncmMcFKdMijvV+J3odlDJZSNUu8="
	crossorigin="anonymous"
> </script>
<script src="min/vs/loader.js"></script>
<script src="min/vs/editor/editor.main.nls.js"></script>
<script src="min/vs/editor/editor.main.js"></script></head>
<body><div is="line-parser" style="height: 200px;"></div></body>
  <p>HTML Based Web Installer for @unlicensed-code/editor<p>
  <p>Install Chromium Extension<p>
  <p>Install PWA<p>
  <p>Install Standalone via fileAccess API<p>
</html>`;