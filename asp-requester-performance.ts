import { AspRequester } from './asp-requester'

const CONNECTIONS = 3
const MAX_OUTSTANDING = 120
const SERVER_DELAY = 150
const NUM_REQUESTS = 1500

function sleep(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}

async function run() {
    let m = new AspRequester(
        'https://mattias-http2-1224252573.eu-central-1.elb.amazonaws.com/',
        CONNECTIONS,
        MAX_OUTSTANDING,
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
}

run()
