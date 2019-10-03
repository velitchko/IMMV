let ThemeSchema = require('./themes');
let EventSchema = require('./event');
let mongoose = require('mongoose');
let cli = require('cli-progress');

let db = require('../data_schemes/db.config');

mongoose.connect('mongodb://localhost/immv2');

const progressBar = new cli.Bar({}, cli.Presets.shades_classic);

injectTheme();

function injectTheme() {
    EventSchema.find({}, (err, events) => {
        if(err) {
            console.log(err);
            return;
        }

        events.forEach((e) => {
            if(e.name.toLowerCase().includes('festwochen')) { //('1. Mai')) {
                let theme = {
                    theme: mongoose.Types.ObjectId('5d949c5334492200a542f2e3'), // 1. Mai 5d94990f34492200a542f2da
                    relationship: 'references'
                }
                EventSchema.findOneAndUpdate({ _id: e._id}, { $push: { themes: theme}}, (err, done) => {
                    console.log(done.name + ' updated');
                });
            }
        });
    })
}