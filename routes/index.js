const nodemailer = require('nodemailer');
var http = require('http').Server();
var client = require('socket.io').listen(8080).sockets;
var User = require('./model/users');
var Message = require('./model/messages');
var multer = require('multer');
var fs = require('fs');
var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, './public/uploads');
    },
    filename: function (req, file, callback) {
        var extArray = file.mimetype.split("/");
        var extension = extArray[1];


        callback(null, file.fieldname + '_' + Date.now() + '.' + extension);
    }

});
var upload = multer({ storage: storage }).single('ionicfile');

module.exports = function (app, id) {
    var transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: id.email,
            pass: id.pass
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    app.get('/', function (req, res) {
        res.send('err 404: Page not found.');
    });
    app.post('/imageUpload', function (req, res) {
        upload(req, res, function (err) {
            if (err)
                console.log(err);
            else
                var data = req.body;
            var picUrl = 'uploads/' + req.file.filename;
            if (data.data == 'profile') {
                res.status(201).json(picUrl);
                User.findOne({ 'Email': data.owner }, function (err, user) {
                    if (err)
                        throw err;
                    else {
                        var imageurl = user.Profile_pic;

                        var imagefolder = imageurl.split('/');

                        if (imagefolder[0] == 'uploads') {
                            fs.unlink('public/' + imageurl, function () {
                            });
                        }
                    }
                });
                User.update({ 'Email': data.owner }, { $set: { 'Profile_pic': picUrl } }, function (err) {
                    if (err)
                        throw err;

                });
            } else if (data.data == 'more') {
                res.status(201).json(data.index + '~' + picUrl);
                var imageurls = []

                User.findOne({ 'Email': data.owner }, function (err, user) {
                    if (err)
                        throw err;
                    else {
                        imageurls = user.More_pic;
                        if (imageurls[data.index] != undefined) {
                            var imagefolder = imageurls[data.index].split('/');
                            if (imagefolder[0] == 'uploads') {
                                fs.unlink('public/' + imageurls[data.index], function () {
                                });
                            }
                        }
                        imageurls[data.index] = picUrl;
                        console.log(imageurls, data.index, res);
                        User.update({ 'Email': data.owner }, { $set: { 'More_pic': imageurls } }, function (err) {
                            if (err)
                                throw err;

                        });
                    }
                })
            } else {
                res.status(201).json(picUrl + '~' + data.imageTime);


            }
        })
    });
    client.on('connection', function (socket) {
        socket.on('appData', function (data) {
            var datam = data.data;
            module = datam[0];
            switch (module) {
                case 'call':
                    socket.broadcast.emit('serverData', { module: 'callResponse', submodule: datam[1], data: datam[2] });
                    break;
                case 'DeleteMessageSelected':
                    Message.find({
                        $or: [
                            { 'from': datam[1], 'to': datam[2], 'id': { $in: datam[3] } },
                            { 'from': datam[2], 'to': datam[1], 'id': { $in: datam[3] } }]
                    }, function (err, result) {

                        if (err)
                            throw err;
                        else {
                            result.map(function (q) {
                                if (!q.deleteFrom) {
                                    Message.update({
                                        $or: [
                                            { 'from': datam[1], 'to': datam[2], 'id': q.id },
                                            { 'from': datam[2], 'to': datam[1], 'id': q.id }
                                        ]
                                    }, { $set: { 'deleteFrom': datam[1] } }, function (err) {
                                        if (err)
                                            throw err;
                                    });
                                } else if (q.deleteFrom && q.deleteFrom !== datam[1]) {
                                    Message.remove({
                                        $or: [
                                            { 'from': datam[1], 'to': datam[2], 'deleteFrom': { $exists: true }, 'id': q.id },
                                            { 'from': datam[2], 'to': datam[1], 'deleteFrom': { $exists: true }, 'id': q.id }
                                        ]
                                    },
                                        function (err) {
                                            if (err)
                                                throw err;
                                        });
                                }
                            });
                        }
                    });
                    socket.emit('serverData', { module: 'ChatResponse', res: ['updateDeletedMessages', datam] });
                    break;
                case 'updatemessageImage':
                    Message.update({ 'image': datam[2] }, {
                        $set: {
                            'image': datam[1]
                        }
                    }, function (err) {
                        if (err)
                            throw err;
                        else {
                            socket.emit('serverData', { module: 'updateMessageImage', data: datam });
                            socket.broadcast.emit('serverData', { module: 'updateMessageImage', data: datam });
                        }
                    });

                    break;
                case 'updateProfileImage':
                    socket.emit('serverData', { module: 'imageUpdated', ownerImage: datam[1], image: datam[2] });
                    socket.broadcast.emit('serverData', { module: 'imageUpdated', ownerImage: datam[1], image: datam[2] });
                    break;
                case 'updateProfileImageMore':
                    socket.emit('serverData', { module: 'imageUpdatedMore', ownerImage: datam[1], image: datam[2], index: datam[3] });
                    socket.broadcast.emit('serverData', { module: 'imageUpdatedMore', ownerImage: datam[1], image: datam[2], index: datam[3] });
                    break;
                case 'login':
                    User.findOne({ 'Email': datam[1] }, function (err, user) {
                        if (err)
                            throw err;
                        else if (!user) {
                            socketResponse(socket, { module: 'loginResponse', res: 'The email you entered is not registered.' });
                        } else if (!user.validPassword(datam[2])) {
                            socketResponse(socket, { module: 'loginResponse', res: 'The password you submitted is incorrect.' });
                        } else if (user.Status != 'active') {
                            socketResponse(socket, { module: 'loginResponse', res: 'inactive' });

                        } else {
                            socketResponse(socket, { module: 'loginResponse', res: 'success' });
                        }
                    });
                    break;
                case 'signup':
                    User.findOne({ 'Email': datam[1] }, function (err, user) {
                        if (err)
                            throw err;
                        else if (user) {
                            socketResponse(socket, { module: 'signupResponse', res: 'failed' })
                        } else if (!user) {
                            var random_number = Math.floor((Math.random()) * (999999 - 100000)) + 100000;
                            var date = getTime();
                            var newUser = new User();
                            newUser.UserId = date[2];
                            newUser.Email = datam[1];
                            newUser.Password = newUser.generatHarsh(datam[2]);
                            newUser.Profile_pic = 'images/bigAvatar.jpg';
                            newUser.More_pic = [];
                            newUser.userName = datam[3];
                            newUser.Profile = false;
                            newUser.Status = random_number;
                            newUser.save(function (err) {
                                if (err)
                                    throw err;
                                else {
                                    var mailOptions = {
                                        from: 'Blindy social platform',
                                        to: newUser.Email,
                                        subject: 'Successful registration to Blindy social platform ✔',
                                        html: 'You have successfully registered to Blindy dating platform. <br/>Please enter this verification code in order for you to proceed.<br/><span style="padding:10px;font-size:15px;color:white;background-color: #D80D88;border-radius: 10px">' + newUser.Status + '</span>'

                                    };
                                    transporter.sendMail(mailOptions, function (err) {
                                        if (err)
                                            throw err;
                                        else
                                            socketResponse(socket, { module: 'signupResponse', res: 'success' });

                                    });
                                }
                            });
                        }
                    });
                    break;
                case 'codeVerification':
                    User.findOne({ 'Email': datam[2], 'Status': datam[1] }, function (err, res) {
                        if (err)
                            throw err;
                        else if (!res) {
                            socketResponse(socket, { module: 'loginResponse', res: 'You have entered an invalid code' });
                        } else if (res) {
                            User.update({ 'Email': datam[2] }, { $set: { 'Status': 'active' } }, function (err) {
                                if (err)
                                    throw err;
                                else
                                    socketResponse(socket, { module: 'loginResponse', res: 'success' });

                            });
                        }
                    });
                    break;
                case 'codeVerification2':
                    User.findOne({ 'Email': datam[2], 'PassCode': datam[1] }, function (err, res) {
                        if (err)
                            throw err;
                        else if (!res) {
                            socketResponse(socket, { module: 'loginResponse', res: 'You have entered an invalid code' });
                        } else if (res) {
                            User.update({ 'Email': datam[2] }, { $set: { 'PassCode': '' } }, function (err) {
                                if (err)
                                    throw err;
                                else
                                    socketResponse(socket, { module: 'loginResponse', res: 'success2' });

                            });
                        }
                    });
                    break;
                case 'ResendCode':
                    var random_number = Math.floor((Math.random()) * (999999 - 100000)) + 100000;
                    User.update({ 'Email': datam[2] }, { $set: { 'Status': random_number } }, function (err) {
                        if (err)
                            throw err;
                        else {
                            var mailOptions = {
                                from: 'Blindy social platform',
                                to: datam[2],
                                subject: 'Verification code request✔',
                                html: 'You are receiving this as a request for a verification code you had submitted. <br/>Please enter this verification code in order for you to proceed.<br/><span style="padding:10px;font-size:15px;color:white;background-color: #D80D88;border-radius: 10px">' + random_number + '</span>'

                            };
                            transporter.sendMail(mailOptions, function (err) {
                                if (err)
                                    throw err;
                                else
                                    socketResponse(socket, { module: 'loginResponse', res: 'codeSent' });

                            });
                        };
                    });
                    break;
                case 'ResendCode2':
                    var random_number = Math.floor((Math.random()) * (999999 - 100000)) + 100000;
                    User.update({ 'Email': datam[2] }, { $set: { 'PassCode': random_number } }, function (err) {
                        if (err)
                            throw err;
                        else {
                            var mailOptions = {
                                from: 'Blindy social platform',
                                to: datam[2],
                                subject: 'Verification code request✔',
                                html: 'You are receiving this as a request for a verification code you had submitted for password reset. <br/>Please enter this verification code in order for you to proceed.<br/><span style="padding:10px;font-size:15px;color:white;background-color: #D80D88;border-radius: 10px">' + random_number + '</span>'

                            };
                            transporter.sendMail(mailOptions, function (err) {
                                if (err)
                                    throw err;
                                else
                                    socketResponse(socket, { module: 'loginResponse', res: 'codeSent2' });

                            });
                        };
                    });
                    break;
                case 'fgPass':
                    User.findOne({ 'Email': datam[1] }, function (err, user) {
                        if (err)
                            throw err;
                        if (!user) {
                            socketResponse(socket, { module: 'loginResponse', res: 'The email you entered is not registered.' });
                        } else {
                            var random_number = Math.floor((Math.random()) * (999999 - 100000)) + 100000;
                            User.update({ 'Email': datam[1] }, { $set: { 'PassCode': random_number } }, function (err) {
                                if (err)
                                    throw err;
                                else {
                                    var mailOptions = {
                                        from: 'Blindy social platform',
                                        to: datam[1],
                                        subject: 'Verification code request✔',
                                        html: 'You are receiving this as a request for a password reset. <br/>Please enter this verification code in order for you to proceed.<br/><span style="padding:10px;font-size:15px;color:white;background-color: #D80D88;border-radius: 10px">' + random_number + '</span>'

                                    };
                                    transporter.sendMail(mailOptions, function (err) {
                                        if (err)
                                            throw err;
                                        else
                                            socketResponse(socket, { module: 'loginResponse', res: 'emailFound' });

                                    });
                                }
                            });
                        }
                    });
                    break;
                case 'passReset':
                    if (datam[1].length < 8) {
                        socketResponse(socket, { module: 'loginResponse', res: 'Password must be at least 8 characters.' });
                    } else if (datam[1] != datam[2]) {
                        socketResponse(socket, { module: 'loginResponse', res: 'The passwords do not match' });
                    } else {
                        User.findOne({ 'Email': datam[3] }, function (err, result) {
                            if (err)
                                throw err;
                            else
                                if (result.userName == datam[1]) {
                                    socketResponse(socket, { module: 'loginResponse', res: 'Your username cannot be the password.' });
                                } else {
                                    var newPass = result.generatHarsh(datam[1]);
                                    User.update({ 'Email': datam[3] }, { $set: { 'Password': newPass } }, function (err) {
                                        if (err)
                                            throw err;
                                        else
                                            socketResponse(socket, { module: 'loginResponse', res: 'success' });
                                    });

                                }
                        })
                    }
                    break;
                case 'fetchUserInfo':
                    User.findOne({ 'Email': datam[1] }, function (err, user) {
                        if (err)
                            throw err;
                        else {
                            socketResponse(socket, { module: 'HomeResponse', res: user, submodule: 'userBasic' });
                            var chatx = user.chats.sort(function (a, b) {
                                return b.time - a.time;
                            });
                            chatx.forEach(function (chat) {
                                User.findOne({ 'Email': chat.Id }, function (err, friend) {
                                    if (err)
                                        throw err;
                                    Message.find(
                                        {
                                            $or: [
                                                { 'from': datam[1], 'to': chat.Id },
                                                { 'from': chat.Id, 'to': datam[1] }

                                            ]
                                        }, function (err, message) {
                                            if (err)
                                                throw err;
                                            else
                                                Message.find({
                                                    $or: [
                                                        { 'from': datam[1], 'to': friend.Email, 'read': false },
                                                        { 'from': friend.Email, 'to': datam[1], 'read': false }
                                                    ]
                                                }, { userName: 1, Profile_pic: 1, Email: 1 }, function (err, rs) {
                                                    if (err)
                                                        throw err;
                                                    else {
                                                        var chatx = {
                                                            image: friend.Profile_pic,
                                                            name: friend.userName,
                                                            id: friend.Email,
                                                            time: chat.time,
                                                            message: message[0],
                                                            unread: rs.length,
                                                            more: chat,
                                                            more_pic: friend.More_pic
                                                        };
                                                        socketResponse(socket, { module: 'HomeResponse', res: chatx, submodule: 'friendChat' });
                                                    }
                                                });

                                        }).sort({ $natural: -1 }).limit(1)
                                })
                            })
                        }
                    });
                    break;
                case 'fetchFirstmess':
                    Message.find(
                        {
                            $or: [
                                { 'from': datam[1], 'to': datam[2], 'deleteFrom': { $ne: datam[1] } },
                                { 'from': datam[2], 'to': datam[1], 'deleteFrom': { $ne: datam[1] } }

                            ]
                        }, function (err, messages) {
                            if (err)
                                throw err;
                            else
                                Message.findOne({
                                    $or: [
                                        { 'from': datam[1], 'to': datam[2] },
                                        { 'from': datam[2], 'to': datam[1] }
                                    ]
                                }, function (err, rs) {
                                    if (err)
                                        throw err;
                                    else {
                                        socketResponse(socket, { module: 'ChatResponse', res: [module, messages.reverse(), rs] });
                                    }
                                }).sort({ $natural: 1 });

                        }).sort({ $natural: -1 }).limit(30);
                    break;
                case 'fetchSubsequent':
                    Message.find(
                        {
                            $or: [
                                { 'from': datam[1], 'to': datam[2], id: { $lt: datam[3] }, 'deleteFrom': { $ne: datam[1] } },
                                { 'from': datam[2], 'to': datam[1], id: { $lt: datam[3] }, 'deleteFrom': { $ne: datam[1] } }

                            ]
                        }, function (err, messages) {
                            if (err)
                                throw err;
                            else
                                socketResponse(socket, { module: 'ChatResponse', res: [module, messages] });
                        }).sort({ $natural: -1 }).limit(30);
                    break;
                case 'updateProfile':
                    User.update({ 'Email': datam[1] },
                        { $set: { 'Profile': true, 'age': datam[2], 'gender': datam[3], 'orientation': datam[4], 'intention': datam[5], 'country': datam[6], 'city': datam[7] } },
                        function (err) {
                            if (err)
                                throw err;
                            else {
                                User.findOne({ 'Email': datam[1] }, function (err, user) {
                                    if (err)
                                        throw err;
                                    else {
                                        socketResponse(socket, { module: 'HomeResponse', res: user, submodule: 'userBasic' });
                                    }
                                });
                            }
                        });
                    break;
                case 'randomMatch':
                    User.findOne({ 'Email': datam[1] }, function (err, user) {
                        if (err)
                            throw err;
                        else {
                            var friends = [datam[1]];
                            user.chats.forEach(function (value) {
                                friends.push(value.Id);
                            });
                            User.aggregate([{
                                $match: {
                                    'Email': { $nin: friends },
                                    'age': { $exists: true },
                                    'gender': { $exists: true },
                                    'city': { $exists: true },
                                    'country': { $exists: true },
                                    'intention': { $exists: true },
                                    'orientation': { $exists: true }
                                }
                            }, { $sample: { size: 1 } }]).exec(function (err, results) {
                                if (err)
                                    throw err;
                                var resx;
                                if (results.length > 0) {
                                    resx = results[0];
                                } else {
                                    resx = 'No match found';
                                }
                                socketResponse(socket, { module: 'HomeResponse', res: [resx], submodule: 'search' });
                            });

                        }
                    });
                    break;
                case 'findMatch':
                    User.findOne({ 'Email': datam[1] }, function (err, user) {
                        if (err)
                            throw err;
                        else {
                            var friends = [datam[1]];
                            user.chats.forEach(function (value) {
                                friends.push(value.Id);
                            });
                            User.aggregate([{
                                $match: {
                                    'Email': { $nin: friends },
                                    'age': datam[2],
                                    'intention': datam[3],
                                    'gender': { $exists: true },
                                    'country': datam[4],
                                    'city': datam[5],
                                    'orientation': { $exists: true }

                                }
                            }, { $sample: { size: 1 } }]).exec(function (err, results) {
                                if (err)
                                    throw err;
                                var resx;
                                if (results.length > 0) {
                                    resx = results[0];
                                } else {
                                    resx = 'No match found';
                                }
                                socketResponse(socket, { module: 'HomeResponse', res: [resx], submodule: 'search' });
                            });

                        }
                    });
                    break;
                case 'messageSent':
                    User.find({ 'Email': datam[2].Email, 'chats.Id': datam[3].Email }, function (err, resp) {
                        if (err)
                            throw err;
                        if (resp.length == 0) {
                            User.update({ 'Email': datam[2].Email }, {
                                $push: {
                                    'chats': {
                                        Id: datam[3].Email,
                                        time: getTime()[2],
                                        Status: 'Add to friends',
                                        Block: 'Block'
                                    }
                                }
                            }, function (err) {
                                if (err)
                                    throw err
                            });
                        } else {
                            User.update({ 'Email': datam[2].Email, chats: { $elemMatch: { Id: datam[3].Email } } }
                                , { $set: { 'chats.$.time': getTime()[2] } }, function (err) {
                                    if (err)
                                        throw err;

                                });
                        }
                    });
                    User.find({ 'Email': datam[3].Email, 'chats.Id': datam[2].Email }, function (err, resp) {
                        if (err)
                            throw err;
                        if (resp.length == 0) {
                            User.update({ 'Email': datam[3].Email }, {
                                $push: {
                                    'chats': {
                                        Id: datam[2].Email,
                                        time: getTime()[2],
                                        Status: 'Add to friends',
                                        Block: 'Block'
                                    }
                                }
                            }, function (err) {
                                if (err)
                                    throw err
                            });
                        } else {
                            User.update({ 'Email': datam[3].Email, chats: { $elemMatch: { Id: datam[2].Email } } }
                                , { $set: { 'chats.$.time': getTime()[2] } }, function (err) {
                                    if (err)
                                        throw err;

                                });
                        }
                    });


                    var gettime = getTime();
                    var messageObject = new Message();
                    messageObject.from = datam[3].Email;
                    messageObject.to = datam[2].Email;
                    messageObject.message = datam[1];
                    if (datam[4]) {
                        messageObject.image = datam[4];
                    }
                    messageObject.date = gettime[0];
                    messageObject.time = gettime[1];
                    messageObject.id = gettime[2];
                    messageObject.read = false;
                    messageObject.save(function (err) {
                        if (err)
                            throw err;
                        else {

                            var senderObject = {
                                image: datam[3].Profile_pic,
                                name: datam[3].userName,
                                id: datam[3].Email,
                                message: messageObject,
                                unread: 1

                            };
                            var receiverObject = {
                                image: datam[2].Profile_pic,
                                name: datam[2].userName,
                                id: datam[2].Email,
                                message: messageObject,
                                unread: 0
                            };
                            socketResponse(socket, { module: 'ChatResponse', res: [module, messageObject, senderObject, receiverObject] }, true);
                        }
                    });
                    break;
                case 'updateRead':
                    Message.update({ 'from': datam[2], 'to': datam[1], 'read': false }, { $set: { 'read': true } }, { multi: true },
                        function (err) {
                            if (err)
                                throw err;
                            socketResponse(socket, { module: 'ChatResponse', res: [module, datam] }, true);
                        });


                    break;
                case 'friendAction':
                    var response;
                    switch (datam[1]) {
                        case 'Add to friends':
                            User.update({ 'Email': datam[2], chats: { $elemMatch: { Id: datam[3] } } }, {
                                $set: {
                                    'chats.$.Status': 'Remove request'
                                }
                            }, function (err) {
                                if (err)
                                    throw err;
                            });
                            User.update({ 'Email': datam[3], chats: { $elemMatch: { Id: datam[2] } } }, {
                                $set: {
                                    'chats.$.Status': 'Accept'
                                }
                            }, function (err) {
                                if (err)
                                    throw err;
                            });
                            response = ['requestAdd', 'Remove request', 'Accept', datam[2], datam[3]];
                            break;
                        case 'Accept':
                            User.update({ 'Email': datam[2], chats: { $elemMatch: { Id: datam[3] } } },
                                {
                                    $set: {
                                        'chats.$.Status': 'Unfriend'
                                    }
                                }, function (err) {
                                    if (err)
                                        throw err;
                                });
                            User.update({ 'Email': datam[3], chats: { $elemMatch: { Id: datam[2] } } },
                                {
                                    $set: {
                                        'chats.$.Status': 'Unfriend'
                                    }
                                }, function (err) {
                                    if (err)
                                        throw err;
                                });
                            response = ['acceptedRequest', 'Unfriend', datam[2], datam[3]];

                            break;
                        case 'Unfriend':
                            User.update({ 'Email': datam[2], chats: { $elemMatch: { Id: datam[3] } } },
                                {
                                    $set: {
                                        'chats.$.Status': 'Add to friends'
                                    }
                                }, function (err) {
                                    if (err)
                                        throw err;
                                });
                            User.update({ 'Email': datam[3], chats: { $elemMatch: { Id: datam[2] } } },
                                {
                                    $set: {
                                        'chats.$.Status': 'Add to friends'
                                    }
                                }, function (err) {
                                    if (err)
                                        throw err;
                                });
                            response = ['requestRemove', 'Add to friends', datam[2], datam[3]];
                            break;
                        case 'Remove request':
                            User.update({ 'Email': datam[2], chats: { $elemMatch: { Id: datam[3] } } },
                                {
                                    $set: {
                                        'chats.$.Status': 'Add to friends'
                                    }
                                }, function (err) {
                                    if (err)
                                        throw err;
                                });
                            User.update({ 'Email': datam[3], chats: { $elemMatch: { Id: datam[2] } } },
                                {
                                    $set: {
                                        'chats.$.Status': 'Add to friends'
                                    }
                                }, function (err) {
                                    if (err)
                                        throw err;
                                });

                            response = ['requestRemove', 'Add to friends', datam[2], datam[3]];

                            break;
                        case 'Delete chat':
                            Message.update({
                                $or: [
                                    { 'from': datam[2], 'to': datam[3], 'deleteFrom': { $exists: false } },
                                    { 'from': datam[3], 'to': datam[2], 'deleteFrom': { $exists: false } }
                                ]
                            }, { $set: { 'deleteFrom': datam[2] } }, { multi: true }, function (err) {
                                if (err)
                                    throw err;
                            });


                            Message.remove({
                                $or: [
                                    {
                                        'from': datam[2],
                                        'to': datam[3],
                                        'deleteFrom': { $exists: true }
                                    },
                                    {
                                        'from': datam[3],
                                        'to': datam[2],
                                        'deleteFrom': { $exists: true }
                                    }
                                ]
                            },
                                function (err) {
                                    if (err)
                                        throw err;
                                });

                            response = ['Deletechat', datam[2], datam[3]];

                            break;
                        case 'Block':
                            User.update({ 'Email': datam[2], chats: { $elemMatch: { Id: datam[3] } } },
                                {
                                    $set: {
                                        'chats.$.Block': 'Unblock'
                                    }
                                }, function (err) {
                                    if (err)
                                        throw err;
                                });
                            User.update({ 'Email': datam[3], chats: { $elemMatch: { Id: datam[2] } } },
                                {
                                    $set: {
                                        'chats.$.Block': 'Blocked'
                                    }
                                }, function (err) {
                                    if (err)
                                        throw err;
                                });
                            response = ['Block', 'Unblock', 'Blocked', datam[2], datam[3]];
                            break;
                        case 'Unblock':
                            User.update({ 'Email': datam[2], chats: { $elemMatch: { Id: datam[3] } } },
                                {
                                    $set: {
                                        'chats.$.Block': 'Block'
                                    }
                                }, function (err) {
                                    if (err)
                                        throw err;
                                });
                            User.update({ 'Email': datam[3], chats: { $elemMatch: { Id: datam[2] } } },
                                {
                                    $set: {
                                        'chats.$.Block': 'Block'
                                    }
                                }, function (err) {
                                    if (err)
                                        throw err;
                                });
                            response = ['Unblock', 'Block', datam[2], datam[3]];
                            break;
                    }
                    socketResponse(socket, { module: 'FriendResponse', res: response }, true);
                    break;
                case 'chat':
                    User.findOne({ 'Email': datam[1] }, function (err, user) {
                        if (err)
                            throw err;
                        else {
                            var userx = user.chats[user.chats.findIndex(y => y.Id == datam[2])];

                            socketResponse(socket, { module: 'friendResponse', res: userx });
                        }
                    });
                    break;
                case 'reportSent':
                    ////////////////////////Report sent//////////////////////////////
                    //from, to, message
                    break

            }
        });
    })
};
function socketResponse(socket, data, data1) {
    if (data1) {
        socket.emit('serverData', data);
        socket.broadcast.emit('serverData', data)
    } else {
        socket.emit('serverData', data)
    }
}


function getTime() {
    var today = new Date();
    var now = Date.now();
    var date = today.getDate() + '/' + parseInt(today.getMonth() + 1) + '/' + today.getFullYear();
    var hours = today.getHours();
    var minutes = today.getMinutes();
    if (hours < 10) {
        hours = '0' + hours;
    } else {
        hours = hours;
    }
    if (minutes < 10) {
        minutes = '0' + minutes;
    } else {
        minutes = minutes;
    }
    var time = hours + ':' + minutes;
    data = [date, time, now];
    return data;
}