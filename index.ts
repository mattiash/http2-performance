import { createServer } from 'http'
import * as Koa from 'koa'
import * as KoaRouter from 'koa-router'

const app = new Koa()
const router = new KoaRouter()

router.get('/delay/:ms', async ctx => {
    await sleep(parseInt(ctx.params.ms))
    ctx.response.body = {
        templatedEventUrl:
            'https://asdf9p82345kjhi987a.example.com/v1/ReportEvent?shortened=true&amp;data=ab435b7591074aaf277a0ad5b9aefa10;trackingEventKey=',
        ads: [
            'b872ea44697a87912edca5091c12f4f68f63b3fa2737786834e199cb0aff9240',
            'mb872ea44697a87912edca5091c12f4f68f63b3fa2737786834e199cb0aff9240',
            '2de528be176afb6ea16f8af52330b10b4a00b15080078b2c65cb8cb57ba6c5ac',
            '63d63a55e640b8644c486a6d7781c7c7fa9237455b1ef38ebbf04663e7bc5ee7',
            'e65fe4b42c8421c1725d85791bd5f8b45017182ef6711a45ced0bc1de29dae95',
            '328bcd45d1b49e45db379534a43c29788e9d9a0001108324bf0fe90437ea29da',
            '190dd020846236d2169252cae4516c79f927a16ac394ce57c8219119af626990',
            '3366f0f1ba5686056bd23c66a4c6d2d7237824fff6e2c63eccb0edc0eb3450d9',
            '016700639fe26a66aaf9f4b838dc94d16bfbd1c542cae6efa487085a4475fb9c',
            '4948c0c949f7c5b6cb428d6dcd17f04d13e482fdbd05f5544caa3703a48e1ead',
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
