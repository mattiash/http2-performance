import * as http2 from 'http2'
import { Deferred } from './deferred'
import * as dbg from 'debug'
const debug = dbg('http2-session')

const opt: http2.SecureClientSessionOptions = {
    rejectUnauthorized: false,
}

interface SessionRequest {
    url: string
    deferred: Deferred<object>
}

class Session {
    private client?: http2.ClientHttp2Session
    private outstandingRequests = 0
    private pingInterval: NodeJS.Timeout

    constructor(private basePath: string, private maxOutstanding: number) {
        this.createClient()
        this.pingInterval = setInterval(() => {
            if (this.client) {
                this.client.ping((err, duration) => {
                    if (err) {
                        debug('ping err after ' + duration + ' ms')
                    }
                })
            }
        }, 15000)
    }

    createClient() {
        const client = http2.connect(this.basePath, opt)
        client.on('connect', () => {
            this.client = client
            debug('connect')
        })
        client.on('error', arg => debug('error', arg))
        client.on('close', (arg: any) => {
            debug('close', arg)
            this.client = undefined
            this.createClient()
        })
        client.on('ping', () => debug('ping'))
        client.on('goaway', arg => debug('goaway', arg))
    }

    get isBusy() {
        return this.outstandingRequests >= this.maxOutstanding
    }

    addRequest(url: string, deferred: Deferred<object>) {
        if (this.outstandingRequests < this.maxOutstanding) {
            return this.doRequest(url, deferred)
        } else {
            return false
        }
    }

    private doRequest(path: string, deferred: Deferred<object>) {
        if (this.client && !this.client.closed) {
            let rejected = false
            this.outstandingRequests++
            const req = this.client.request({
                [http2.constants.HTTP2_HEADER_PATH]: path,
            })

            req.on('response', (headers, flags) => {
                // for (const name in headers) {
                //     console.log(`${name}: ${headers[name]}`)
                // }
                if (headers[':status'] !== 200) {
                    rejected = true
                    this.outstandingRequests--
                    deferred.reject()
                }
            })

            req.setEncoding('utf8')
            let data = ''
            req.on('data', chunk => {
                data += chunk
            })
            req.on('end', () => {
                if (!rejected) {
                    this.outstandingRequests--
                    try {
                        deferred.resolve(JSON.parse(data))
                    } catch (e) {
                        deferred.reject(new Error('Failed to parse json'))
                    }
                }
            })
            req.end()
            return true
        } else {
            return false
        }
    }
}

export class AspRequester {
    private nextSession = 0
    private sessions = new Array<Session>()
    private unallocatedRequests = new Array<SessionRequest>()
    constructor(
        basePath: string,
        parallelSessions: number,
        maxOutstanding: number,
    ) {
        for (let c = 0; c < parallelSessions; c++) {
            this.sessions.push(new Session(basePath, maxOutstanding))
        }
    }

    addRequest(url: string) {
        let deferred = new Deferred<object>()
        this.unallocatedRequests.push({ url, deferred })
        this.startThread()
        return deferred.promise
    }

    private startThread() {
        const feedThread = (session: Session) => {
            const req = this.unallocatedRequests.shift()
            if (req) {
                const { url, deferred } = req
                session.addRequest(url, deferred)
                deferred.promise
                    .catch(() => {})
                    .then(() => {
                        feedThread(session)
                    })
            }
        }

        for (let c = 0; c < this.sessions.length; c++) {
            const sessionNum = (c + this.nextSession) % this.sessions.length
            if (!this.sessions[sessionNum].isBusy) {
                feedThread(this.sessions[sessionNum])
                this.nextSession = sessionNum + 1
                break
            }
        }
    }
}
