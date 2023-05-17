import prettyBytes from 'pretty-bytes';
import { bold, underline } from '../../src/utils/colors';
export function printTimings(timings) {
    for (const [label, [time, memory, total]] of Object.entries(timings)) {
        const appliedColor = label[0] === '#' ? (label[1] !== '#' ? underline : bold) : (text) => text;
        const row = `${label}: ${time.toFixed(0)}ms, ${prettyBytes(memory)} / ${prettyBytes(total)}`;
        console.info(appliedColor(row));
    }
}
