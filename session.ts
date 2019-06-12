import * as http2 from 'http2'
import { Deferred } from './deferred'

const SERVER_DELAY = 150
const NUM_REQUESTS = 1500
const MAX_OUTSTANDING = 120
const CONNECTIONS = 3

const opt: http2.SecureClientSessionOptions = {
    rejectUnauthorized: false,
}

interface SessionRequest {
    url: string
    deferred: Deferred<object>
}

export class Session {
    private client?: http2.ClientHttp2Session
    private outstandingRequests = 0
    private pingInterval: NodeJS.Timeout

    constructor(private basePath: string) {
        this.createClient()
        this.pingInterval = setInterval(() => {
            if (this.client) {
                this.client.ping((err, duration) => {
                    if (err) {
                        console.log('ping err after ' + duration + ' ms')
                    }
                })
            }
        }, 15000)
    }

    createClient() {
        const client = http2.connect(this.basePath, opt)
        client.on('connect', () => {
            this.client = client
            console.log(new Date() + ' connect')
        })
        client.on('error', arg => console.log(new Date() + ' error', arg))
        client.on('close', (arg: any) => {
            console.log(new Date() + ' close', arg)
            this.client = undefined
            this.createClient()
        })
        client.on('ping', () => console.log(new Date() + ' ping'))
        client.on('goaway', arg => console.log(new Date() + ' goaway', arg))
    }

    get isBusy() {
        return this.outstandingRequests >= MAX_OUTSTANDING
    }

    addRequest(url: string, deferred: Deferred<object>) {
        if (this.outstandingRequests < MAX_OUTSTANDING) {
            return this.doRequest(url, deferred)
        } else {
            return false
        }
    }

    private doRequest(path: string, deferred: Deferred<object>) {
        if (this.client) {
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
                    deferred.resolve(JSON.parse(data))
                }
            })
            req.end()
            return true
        } else {
            return false
        }
    }
}

export class MultiSession {
    private nextSession = 0
    private sessions = new Array<Session>()
    private unallocatedRequests = new Array<SessionRequest>()
    constructor(basePath: string, parallelSessions: number) {
        for (let c = 0; c < parallelSessions; c++) {
            this.sessions.push(new Session(basePath))
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

function sleep(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}

async function run() {
    let m = new MultiSession(
        'https://mattias-http2-1224252573.eu-central-1.elb.amazonaws.com/',
        CONNECTIONS,
    )

    await sleep(1000)

    while (true) {
        const start = Date.now()
        let promises = new Array<Promise<object>>()
        for (let c = 0; c < NUM_REQUESTS; c++) {
            promises.push(
                m
                    .addRequest(
                        `/delay/${SERVER_DELAY}?bt=0;avail_num=12;dur=120000;cid=9kuh123459087612;ip=127.12.43.178;did=00cd62ee-d10a-40ee-93d1-793364cab486;dcat=phone;dplat=ios;uagent=Mozilla%2F5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_14_5%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F74.0.3729.169%20Safari%2F537.36;vid=h274s73nh6;prid=abcd123;fallback=true;rt=vast3;ptner=fgh;geoc=XX`,
                    )
                    .catch(() => {
                        console.log('caught')
                        return {}
                    }),
            )
        }

        await Promise.all(promises)
        console.log('timing', Date.now() - start)

        await sleep(10 * 60 * 1000)
    }

    // for (let client of clients) {
    //     client.close()
    // }
}

run()
