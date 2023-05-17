export default class Queue {
    constructor(maxParallel) {
        this.maxParallel = maxParallel;
        this.queue = [];
        this.workerCount = 0;
    }
    run(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ reject, resolve, task });
            this.work();
        });
    }
    async work() {
        if (this.workerCount >= this.maxParallel)
            return;
        this.workerCount++;
        let entry;
        while ((entry = this.queue.shift())) {
            const { reject, resolve, task } = entry;
            try {
                const result = await task();
                resolve(result);
            }
            catch (error) {
                reject(error);
            }
        }
        this.workerCount--;
    }
}
