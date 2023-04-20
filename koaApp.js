const fs                = require('fs');
const getOrderDetail    = require('./utils/athena/detail')
const getOrderTag       = require('./utils/athena/tag')

const Koa = require('koa');
const koaApp = new Koa();
var port = (process.env.PORT ||  80 );

koaApp.use(async (ctx, next) => {
    const rt = ctx.response.get('X-Response-Time');
    console.log(`${ctx.method} ${ctx.url} - ${rt}`);
    await next();
});


// x-response-time
koaApp.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.set('X-Response-Time', `${ms}ms`);
});


koaApp.use(async (ctx, next) => {
    if (ctx.path === '/data') {
        let order_id = `${ctx.query.order_id}`

        // const tag = await getOrderTag(order_id);
        // const detail = await getOrderDetail(order_id);
        // let body = await buildBody( detail,  tag);

        let [detail, tag] = await Promise.all([getOrderDetail(order_id), getOrderTag(order_id)])
        let body = await buildBody( detail,  tag);

        ctx.body = body
    } else if (ctx.path === '/') {
         ctx.body = fs.readFileSync('index.html', {encoding:'utf8', flag:'r'});
    } else {
        ctx.body = 'Hello World: ' + ctx.path;
    }

    next();
})

async function buildBody(detail, tag){
    /** Tags map to Status */
    let tags =  tag.map(t=>t.name)
    // console.log(tags)
    let status = ''
    if(detail.status != 3) {
        status = "In-Progress"; // Ticket is still open, we consider this as in-progress
    } else {
        if(tags.includes("Out of Scope")) {
            status = "Out of Scope"
        } else if(tags.includes("Completed - Optimal") || tags.includes("Completed - Not Optimal")) {
            status = "Completed"
        } else {
            status = "Client Dropoff"
        }
    }

    /** GBS Name */
    const gbs_name = detail.owner_name;

    /** Client Name */
    const client = ''



    /** Plat_id */
    const plat_id_map = {
        "1701962904795138": "Delivery",
        "1681100484057089": "Measurement"
    }
    const plat_id = plat_id_map[detail.plat_id] || detail.plat_id;


    /** Title */
    const title = detail.title
    /** Issue Desc */
    const issue_desc = detail.items.filter(r=> r.label.includes('Issue Description')).pop()?.content?.toString();


    /** ADV ID */
    const adv_id = detail.items.filter(r=> r.label.includes('Ad Account ID')).pop()?.content?.toString();
    // if(detail.id == '1031013') {
    //     console.log(`adv_id: `)
    //     console.log(detail.items.filter(r=> r.label.includes('Ad Account ID')).pop().content.toString())
    // }

    /** Current Follower */
    const follower = detail.follower;

    /** Ticket Open Time */
    const create_time = (new Date(detail.create_time*1000)).toISOString().split('T')[0];
    /** Ticket Close Time */
    const close_time = (detail.status==3)?((new Date(detail.update_time*1000)).toISOString().split('T')[0]):'';
    /** Ticket Duration */
    const duration = (close_time == '')?'':(((parseInt(detail.update_time)-parseInt(detail.create_time))) / 3600 / 24).toFixed(2)
    console.log((((parseInt(detail.update_time)-parseInt(detail.create_time))) / 3600 / 24).toFixed(2))

    const replies=  detail.replies;



    /** Return to request */
    return JSON.stringify({
        refresh: (new Date(Date.now())).toISOString().substring(0,19) + 'Z',
        plat_id,
        client,
        adv_id,
        gbs_name,
        title,
        issue_desc,
        status,
        follower,
        create_time,
        close_time,
        duration,



        delimeter: "------------------------------------------------",
        detail : (process.env.PLATFORM == 'FAAS')?"omitted":detail
    }, null, 2)
}

async function init() {
    console.log(`Server Init ---> ${(new Date(Date.now())).toISOString()}`);
}

module.exports = {
  koaApp,
  init,
};


