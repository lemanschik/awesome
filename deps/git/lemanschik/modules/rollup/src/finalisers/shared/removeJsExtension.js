export default function removeJsExtension(name) {
    return name.endsWith('.js') ? name.slice(0, -3) : name;
}
