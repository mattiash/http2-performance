import { createServer } from 'http'
import * as Koa from 'koa'

const app = new Koa()

app.use(async ctx => {
    await sleep(150)
    ctx.response.body = { result: 'ok' }
})

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
