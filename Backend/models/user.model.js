const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    fullname: {
        type: String,
        required: false
    },
    filename: String,
    image: {
        type: String,
        required: false
    },
    faceImage: {
        type: String,
        required: false
    },
    password: {
        type: String,
        required: true
    },
    refreshToken: String,
    isFirstLogin: {
        type: Boolean,
        default: true
    }
})

module.exports = mongoose.model('User', userSchema)