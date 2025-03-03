const jwt = require('jsonwebtoken')

function userMiddlwware(req, res, next){
    const bearertoken = req.headers.authorization.split(' ')[1];
    if(!bearertoken){
        res.status(401).json({
            msg: "No token provided"
        })
    }

    try{
        const decoded = jwt.verify(bearertoken, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch(error){
        res.status(401).json({
            msg: "Invalid or expired token",
            error: error.message
        })
    }

}

module.exports = userMiddlwware;