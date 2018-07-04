var mongoose = require('mongoose');
var messagesSchema = new mongoose.Schema({
    from: String,
    to: String,
    message: String,
    image: String,
    date: String,
    time: String,
    id: Number,
    read: Boolean,
    deleteFrom: String,
});

module.exports = mongoose.model('messages', messagesSchema);