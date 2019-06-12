export class Deferred<T> {
    resolve!: (v?: T | PromiseLike<T>) => void
    reject!: (reason?: any) => void
    readonly promise = new Promise<T>((resolve, reject) => {
        this.resolve = resolve
        this.reject = reject
    })
}
