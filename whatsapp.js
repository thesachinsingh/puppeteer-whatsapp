const puppeteer = require('puppeteer');
const fs = require('fs');
const QRCode = require('qrcode')


async function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}

class BrowserContext{
    async init(){
        this.browser = await puppeteer.launch({
            userDataDir: './user_data',
            headless: true,
            defaultViewport: null,
            args: ['--no-sandbox']
        });
        this.page = await this.browser.newPage();
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3312.0 Safari/537.36');

        //Put some values regarding typing speed and delay fron config file
        const configs = fs.existsSync('./config.json');
        if (configs){
            let config_data = JSON.parse(fs.readFileSync('./config.json'));
            this.typing_speed = config_data['typing_speed']
        } else{
            console.log("config.json doesn't exist....creating a default config.json for you.")
            default_config_data = {
                typing_speed : 200
            }
            fs.writeFileSync('./config.json', JSON.stringify(default_config_data));
            this.typing_speed = default_config_data["typing_speed"]
        }

    }
    async getQR(){
        let retry_limit = 0;
        // await this.page.waitForSelector("._19vUU[data-ref]", { visible: true, timeout: 5000 });
        // console.log("Inside the getQR")
        try {
            let qr_data = await this.page.evaluate((retry_limit) => {
                while((document.querySelector("._19vUU") === null) || (document.querySelector("._19vUU") === undefined) || (document.querySelector("._19vUU") == '')) {
                    new Promise(resolve => setTimeout(resolve, 1000))
                    // console.log("Inside the first loops inside getQR")
                } 
                let element  = document.querySelector("._19vUU").getAttribute("data-ref")
                //console.log(element)
                while (((element === null) || (element === undefined) || (element === '')) && retry_limit <=10 ) {
                    new Promise(resolve => setTimeout(resolve, 1000))
                    element  = document.querySelector("._19vUU").getAttribute("data-ref")
                    // console.log("Inside the while loop in getQR")
                    retry_limit += 1
                }
                // console.log(element)
                // console.log("Running in GetQR infinite doing nothing")
                return element;
            }, retry_limit)
            // console.log("Inside getQR end")
            return qr_data
        } catch(error){
            console.error(error)
        }
    }
    async waLogin(wss){
        // Check if cookies, localStorage and sessionStorage exist
        const previousSession = fs.existsSync('./cookies.json');
        const previousLocalStorage = fs.existsSync('./localStorage.json');
        const previousSessionStorage = fs.existsSync('./sessionStorage.json');

        if (previousSession && previousLocalStorage && previousSessionStorage) {
            // Get the cookies, local storage, and session storage data from the JSON files
            let cookies = JSON.parse(fs.readFileSync('./cookies.json'));
            let localStorageData = JSON.parse(fs.readFileSync('./localStorage.json'));
            let sessionStorageData = JSON.parse(fs.readFileSync('./sessionStorage.json'));

            // Load the cookies into the web page
            await this.page.setCookie(...cookies);
            await this.page.goto('https://web.whatsapp.com/');
            // Set the local storage and session storage data
            await this.page.evaluate((localStorageData) => {
                for (const key in localStorageData) {
                    localStorage.setItem(key, localStorageData[key]);
                }
            }, localStorageData);
            await this.page.evaluate((sessionStorageData) => {
                for (const key in sessionStorageData) {
                    sessionStorage.setItem(key, sessionStorageData[key]);
                }
            }, sessionStorageData);

            await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
            //const searchButton = await this.page.$('button[aria-label="Search or start new chat"]');
            if (await this.page.$('button[aria-label="Search or start new chat"]')) {
                console.log("User is logged in");
                wss.clients.forEach(client => {
                    if(client.readyState === 1){
                        client.send(JSON.stringify({ status: 'logged in'}))
                    }                    
                });
                return true
            } else {
                console.log("Session Expired");
                fs.unlinkSync("./cookies.json")
                fs.unlinkSync("localStorage.json")
                fs.unlinkSync("sessionStorage.json")
                await this.browser.close()
                console.log("Deleting User Data Dir")
                try {

                    fs.rmSync(`${__dirname}/user_data`, {recursive: true, force: true})
                    console.log("User Data Dir deleted")
                } catch (error) {
                    console.error(error)
                }
                await this.waLogin(wss)

            }
        } else {
            console.log("cookies not found, session not found, localstorage not found. Giving QR for Login")
            // await this.page.setViewport({width: 1920, height: 1080, isLandscape: true});
            await this.page.goto('https://web.whatsapp.com/', { waitUntil: 'networkidle0' });
            // await this.page.setViewport({width: 1440, height: 900, isLandscape: true});
            // console.log("Waiting for user to Scan")
            console.log("Sending QR for user to Scan")
            await sleep(2000)    
            // await sleep(40000);
            //If logged in then only save the cookies, localStorage, sessionStorage
            //else keep checking if the qr code changes and send the new QR code to the frontend
            let qr_data = '', prev_qr = '', qr_limit=0;
            while (!(await this.page.$('button[aria-label="Search or start new chat"]')) && qr_limit <= 5) {
                try {
                    // await sleep(10000)
                    // console.log("Entered the loop")
                    qr_data = await this.getQR()
                    if ((qr_data === prev_qr) || (qr_data === null || qr_data === '' || qr_data === undefined)) {
                        //do nothing
                        // console.log("QR Not Changed Yet")
                        await sleep(10000)
                        //waiting_time+=1
                        // if(waiting_time >= 60){
                        //     console.log("Waiting time excedeed 30 seconds")
                        //     break;
                        // }
                    } else {
                        // while(qr_data === null || qr_data === '' || qr_data === undefined){
                        //     await sleep(1000)
                        //     qr_data = await this.getQR()
                        // }
                        // console.log("Entered else statement")
                        console.log(qr_data)
                        const qrImage = await QRCode.toDataURL(qr_data)
                        //console.log(qr_data)
                        wss.clients.forEach(client => {
                            if(client.readyState ===  1){
                                client.send(JSON.stringify({ status: 'not logged in', qr: qrImage, isqr: true}));
                            }
                        })
                        qr_limit+=1
                        prev_qr = qr_data
                        //waiting_time = 0
                    }
                    //prev_qr = qr_data
                    //console.log("Completed the loop once")
                    
                } catch (error) {
                    console.log(error)
                }
                sleep(1000)
        
            }

            if(qr_limit <= 5){
                console.log("User is logged in");
                // Save cookies
                const cookies = await this.page.cookies();
                fs.writeFileSync('cookies.json', JSON.stringify(cookies));
                console.log('Session has been saved to "cookies.json"');
    
                // Save Local Storage
                const localStorageData = await this.page.evaluate(() => {
                    let json = {};
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        json[key] = localStorage.getItem(key);
                    }
                    return json;
                });
                fs.writeFileSync('localStorage.json', JSON.stringify(localStorageData));
                console.log("LocalStorage Data Stored")
    
                // Save Session Storage
                const sessionStorageData = await this.page.evaluate(() => {
                    let json = {};
                    for (let i = 0; i < sessionStorage.length; i++) {
                        const key = sessionStorage.key(i);
                        json[key] = sessionStorage.getItem(key);
                    }
                    return json;
                });
                fs.writeFileSync('sessionStorage.json', JSON.stringify(sessionStorageData));
                console.log("Session Data Stored")
                
                wss.clients.forEach(client => {
                    if(client.readyState === 1){
                        client.send(JSON.stringify({ status: 'logged in', isqr: false,}))
                    }                    
                });                        
                return true
    
            } else{
                if(qr_limit > 5)
                console.log("User was given 5 tries but still didn't log In")

                return false
            }
            
        }
        // console.log("Whatsapp logged in successfully");

    }

    async saveSession(){
        fs.unlinkSync("cookies.json")
        fs.unlinkSync("localStorage.json")
        fs.unlinkSync("sessionStorage.json")
        // Save cookies
        const cookies = await this.page.cookies();
        fs.writeFileSync('cookies.json', JSON.stringify(cookies));
        console.log('Session has been saved to "cookies.json"');

        // Save Local Storage
        const localStorageData = await this.page.evaluate(() => {
            let json = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                json[key] = localStorage.getItem(key);
            }
            return json;
        });
        fs.writeFileSync('localStorage.json', JSON.stringify(localStorageData));

        // Save Session Storage
        const sessionStorageData = await this.page.evaluate(() => {
            let json = {};
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                json[key] = sessionStorage.getItem(key);
            }
            return json;
        });
        fs.writeFileSync('sessionStorage.json', JSON.stringify(sessionStorageData));
        console.log("Session Data Stored")
    }

    async getLoginQRString(){
        // const QRCode = require('qrcode')
        await this.page.goto('https://web.whatsapp.com/', { waitUntil: 'networkidle0' });
        // await this.page.setViewport({width: 1440, height: 900, isLandscape: true});
        let qr_data
        console.log("Sending QR for user to Scan")
        try {
            // await sleep(10000)
            await this.page.waitForSelector("._19vUU[data-ref]", { visible: true, timeout: 20000 });
            qr_data = await this.page.evaluate(() => {
                const element  = document.querySelector("._19vUU").getAttribute("data-ref")
                // console.log(element)
                return element;
            })
            console.log(qr_data)
        } catch (error) {
            console.log(error)
        }
        
        return qr_data
    }

    async openChat(user){
        await this.page.click('div[title="New chat"]', {button: 'left'})
        console.log("Clicked on new chat")
        //To open chat of a person via mobile number 
        await this.page.type("._2vDPL", user, {delay: this.typing_speed});
        await sleep(1000)   //originally 2000
        await this.page.click("._199zF._3j691", {button: 'left'})
        console.log("Opened the chat")
        await sleep(1000)
    }

    async sendMessage(customerMobile, customMessage, send_now = true){   
        console.log(customMessage)
        let message_arr = customMessage.split("\n");
        await this.openChat(customerMobile)
        //this is kept if the person has multiline message with newline characters in between
        for(let i=0; i<message_arr.length; i++){
            await this.page.type("._3Uu1_", message_arr[i], {delay: this.typing_speed})
            await this.page.keyboard.down('Shift');
            await this.page.keyboard.down('Enter');
            await this.page.keyboard.up('Enter');
            await this.page.keyboard.up('Shift');
        }    
        console.log("Message Typed")
        await sleep(1000)
        if(send_now == true){
            await this.page.click('button[aria-label="Send"]', {button: 'left'})
            console.log("Message sent")
            await sleep(1000)
        }
    
    }
    async sendImage(user, file_path, same_person = false){
        if(same_person == false){
            await this.openChat(user)
        }
        
        await this.page.click('div[aria-label="Attach"]', {button: 'left'});
        await sleep(2000)
    
    
        // await page.evaluate(() => {
        //     var headings = document.evaluate("//span[contains(., 'Photos & Videos') and @class='erpdyial tviruh8d gfz4du6o r7fjleex lhj4utae le5p0ye3']", document, null, XPathResult.ANY_TYPE, null );
        //     var thisHeading = headings.iterateNext();
        //     console.log(thisHeading?.innerText)
        //     // if (thisHeading) thisHeading.click()
        // })
    
        const inputUploadHandle = await this.page.$('input[accept="image/*,video/mp4,video/3gpp,video/quicktime"]');
        await inputUploadHandle.uploadFile(file_path);
        await sleep(2000);
        await this.page.click('div[aria-label="Send"][role="button"]', {button: 'left'});
        await sleep(1000)
    }
    async sendMessageWithImage(customerMobile, customMessage, image_path){
        await this.sendMessage(customerMobile, customMessage, false);
        await this.sendImage(customerMobile, image_path, true)
    }


    async sendBulkMessages(users, messages){
        for(let i=0;i<users.length;i++){
            console.log(messages[i])
            await this.sendMessage(users[i], messages[i]);
        } 
    }

    async sendBulkMedias(users, file_paths){
        for(let i=0;i<users.length;i++){
            await this.sendImage(users[i], file_paths[i])
        }
    }

    async sendBulkMessagesWithSameMedia(users, messages, image_path){
        for(let i=0;i<users.length;i++){
            await this.sendMessage(users[i], messages[i], false);
            await this.sendImage(users[i], image_path, true);

        }
    }

    async sendBulkMessagesWithDiffMedia(users, messages, image_paths){
        for(let i=0;i<users.length;i++){
            await this.sendMessage(users[i], messages[i], false)
            await this.sendImage(users[i], image_paths[i], true)
        }
    }

}

