const whatsapp = require("./whatsapp")
const express = require('express');
const bodyParser = require('body-parser');
// const QRCode = require('qrcode')
const WebSocket = require('ws');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
let obj = new whatsapp();
obj.init()

// app.use((req, res, next) => {
//     console.log(req.body);
//     next();
// });

const wss = new WebSocket.Server({ port: 8080 });
wss.on('connection', ws => {
    ws.on('message', message => {
      console.log(`Received message => ${message}`)
    })
    ws.send(JSON.stringify({ status: 'not logged in', data : "Hello from the server", isqr: false}))
    //console.log(obj.page.url())
    console.log(typeof(obj.page.url))
  });


app.get('/', async(req, res) => {
    res.sendFile(`${__dirname}/index.html`)
})


// app.get('/init', async (req, res) => {
//     await obj.init()
//     res.send('App initialised successfully');
// });

app.get('/login', async (req, res) => {
    let logged_in = await obj.waLogin(wss);
    // res.send({ qr_string: string_qr });
    res.send(`Logged In Status : ${logged_in} `);
});

// app.get('/qr', async (req, res) => {
//     const qr_data = await obj.getLoginQRString();
//     const qrImage = await QRCode.toDataURL(qr_data);

//     res.send(qrImage);
// });

// app.post('/chat', async (req, res) => {
//     const { user } = req.body;
//     await browserContext.openChat(user);
//     res.send('Chat opened');
// });

app.post('/message', async (req, res) => {
    console.log("Starting send message procedure...")
    const { customerMobile, customMessage} = req.body;
    console.log(req.body)
    try {
        console.log(customMessage)
        await obj.sendMessage(customerMobile, customMessage)
        res.send('Message sent');        
    } catch (error) {
        console.error(error)
        res.status(500).send("An error occured")
    }

});

app.post('/message-with-image', async (req, res) => {
    const { customerMobile, customMessage, image_path } = req.body;
    await obj.sendMessageWithImage(customerMobile, customMessage, image_path);
    res.send('Message sent with image');
});

app.post('/bulk-messages', async (req, res) => {
    const { users, message_template } = req.body;
    console.log(users)
    let vars = [], vars_index = {}, messages = [], ph_numbers=[];
    let x = message_template.split(' ').map(x => {
        if(x.includes('${') && (x.endsWith('}') || x.endsWith('},'))){
            let variable = x.replace('${', '').replace('},', '').replace('}', '')
            vars.push(variable)
            return variable
        }
    })
    if(users[0][0] == 'phone_number'){
        for(let i=1; i<users[0].length; i++){
            if(users[0][i] && vars.includes(users[0][i])){
                vars_index[users[0][i]] = i
            }
            else{
                break;
            }
        }
        for(let i=1; i<users.length; i++){
            messages.push(message_template)
            ph_numbers.push(users[i][0])
            for(let j=0; j<vars.length; j++){
                let a = '${', b = '}';
                let x_var = a.concat(vars[j], b)
                messages[i-1] = messages[i-1].replace(a.concat(vars[j], b), users[i][vars_index[vars[j]]])
                //console.log(messages[i])
            }
            console.log(messages[i])
        }
    }
    await obj.sendBulkMessages(ph_numbers, messages);
    res.send('Bulk messages sent');
});

app.post('/bulk-message-with-same-media', async (req, res) => {
    const { users, messages, image_path } = req.body;
    await obj.sendBulkMessagesWithSameMedia(users, messages, image_path);
    res.send('Bulk messages sent with same media');
});

app.post('/bulk-message-with-diff-media', async(req, res) => {
    const {users, messages, image_paths} = req.body;
    await obj.sendBulkMessagesWithDiffMedia(users, messages, image_paths)
    res.send('Bulk Messages sent with diff media')
})

app.get('/session', async(req, res) => {
    res.send("Session Logged in")
})

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
