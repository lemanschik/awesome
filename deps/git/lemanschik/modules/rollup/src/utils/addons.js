import { error, errorAddonNotGenerated } from './error';
const concatSeparator = (out, next) => (next ? `${out}\n${next}` : out);
const concatDblSeparator = (out, next) => (next ? `${out}\n\n${next}` : out);
export async function createAddons(options, outputPluginDriver, chunk) {
    try {
        let [banner, footer, intro, outro] = await Promise.all([
            outputPluginDriver.hookReduceValue('banner', options.banner(chunk), [chunk], concatSeparator),
            outputPluginDriver.hookReduceValue('footer', options.footer(chunk), [chunk], concatSeparator),
            outputPluginDriver.hookReduceValue('intro', options.intro(chunk), [chunk], concatDblSeparator),
            outputPluginDriver.hookReduceValue('outro', options.outro(chunk), [chunk], concatDblSeparator)
        ]);
        if (intro)
            intro += '\n\n';
        if (outro)
            outro = `\n\n${outro}`;
        if (banner)
            banner += '\n';
        if (footer)
            footer = '\n' + footer;
        return { banner, footer, intro, outro };
    }
    catch (error_) {
        return error(errorAddonNotGenerated(error_.message, error_.hook, error_.plugin));
    }
}
