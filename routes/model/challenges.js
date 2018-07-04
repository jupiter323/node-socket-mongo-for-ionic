var chalSchema = new mongoose.Schema({
   name: String,
   startDate: String,
   startTime: String,
   endDate: String,
   endTime: String,
   question: String,
   Options:[{
       title: String,
       value: String,
       coins: String
    }],
   id: Number
});

module.exports = mongoose.model('challenges', chalSchema);