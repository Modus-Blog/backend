
import express from 'express'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'node:crypto'
import fileUpload from 'express-fileupload'
import fs from 'fs'

// custom imports
import Validator from './validator.js'

////////////////////////////////////////////////////////
// basics for server
dotenv.config();
const app = express()
const api = express.Router()
const api_auth = express.Router()


const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename)


////////////////////////////////////////////////////////
// connects to mongo db
const client = new MongoClient(process.env.MONGO_URI);
const db = client.db('modus');


////////////////////////////////////////////////////////
// utils

const initVector = crypto.randomBytes(16);
const Securitykey = crypto.randomBytes(32);


function encryptAES(message) {

    const cipher = crypto.createCipheriv("aes-256-cbc", Securitykey, initVector);
    let encryptedData = cipher.update(message, "utf-8", "hex");
    encryptedData += cipher.final("hex");
    return encryptedData

}

function decryptAES(message) {

    const decipher = crypto.createDecipheriv("aes-256-cbc", Securitykey, initVector);
    let decryptedData = decipher.update(message, "hex", "utf-8");
    decryptedData += decipher.final("utf8");
    return decryptedData

}

function authorize(cookie) {
    let session
    let auth = {
        "allowed": true,
        "msg": "Cookie is valid"
    }

    if (cookie == null) {
        auth.allowed = false
        auth.msg = "No cookie provided"
    }
    else {
        try {
            session = JSON.parse(decryptAES(cookie))
        }
        catch (e) {
            auth.allowed = false
            auth.msg = "Cookie is invalid"
        }
        if (auth.allowed && (Date.now() - session.date > 86400000)) {
            auth.allowed = false
            auth.msg = "Cookie expired"
        }
    }

    return auth
}


////////////////////////////////////////////////////////
//middlewares
app.use(express.json());
app.use(fileUpload());
app.use(express.static(path.join(__dirname + "/raw/")))
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).send({ "error": err.message }); // Bad request
    }
    next();
});

api_auth.use((req, res, next) => {
    let auth = authorize(req.body.cookie)
    if (!auth.allowed) {
        return res.status(400).json({ "error": auth.msg })
    }
    next()
})

app.use("/api", api)
app.use("/api", api_auth)


////////////////////////////////////////////////////////
//auth route
api.post('/register', async (req, res) => {
    // validate form
    let v = new Validator(req.body)
    await v.validate("email").isRequired().isEmail().isUnique(db.collection("users"), { "email": v.arg })
    v.validate("username").isRequired()
    v.validate("password").isRequired().minSize(8)//.isComplexPass()
    if (v.err.length != 0)
        return res.status(400).json(v.err)

    // create user object
    let user = {
        email: req.body.email,
        username: req.body.username,
        password: crypto.createHash("sha256").update(req.body.password).digest('hex')
    }
    // save new user
    db.collection('users').insertOne(user)
    res.json({ 'info': 'created' });

})

api.post('/login', async (req, res) => {
    // validate form
    let v = new Validator(req.body)
    v.validate('email').isRequired().isEmail()
    v.validate('password').isRequired()
    if (v.err.length != 0)
        return res.status(400).json(v.err)

    // retrieve user
    const user = await db.collection('users').findOne({ "email": req.body.email }, {});
    // hash given password
    let pass_hash = crypto.createHash("sha256").update(req.body.password).digest('hex')

    // validates auth
    if ((user != null) && (user.password == pass_hash)) {
        let cookie = encryptAES(JSON.stringify({ "user": user.email, "date": Date.now() }))
        return res.status(200).json({ "cookie": cookie })
    }
    else {
        return res.status(200).json({ "error": "invalid credentials" })
    }


})


////////////////////////////////////////////////////////
// images routes

api_auth.post('/img', (req, res) => {

    //check for file on img input
    if (!req.files || !req.files.img || Object.keys(req.files).length === 0) {
        return res.status(400).json({'error' : 'No files were uploaded.'});
    }

    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    let sampleFile = req.files.img;
    let uploadPath = __dirname + '/raw/' + sampleFile.md5;

    // Use the mv() method to place the file somewhere on your server
    sampleFile.mv(uploadPath, function (err) {
        if (err)
            return res.status(500).send(err);
    });
    res.status(200).json({ "id": sampleFile.md5 })
})

api_auth.delete('/img', (req, res) => {
    let v = new Validator(req.body)
    v.validate('id').isRequired().sizeOf(32).hasNoSpecialChar()
    if (v.err.length != 0)
        return res.status(400).json(v.err)

    try {
        fs.unlinkSync(__dirname + '/raw/' + req.body.id)
        res.status(200).json({ 'info': 'deleted' })
    }
    catch (e) {
        res.status(500).json({ 'error': e })

    }
})


////////////////////////////////////////////////////////
// postes routes

api_auth.post('/post', (req, res) => {
    //validate form
    let v = new Validator(req.body)
    v.validate('metadata').isRequired()
    v.validate('content').isRequired()
    if (v.err.length != 0)
        return res.status(400).json(v.err)

    // TO REDO : create the post
    let id = crypto.createHash("sha256").update(JSON.stringify(req.body.post)).digest('hex')
    db.collection('posts').insertOne({ "id": id, "post": req.body.post })
    res.status(200).json({ 'id': id })
})


api.get('/post/:id', (req, res) => { })
api.get('/post/:id/edit', (req, res) => { })
api.get('/post', (req, res) => { })


////////////////////////////////////////////////////////
// Fallbacks

// Fallback API
api.all("*", (req, res) => {
    res.status(404).json({ "error": "Unknown api route" })
})

// Fallback WEB
app.all('*', (req, res) => {
    res.status(200).end('frontEnd')
})

// starts server
app.listen(process.env.PORT, () => {
    console.log(`Example app listening on port ${process.env.PORT}`)
})