import { createServer } from 'http'
import * as Koa from 'koa'
import * as KoaRouter from 'koa-router'

const app = new Koa()
const router = new KoaRouter()

router.get('/delay/:ms', async ctx => {
    await sleep(parseInt(ctx.params.ms))
    ctx.response.body = {
        id: 'e367a5c8-1f18-4724-9c76-820ef6d9c0e5',
        ad: [
            '4933228999',
            '4933228976',
            '4933228976',
            '4933228976',
            '4933228976',
            '4933228976',
            '4933228976',
            '4933228976',
            '4933228976',
            '4933228976',
        ],
    }
})

router.get('/', ctx => {
    ctx.body = {}
})

app.use(router.routes()).use(router.allowedMethods())

const server = createServer(app.callback())
server.listen(3000, () => {
    console.log('Listening')
})

process.on('SIGTERM', () => {
    console.log('Shutting down')
    server.close(() => {
        console.log('Socket closed')
    })
})

function sleep(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}
