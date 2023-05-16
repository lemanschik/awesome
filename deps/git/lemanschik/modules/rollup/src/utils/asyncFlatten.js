export async function asyncFlatten(array) {
    do {
        array = (await Promise.all(array)).flat(Infinity);
    } while (array.some((v) => v?.then));
    return array;
}
