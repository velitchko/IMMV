let EventSchema = require('./event');
let mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/immv2');


injectTheme();

function injectTheme() {
    EventSchema.find({}, (err, events) => {
        if(err) {
            console.log(err);
            return;
        }

        events.forEach((e) => {
            if(e.name.toLowerCase().includes('festwochen')) { //('1. mai')) {
                console.log(e.name);
                let theme = {
                    theme: mongoose.Types.ObjectId('5dc291ab535e330852ea3b2a'), // 1. Mai 5dc14407535e330852ea2de6
                    relationship: 'references'
                }
                EventSchema.findOneAndUpdate({ _id: e._id}, { $push: { themes: theme}}, (err, done) => {
                    if(err) {
                        console.log(err);
                    }
                    console.log(done.name + ' updated');
                });
            }
        });
    })
}