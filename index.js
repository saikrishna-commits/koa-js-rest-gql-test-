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
//* packages needed for auth 
const jwt = require('koa-jwt');
const jsonwebtoken = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const mongo = require('koa-mongo')

const app = new Koa();
const router = new Router();
const userRouter = new Router({ prefix: "/users" })

const { typeDefs } = require('./graphql/types')
const { resolvers } = require('./graphql/resolvers')

const secret = process.env.JWT_SECRET || 'jwt_secret';

const users = []

const getUserByUsername = (username, users) => {
    let user;
    for (let i = 0; i < users.length; i++) {
        user = users[i];
        if (user.username === username) {
            return user;
        }
    }
    return null;
}



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

app.use(jwt({
    secret: secret
}).unless({
    path: [/^\/public/, "/"]
}));

/*
 * You can register with:
 * curl -X POST --data '{"username":"atom", "password":"abides", "email":"atom@koa.com", "name":"Mr.Atom"}' http://localhost:3000/public/register
 */
router.post('/public/register', async (ctx, next) => {
    const { username, password, email, name } = ctx.request.body

    console.log(ctx.request.body)
    if (!username || !password || !email || !name) {
        ctx.status = 400;
        ctx.body = {
            error: 'expected an object with username, password, email, name but got: ' + ctx.request.body
        }
        return;
    }

    ctx.request.body.password = await bcrypt.hash(password, 5);
    const user = getUserByUsername(username, users);
    if (!user) {
        users.push(ctx.request.body);
        ctx.status = 200;
        ctx.body = {
            message: "success"
        };
        next();
    } else {
        ctx.status = 406;
        ctx.body = {
            error: "User exists"
        }
        return;
    }
});

/**
 * You can login with:
 * curl -X POST -H "Content-Type: application/json" --data '{"username":"thedude", "password":"abides"}' http://localhost:9000/public/login
 */
router.post('/public/login', async (ctx, next) => {
    const { username } = ctx.request.body
    let user = await getUserByUsername(username, users);
    if (!user) {
        ctx.status = 401;
        ctx.body = {
            error: "bad username"
        }
        return;
    }
    const {
        password,
        ...userInfoWithoutPassword
    } = user;
    if (await bcrypt.compare(ctx.request.body.password, password)) {
        ctx.body = {
            token: jsonwebtoken.sign({
                data: userInfoWithoutPassword,
                //exp in seconds
                exp: Math.floor(Date.now() / 1000) - (60 * 60) // 60 seconds * 60 minutes = 1 hour
            }, secret)
        }
        next();
    } else {
        ctx.status = 401;
        ctx.body = {
            error: "bad password"
        }
        return;
    }
});

/**
 * After you login and get a token you can access
 * this (and any other non public endpoint) with:
 * curl -X GET -H "Authorization: Bearer INSERT_TOKEN_HERE" http://localhost:3000/sacred
 */



app.use(mongo({
    uri: 'mongodb://admin:123456@localhost:27017/test?authSource=admin', //or url
    max: 100,
    min: 1
}, {
        useUnifiedTopology: true
    }
));


router.get('/api/v1', async (ctx) => {
    ctx.body = 'Hello ' + ctx.state.user.data.name
});


router.get('/mongoUsage', async (ctx) => {
    const result = await ctx.mongo.db('dbName').collection('collectionName').find({})
    ctx.body = result
})


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