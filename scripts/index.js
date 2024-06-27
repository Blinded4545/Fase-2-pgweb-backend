
const express = require("express")
const bodyParser = require("body-parser")
const bcrypt = require("bcrypt")
const sqlite3 = require("sqlite3").verbose()
const cors = require("cors")
const cookieParser = require("cookie-parser")
const nodemailer = require("nodemailer")

const app = express()
const slt = 18 //esto es usado para hashear contraseñas

const emailRegex = /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i

const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
        user: "pgwebProjectDummy@outlook.com",
        pass: "Camilo23/08"
    }
})

app.use(cors({ //Esto es para evitar problemas para acceder con el frontend
    credentials: true,
    origin: "http://localhost:3000"
}))
app.use(cookieParser())

const jsonParser = bodyParser.json()

app.set("port", 8000)

app.post("/reg", jsonParser, async (req,res)=>{
    let usr = req.body.usr
    let pwd = req.body.pwd
    let email = req.body.email
    
    let emailCheck = email.toLowerCase().match(emailRegex) // Con esto se hace la comprobacion del email

    if(emailCheck == null){
        res.send("Bad email")
        return
    }else{

        //Con esto se genera el hash de la contraseña
        bcrypt.
        hash(pwd, slt).
        then(hash=>{
            //console.log("usr: "+usr+"\npwdNormal: "+pwd+"\npwdHashed: "+pwdHash+"\nemailcheck: "+emailCheck[0])

            // Insertar el nuevo usuario a la base de datos

            let db = new sqlite3.Database("./database/appDB.db", (err)=>{
                if(err)console.log(err);
            })

            db.run("INSERT INTO Users (Username, Password, Email) VALUES (?,?,?)", [usr, hash, emailCheck[0]], (err)=>{
                if(err){
                    return res.send(err)
                }

                res.sendStatus(200)
            })

            db.close()
            return

        }).catch(err=>console.log(err))
    }
})

app.post("/login", jsonParser, (req, res)=>{
    let usr = req.body.usr
    let pwd = req.body.pwd

    if(pwd == null){
        return res.sendStatus(401)
    }

    let db = new sqlite3.Database("./database/appDB.db", (err)=>{
        if(err)console.log(err);
    })

    db.all("SELECT * FROM Users WHERE Username=(?)", [usr], async (err,rows)=>{
        if(err)console.log(err);
    
        if(rows.length!=0){
            if(!await bcrypt.compare(pwd, rows[0]["Password"])){
                return res.status(401).json({"message": "Invalid password"})
            }else{

                res.cookie("Username", usr, {
                    httpOnly: false,
                    maxAge: 10*60*1000
                })
                console.log(rows[0]["profilePhotoUrl"]);
                console.log(rows[0]["Reservation"]);
                if(rows[0]["Reservation"]!=null){
                    res.cookie("Reserve", rows[0]["Reservation"], {
                        httpOnly: false,
                        maxAge: 10*60*1000
                    })
                }
                if(rows[0]["profilePhotoUrl"]!=null){
                    res.cookie("profilePhoto", rows[0]["profilePhotoUrl"], {
                        httpOnly: false,
                        maxAge: 10*60*1000
                    })
                }

                return res.sendStatus(200)
            }
        }
    })

    db.close()
})

app.post("/logout", (req,res)=>{
    res.cookie("Username", "", {
        maxAge: 0
    })
    res.cookie("reserv", "", {
        maxAge: 0
    })
    res.cookie("profilePhoto", "", {
        maxAge: 0
    })

    res.end()
})

app.put("/makeReservation", jsonParser, (req,res)=>{ //Actualizar el campo de los detalles de reservacion del usuario
    let usr = req.body.usr.state
    let reservDetails = req.body.reservDetails

    let db = new sqlite3.Database("./database/appDB.db", (err)=>{
        if(err)console.log(err);
    })


    db.run("UPDATE Users SET Reservation=? WHERE Username=?", [reservDetails, usr], (err)=>{
        if(err)console.log(err);

        console.log(reservDetails);
        console.log(usr);

        res.cookie("reserv", reservDetails, {
            httpOnly:false,
            maxAge: 10*60*1000
        })

        res.sendStatus(200)
    })
    
    db.close()
})

