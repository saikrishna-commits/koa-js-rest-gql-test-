const PORT = process.env.PORT || 3000

const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require("koa-bodyparser")
const app = new Koa();
const router = new Router();
const userRouter = new Router({ prefix: "/users" })
const cors = require('@koa/cors');

app.use(logger());

app.use(cors())

app.use(bodyParser());
//error handling purpose
app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        ctx.status = err.status || 500;
        ctx.body = err.message;
        ctx.app.emit('error', err, ctx);
    }
});



require('./routes/index')({ router });



app.use(router.routes()).use(router.allowedMethods());

require('./routes/user')({ userRouter })

app.use(userRouter.routes()).use(userRouter.allowedMethods({ throw: true }))

app.on('error', (err, ctx) => {
    console.error('server error', err, ctx)
});

const server = app.listen(PORT, () => {
    console.log(`Running on ${PORT}`)
});

module.exports = server;