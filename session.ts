import * as http2 from 'http2'

const SERVER_DELAY = 150
const NUM_REQUESTS = 1500
const MAX_OUTSTANDING = 120
const CONNECTIONS = 3

const opt: http2.SecureClientSessionOptions = {
    rejectUnauthorized: false,
}

interface SessionRequest {
    url: string
    resolve: (result: object) => void
}

export class Session {
    private client: http2.ClientHttp2Session
    private outstandingRequests = 0

    constructor(private basePath: string) {
        this.client = this.createClient()
    }

    createClient() {
        this.client = http2.connect(
            'https://mattias-http2-1224252573.eu-central-1.elb.amazonaws.com/',
            opt,
        )
        setInterval(
            () =>
                this.client.ping((err, duration) => {
                    if (err) {
                        console.log('ping err after ' + duration + ' ms')
                    }
                }),
            15000,
        )
        this.client.on('connect', () => console.log(new Date() + ' connect'))
        this.client.on('error', arg => console.log(new Date() + ' error', arg))
        this.client.on('close', (arg: any) =>
            console.log(new Date() + ' close', arg),
        )
        this.client.on('ping', () => console.log(new Date() + ' ping'))
        this.client.on('goaway', arg =>
            console.log(new Date() + ' goaway', arg),
        )
        return this.client
    }

    get isBusy() {
        return this.outstandingRequests >= MAX_OUTSTANDING
    }

    addRequest(url: string, resolve: (result: object) => void) {
        if (this.outstandingRequests < MAX_OUTSTANDING) {
            this.doRequest(url, resolve)
            return true
        } else {
            return false
        }
    }

    private doRequest(path: string, resolve: (result: object) => void) {
        this.outstandingRequests++
        // console.log(this.outstandingRequests)
        const req = this.client.request({
            ':path': path,
        })

        req.on('response', (headers, flags) => {
            // for (const name in headers) {
            //     console.log(`${name}: ${headers[name]}`)
            // }
        })

        req.setEncoding('utf8')
        let data = ''
        req.on('data', chunk => {
            data += chunk
        })
        req.on('end', () => {
            // console.log(`data: '${data}'`)
            this.outstandingRequests--
            resolve(JSON.parse(data))
        })
        req.end()
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
        return new Promise<object>(resolve => {
            this.unallocatedRequests.push({ url, resolve })
            this.startThread()
        })
    }

    private startThread() {
        const feedThread = (session: Session) => {
            const req = this.unallocatedRequests.shift()
            if (req) {
                const { url, resolve } = req
                session.addRequest(url, (result: object) => {
                    resolve(result)
                    feedThread(session)
                })
            }
        }

        for (let c = 0; c < this.sessions.length; c++) {
            const sessionNum = (c + this.nextSession) % this.sessions.length
            // console.log('sessionNum', sessionNum)
            if (!this.sessions[sessionNum].isBusy) {
                // console.log('Not busy')
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
                m.addRequest(
                    `/delay/${SERVER_DELAY}?bt=0;avail_num=12;dur=120000;cid=9kuh123459087612;ip=127.12.43.178;did=00cd62ee-d10a-40ee-93d1-793364cab486;dcat=phone;dplat=ios;uagent=Mozilla%2F5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_14_5%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F74.0.3729.169%20Safari%2F537.36;vid=h274s73nh6;prid=abcd123;fallback=true;rt=vast3;ptner=fgh;geoc=XX`,
                ),
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
