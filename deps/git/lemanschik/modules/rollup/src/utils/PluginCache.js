import { error, errorAnonymousPluginCache, errorDuplicatePluginName } from './error';
import { ANONYMOUS_OUTPUT_PLUGIN_PREFIX, ANONYMOUS_PLUGIN_PREFIX } from './pluginUtils';
export function createPluginCache(cache) {
    return {
        delete(id) {
            return delete cache[id];
        },
        get(id) {
            const item = cache[id];
            if (!item)
                return;
            item[0] = 0;
            return item[1];
        },
        has(id) {
            const item = cache[id];
            if (!item)
                return false;
            item[0] = 0;
            return true;
        },
        set(id, value) {
            cache[id] = [0, value];
        }
    };
}
export function getTrackedPluginCache(pluginCache, onUse) {
    return {
        delete(id) {
            onUse();
            return pluginCache.delete(id);
        },
        get(id) {
            onUse();
            return pluginCache.get(id);
        },
        has(id) {
            onUse();
            return pluginCache.has(id);
        },
        set(id, value) {
            onUse();
            return pluginCache.set(id, value);
        }
    };
}
export const NO_CACHE = {
    delete() {
        return false;
    },
    get() {
        return undefined;
    },
    has() {
        return false;
    },
    set() { }
};
function uncacheablePluginError(pluginName) {
    if (pluginName.startsWith(ANONYMOUS_PLUGIN_PREFIX) ||
        pluginName.startsWith(ANONYMOUS_OUTPUT_PLUGIN_PREFIX)) {
        return error(errorAnonymousPluginCache());
    }
    return error(errorDuplicatePluginName(pluginName));
}
export function getCacheForUncacheablePlugin(pluginName) {
    return {
        delete() {
            return uncacheablePluginError(pluginName);
        },
        get() {
            return uncacheablePluginError(pluginName);
        },
        has() {
            return uncacheablePluginError(pluginName);
        },
        set() {
            return uncacheablePluginError(pluginName);
        }
    };
}
