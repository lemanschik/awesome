import { resolve } from 'node:path';
import process from 'node:process';
import { createFilter } from '@rollup/pluginutils';
import { rollupInternal } from '../rollup/rollup';
import { FileWatcher } from './fileWatcher';
const eventsRewrites = {
    create: {
        create: 'buggy',
        delete: null,
        update: 'create'
    },
    delete: {
        create: 'update',
        delete: 'buggy',
        update: 'buggy'
    },
    update: {
        create: 'buggy',
        delete: 'delete',
        update: 'update'
    }
};
export class Watcher {
    constructor(optionsList, emitter) {
        this.buildDelay = 0;
        this.buildTimeout = null;
        this.closed = false;
        this.invalidatedIds = new Map();
        this.rerun = false;
        this.running = true;
        this.emitter = emitter;
        emitter.close = this.close.bind(this);
        this.tasks = optionsList.map(options => new Task(this, options));
        for (const { watch } of optionsList) {
            if (watch && typeof watch.buildDelay === 'number') {
                this.buildDelay = Math.max(this.buildDelay, watch.buildDelay);
            }
        }
        process.nextTick(() => this.run());
    }
    async close() {
        if (this.closed)
            return;
        this.closed = true;
        if (this.buildTimeout)
            clearTimeout(this.buildTimeout);
        for (const task of this.tasks) {
            task.close();
        }
        await this.emitter.emit('close');
        this.emitter.removeAllListeners();
    }
    invalidate(file) {
        if (file) {
            const previousEvent = this.invalidatedIds.get(file.id);
            const event = previousEvent ? eventsRewrites[previousEvent][file.event] : file.event;
            if (event === 'buggy') {
                //TODO: throws or warn? Currently just ignore, uses new event
                this.invalidatedIds.set(file.id, file.event);
            }
            else if (event === null) {
                this.invalidatedIds.delete(file.id);
            }
            else {
                this.invalidatedIds.set(file.id, event);
            }
        }
        if (this.running) {
            this.rerun = true;
            return;
        }
        if (this.buildTimeout)
            clearTimeout(this.buildTimeout);
        this.buildTimeout = setTimeout(async () => {
            this.buildTimeout = null;
            try {
                await Promise.all([...this.invalidatedIds].map(([id, event]) => this.emitter.emit('change', id, { event })));
                this.invalidatedIds.clear();
                await this.emitter.emit('restart');
                this.emitter.removeListenersForCurrentRun();
                this.run();
            }
            catch (error) {
                this.invalidatedIds.clear();
                await this.emitter.emit('event', {
                    code: 'ERROR',
                    error,
                    result: null
                });
                await this.emitter.emit('event', {
                    code: 'END'
                });
            }
        }, this.buildDelay);
    }
    async run() {
        this.running = true;
        await this.emitter.emit('event', {
            code: 'START'
        });
        for (const task of this.tasks) {
            await task.run();
        }
        this.running = false;
        await this.emitter.emit('event', {
            code: 'END'
        });
        if (this.rerun) {
            this.rerun = false;
            this.invalidate();
        }
    }
}
export class Task {
    constructor(watcher, options) {
        this.cache = { modules: [] };
        this.watchFiles = [];
        this.closed = false;
        this.invalidated = true;
        this.watched = new Set();
        this.watcher = watcher;
        this.options = options;
        this.skipWrite = Boolean(options.watch && options.watch.skipWrite);
        this.outputs = this.options.output;
        this.outputFiles = this.outputs.map(output => {
            if (output.file || output.dir)
                return resolve(output.file || output.dir);
            return undefined;
        });
        const watchOptions = this.options.watch || {};
        this.filter = createFilter(watchOptions.include, watchOptions.exclude);
        this.fileWatcher = new FileWatcher(this, {
            ...watchOptions.chokidar,
            disableGlobbing: true,
            ignoreInitial: true
        });
    }
    close() {
        this.closed = true;
        this.fileWatcher.close();
    }
    invalidate(id, details) {
        this.invalidated = true;
        if (details.isTransformDependency) {
            for (const module of this.cache.modules) {
                if (!module.transformDependencies.includes(id))
                    continue;
                // effective invalidation
                module.originalCode = null;
            }
        }
        this.watcher.invalidate({ event: details.event, id });
    }
    async run() {
        if (!this.invalidated)
            return;
        this.invalidated = false;
        const options = {
            ...this.options,
            cache: this.cache
        };
        const start = Date.now();
        await this.watcher.emitter.emit('event', {
            code: 'BUNDLE_START',
            input: this.options.input,
            output: this.outputFiles
        });
        let result = null;
        try {
            result = await rollupInternal(options, this.watcher.emitter);
            if (this.closed) {
                return;
            }
            this.updateWatchedFiles(result);
            this.skipWrite || (await Promise.all(this.outputs.map(output => result.write(output))));
            await this.watcher.emitter.emit('event', {
                code: 'BUNDLE_END',
                duration: Date.now() - start,
                input: this.options.input,
                output: this.outputFiles,
                result
            });
        }
        catch (error) {
            if (!this.closed) {
                if (Array.isArray(error.watchFiles)) {
                    for (const id of error.watchFiles) {
                        this.watchFile(id);
                    }
                }
                if (error.id) {
                    this.cache.modules = this.cache.modules.filter(module => module.id !== error.id);
                }
            }
            await this.watcher.emitter.emit('event', {
                code: 'ERROR',
                error,
                result
            });
        }
    }
    updateWatchedFiles(result) {
        const previouslyWatched = this.watched;
        this.watched = new Set();
        this.watchFiles = result.watchFiles;
        this.cache = result.cache;
        for (const id of this.watchFiles) {
            this.watchFile(id);
        }
        for (const module of this.cache.modules) {
            for (const depId of module.transformDependencies) {
                this.watchFile(depId, true);
            }
        }
        for (const id of previouslyWatched) {
            if (!this.watched.has(id)) {
                this.fileWatcher.unwatch(id);
            }
        }
    }
    watchFile(id, isTransformDependency = false) {
        if (!this.filter(id))
            return;
        this.watched.add(id);
        if (this.outputFiles.includes(id)) {
            throw new Error('Cannot import the generated bundle');
        }
        // this is necessary to ensure that any 'renamed' files
        // continue to be watched following an error
        this.fileWatcher.watch(id, isTransformDependency);
    }
}
