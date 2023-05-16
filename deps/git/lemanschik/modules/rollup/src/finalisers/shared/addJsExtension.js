export default function addJsExtension(name) {
    return name.endsWith('.js') ? name : name + '.js';
}
