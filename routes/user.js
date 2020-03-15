const request = require('superagent');

module.exports = ({ userRouter }) => {
    // getting the users
    userRouter.get('/', async (ctx, next) => {
        await request
            .get('https://reqres.in/api/users')
            .then(res => {
                ctx.body = res.body;
            })
            .catch(err => {
                console.log(err);
            });
    }).post("/", async (ctx, next) => {
        const data = {
            "name": "CyberBot143",
            "job": "Developer"
        }
        await request
            .post('https://reqres.in/api/users')
            .send(data)
            .then(res => {
                ctx.body = res.body;
            })
            .catch(err => {
                console.log(err);
            });

    })

    userRouter.post(`/:id`, async (ctx, next) => {
        const { id } = ctx.params
        await request
            .post(`https://reqres.in/api/users/${id}`)
            .then(res => {
                ctx.body = res.body;
            })
            .catch(err => {
                console.log(err);
            });
    });


};