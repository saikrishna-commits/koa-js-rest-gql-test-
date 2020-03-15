require('dotenv').config()


const PORT = process.env.PORT || 3000

const Koa = require('koa');
const Router = require('koa-router');
const logger = require('koa-logger');
const bodyParser = require("koa-bodyparser")
const prettyJson = require('koa-json')
const convert = require('koa-convert')
const compose = require('koa-compose');
const compress = require("koa-compress")
const cors = require('@koa/cors');
const { ApolloServer } = require("apollo-server-koa");
const app = new Koa();
const router = new Router();
const userRouter = new Router({ prefix: "/users" })

const { typeDefs } = require('./graphql/types')
const { resolvers } = require('./graphql/resolvers')



const legacyResponseTimeCalc = function* responseTime(next) {
    const start = new Date;
    yield next;
    const ms = new Date - start;
    this.set("X-Response-Time", `${ms} ms`);
}





const formatResponse = (response, args) => {
    console.log("queryString : ", args.queryString);
    console.log("variables : ", args.variables);
    return response;
};

const gqlServer = new ApolloServer({ typeDefs, resolvers, formatResponse });


//* error handling purpose
app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        ctx.status = err.status || 500;
        ctx.body = err.message;
        ctx.app.emit('error', err, ctx);
    }
});


if (process.env.NODE_ENV === 'development') {
    app.use(logger());

}
app.use(prettyJson()) //? prettify json response
app.use(cors()) //* allow requests from anyother origins running on different ports


//* add parser mdw (internally listens on req.on("data") and constructs accordingly )
app.use(bodyParser()); //* for parsing application/json
//* for parsing application/x-www-form-urlencoded




//* response time mdw using fn generator (going to deprecate this pattern)

//* to avoid there is mdw which offers to convert legacy mdw to modern !!!

app.use(convert(legacyResponseTimeCalc))

async function calculateResponseTime(ctx, next) {
    console.log('Started tracking response time')
    const started = Date.now()
    await next()
    // once all middleware below completes, this continues
    const ellapsed = (Date.now() - started) + 'ms'
    console.log('Response time is:', ellapsed)
    ctx.set('X-ResponseTime', ellapsed)
}

const allMdws = compose([calculateResponseTime, convert(legacyResponseTimeCalc)]);

app.use(allMdws)

app.use(compress({
    filter: function (content_type) {
        return /text/i.test(content_type)
    },
    threshold: 2048,
    flush: require('zlib').Z_SYNC_FLUSH
}));

require('./routes/index')({ router });
app.use(router.routes()).use(router.allowedMethods());

require('./routes/user')({ userRouter })
app.use(userRouter.routes()).use(userRouter.allowedMethods({ throw: true }))

app.on('error', (err, ctx) => {
    console.error('server error', err, ctx)
});

gqlServer.applyMiddleware({ app, path: "/graphql" });


const server = app.listen(PORT, () => {
    console.log(`Running on ${PORT}`)
});

module.exports = server;