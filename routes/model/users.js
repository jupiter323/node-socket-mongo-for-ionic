var mongoose = require('mongoose');
var bcrypt = require('bcrypt');
var userSchema = new mongoose.Schema({
    UserId: { type: Number, require: true },
    Email: { type: String, require: true },
    Password: { type: String, require: true },
    Profile_pic: { type: String },
    More_pic: [
        { type: String }
    ],
    userName: String,
    Status: String,
    PassCode: Number,
    Profile: Boolean,
    chats: [{
        Id: String,
        time: Number,
        Status: String,
        Block: String

    }],
    age: String,
    gender: String,
    orientation: String,
    intention: String,
    country: String,
    city: String,
    calls: [{
        Id: Number
    }]
});
userSchema.methods.generatHarsh = function (password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(9));
};
userSchema.methods.validPassword = function (password) {
    return bcrypt.compareSync(password, this.Password);
};
module.exports = mongoose.model('users', userSchema);