module.exports = BrowserContext;

// async function sendMessage(page, customerMobile, customMessage, send_now = true){   
//     let message_arr = customMessage.split("\n");
//     //To click on new chat button
//     await this.page.click('div[title="New chat"]', {button: 'left'})
//     console.log("Clicked on new chat")
//     //To open chat of a person via mobile number 
//     await this.page.type("._2vDPL", customerMobile, {delay: 200});
//     await sleep(10000)   //originally 2000
//     await this.page.click("._199zF._3j691", {button: 'left'})
//     console.log("Opened the chat")
//     await sleep(5000)

//     //this is kept if the person has multiline message with newline characters in between
//     for(let i=0; i<message_arr.length; i++){
//         await this.page.type("._3Uu1_", message_arr[i], {delay: 200})
//         await this.page.keyboard.down('Shift');
//         await this.page.keyboard.down('Enter');
//         await this.page.keyboard.up('Enter');
//         await this.page.keyboard.up('Shift');
//     }    
//     console.log("Message Typed")
//     await sleep(1000)
//     if(send_now == true){
//         await this.page.click('button[aria-label="Send"]', {button: 'left'})
//         console.log("Message sent")
//         await sleep(1000)
//     }

// }

// async function attachImage(page, file_path){
//     await this.page.click('div[aria-label="Attach"]', {button: 'left'});
//     await sleep(2000)


//     // await page.evaluate(() => {
//     //     var headings = document.evaluate("//span[contains(., 'Photos & Videos') and @class='erpdyial tviruh8d gfz4du6o r7fjleex lhj4utae le5p0ye3']", document, null, XPathResult.ANY_TYPE, null );
//     //     var thisHeading = headings.iterateNext();
//     //     console.log(thisHeading?.innerText)
//     //     // if (thisHeading) thisHeading.click()
//     // })

//     const inputUploadHandle = await this.page.$('input[accept="image/*,video/mp4,video/3gpp,video/quicktime"]');
//     await inputUploadHandle.uploadFile(file_path);
//     await sleep(2000);
//     await this.page.click('div[aria-label="Send"][role="button"]', {button: 'left'});
//     await sleep(1000)
// }


// login();

// async function getLoginQR(){
//     // const QRCode = require('qrcode')
//     qr_data = await this.page.waitforSelector("._19vUU").getAttribute("data-ref")
//     // QRCode.toString(qr_data,{type:'terminal'}, function (err, url) {
//     //     if(err) return console.log("error occurred")
//     //     console.log(url)
//     //   })
//     // a = await QRCode.toDataURL(qr_data)
//     // console.log(a)
//     return qr_data
// }
//abc()