app.delete("/deleteReserv", jsonParser, (req,res)=>{
    let usr = req.body.usr

    let db = new sqlite3.Database("./database/appDB.db", (err)=>{
        if(err)console.log(err);
    })

    db.run("UPDATE Users SET Reservation=? WHERE Username=?", [null, usr], (err)=>{
        if(err)console.log(err);


        res.cookie("reserv", "", {
            maxAge: 0
        })

        res.sendStatus(200)
    })

    db.close()
})

app.post("/changePFP", jsonParser, (req,res)=>{
    let usr = req.body.usr
    let photoURL = req.body.photoURL

    let db = new sqlite3.Database("./database/appDB.db", (err)=>{
        if(err)console.log(err);
    })

    db.run("UPDATE Users SET profilePhotoUrl=? WHERE Username=?", [photoURL, usr], (err)=>{
        if(err)console.log(err);

        console.log(photoURL);
        res.cookie("profilePhoto", photoURL, {
            httpOnly: false,
            maxAge:10*60*1000
        })
        
        res.sendStatus(200)
    })

    db.close()
})


//Esto es para enviar el correo de recuperacion, el cual contiene el codigo que necesitas para poder recuperar la contraseña
app.post("/recoveryMail", jsonParser, async (req,res)=>{
    let usr = req.body.usr

    const digits = [0,1,2,3,4,5,6,7,8,9,'A','B','C','D','E','F']
    let hexCode = ""

    while( hexCode.length < 6 ){
        hexCode += digits[ Math.floor( Math.random() * digits.length ) ]
    }

    let db = new sqlite3.Database("./database/appDB.db", (err)=>{
        if(err)console.log(err);
    })

    await db.run("UPDATE Users SET changeCode=? WHERE Username=?", [hexCode, usr], (err)=>{
        if(err)console.log(err);
    })

    db.all("SELECT * FROM Users WHERE Username=?", [usr], async (err, rows)=>{
        if(err)console.log(err);

        if(rows.length==0){
            return res.sendStatus(401)
        }
        else{
            let email = rows[0]["Email"]

            
            const send = await transporter.sendMail({
                from: "pgwebProjectDummy@outlook.com",
                to: email,
                text: `El codigo de recuperacion es: ${hexCode}`
            })

            console.log(send);
            //res.sendStatus(200)
            res.send(hexCode)
        }
    })
    db.close()
})


//Con esto solo cambias la contraseña luego de encriptarla
app.put("/changePassword", jsonParser, (req, res)=>{
    let usr = req.body.usr
    let newPwd = req.body.newPwd


    bcrypt.hash(newPwd, slt).then(async hash=>{
        let db = new sqlite3.Database("./database/appDB.db", (err)=>{
            if(err)console.log(err);
        })

        console.log(hash);

        db.run("UPDATE Users SET Password=? WHERE Username=?", [hash, usr], (err)=>{
            if(err)console.log(err);
    
            res.sendStatus(200)
        })
    })
    
    
    db.close()
})

app.get("/getRecoveryCode", jsonParser, (req, res)=>{

    let usr = req.body.usr

    let db = new sqlite3.Database("./database/appDB.db", (err)=>{
        if(err) console.log(err);
    })

    db.all("SELECT * FROM Users WHERE Username=?", [usr], (err,rows)=>{
        if(err) console.log(err);

        if(rows.length==0){
            return res.sendStatus(401)
        } else {
            return res.send(rows[0]["ChangeCode"])
        }


    })

    db.close()

})

app.listen(app.get("port"), ()=>{
    console.log("Running on port "+app.get("port"));
})

/*
    
    Porcentajes de participacion en el backend:

        Camilo Herrera 60%
        Cristian Choperena 30% Colaboro en algunos endpoints como el de registrar la reserva o el de agregar las fotos de perfil
        Angelica Sanabria 6%
        Yeison Mayorga 1%

*/