import * as http2 from 'http2'

const SERVER_DELAY = 150
const NUM_REQUESTS = 1500
const OUTSTANDING_REQUESTS_PER_CONNECTION = 120
const CONNECTIONS = 3

let requests = NUM_REQUESTS

const clients = new Array<http2.ClientHttp2Session>()

const opt: http2.SecureClientSessionOptions = {
    rejectUnauthorized: false,
}

function createClient() {
    const client = http2.connect(
        'https://mattias-http2-1224252573.eu-central-1.elb.amazonaws.com/',
        opt,
    )
    client.on('error', err => console.error(err))
    return client
}

function makeRequest(client: http2.ClientHttp2Session) {
    return new Promise(resolve => {
        const req = client.request({ ':path': `/delay/${SERVER_DELAY}` })

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
            resolve(JSON.parse(data))
        })
        req.end()
    })
}

function sleep(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}

async function thread(client: http2.ClientHttp2Session) {
    while (requests > 0) {
        requests--
        await makeRequest(client)
    }
}

async function run() {
    for (let c = 0; c < CONNECTIONS; c++) {
        clients.push(createClient())
    }

    await sleep(10000)

    const start = Date.now()
    let promises = new Array<Promise<void>>()
    for (let client of clients) {
        for (let t = 0; t < OUTSTANDING_REQUESTS_PER_CONNECTION; t++) {
            promises.push(thread(client))
        }
    }

    await Promise.all(promises)
    console.log(Date.now() - start)
    for (let client of clients) {
        client.close()
    }
}

run()
