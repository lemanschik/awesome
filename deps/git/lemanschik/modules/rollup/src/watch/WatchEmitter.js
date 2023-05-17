export class WatchEmitter {
    constructor() {
        this.currentHandlers = Object.create(null);
        this.persistentHandlers = Object.create(null);
    }
    // Will be overwritten by Rollup
    async close() { }
    emit(event, ...parameters) {
        return Promise.all([...this.getCurrentHandlers(event), ...this.getPersistentHandlers(event)].map(handler => handler(...parameters)));
    }
    off(event, listener) {
        const listeners = this.persistentHandlers[event];
        if (listeners) {
            // A hack stolen from "mitt": ">>> 0" does not change numbers >= 0, but -1
            // (which would remove the last array element if used unchanged) is turned
            // into max_int, which is outside the array and does not change anything.
            listeners.splice(listeners.indexOf(listener) >>> 0, 1);
        }
        return this;
    }
    on(event, listener) {
        this.getPersistentHandlers(event).push(listener);
        return this;
    }
    onCurrentRun(event, listener) {
        this.getCurrentHandlers(event).push(listener);
        return this;
    }
    once(event, listener) {
        const selfRemovingListener = (...parameters) => {
            this.off(event, selfRemovingListener);
            return listener(...parameters);
        };
        this.on(event, selfRemovingListener);
        return this;
    }
    removeAllListeners() {
        this.removeListenersForCurrentRun();
        this.persistentHandlers = Object.create(null);
        return this;
    }
    removeListenersForCurrentRun() {
        this.currentHandlers = Object.create(null);
        return this;
    }
    getCurrentHandlers(event) {
        return this.currentHandlers[event] || (this.currentHandlers[event] = []);
    }
    getPersistentHandlers(event) {
        return this.persistentHandlers[event] || (this.persistentHandlers[event] = []);
    }
}
