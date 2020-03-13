let mongoose = require('mongoose');
// NOTE: Import locally for some reason it doesnt work when importing from the data_schemes
let EventSchema = require('../data_schemes/event');
let db = require('../data_schemes/db.config');
let moment = require('moment');

mongoose.set('debug', true);
mongoose.set('useNewUrlParser', true);
mongoose.connect(`mongodb://localhost:27017/${db.collectionName}`, function (err) {
    console.log('DB Connected');
    console.log(`mongodb://localhost:27017/${db.collectionName}`);
    if (err) {
        console.log(err);
        return;
    }

    injectTheme();
});

function injectTheme() {
    EventSchema.find({}, (err, events) => {
        if(err) {
            console.log(err);
            return;
        }

        let count = 0;
        events.forEach((e) => {
            // Musikstadt reloaded 
            if(!e.themes.map((t) => { return t.theme; }).includes('5e259ce5535e330852ea6285')) {
                let addTheme = false;
                //A
                let startDate = moment.utc(e.startDate);
                let endDate = moment.utc(e.endDate);
                let minDate = moment.utc('13/4/1945', 'DD/MM/YYYY');
                let maxDate = moment.utc('31/12/1955', 'DD/MM/YYYY');
                if(endDate.isValid()) {
                    if(startDate.isAfter(minDate) && endDate.isBefore(maxDate)) {
                        // A
                        count++;
                        addTheme = true;
                    }
    
                    if(startDate.isBefore(minDate) && endDate.isBetween(minDate, maxDate)) {
                        // B
                        count++;
                        addTheme = true;
                    }
    
                    if(startDate.isBetween(minDate, maxDate) && endDate.isAfter(maxDate)) {
                        count++;
                        addTheme = true;
                    }
                } else {
                    if(startDate.isBetween(minDate, maxDate)) {
                        // A
                        count++;
                        addTheme = true;
                    }
                }

                // console.log('Linking');
                if(addTheme) {
                    e.themes.push({
                        theme: mongoose.Types.ObjectId('5e259ce5535e330852ea6285'),
                        relationship: 'references'
                    });
                    
                    e.save();
                }
            }
            // Stadtfeste
            // if(e.themes.map((t) => { return t.theme; }).includes('5dc291ab535e330852ea3b2a') &&
            // !e.themes.map((t) => { return t.theme; }).includes('5e3c0b2e535e330852ea954b')
            // ) {
            //     console.log('Related to Wiener Festwochen');
            //     e.themes.push({
            //         theme: mongoose.Types.ObjectId('5e3c0b2e535e330852ea954b'),
            //         relationship: 'references'
            //     });
            //     console.log('Linking Stadtfeste');
            //     console.log('-------');
            //     e.save();
            // }
            // festwochen / 1. mai
            // if(e.name.toLowerCase().includes('festwochen')) { //('1. mai')) {
            //     console.log(e.name);
            //     let theme = {
            //         theme: mongoose.Types.ObjectId('5dc291ab535e330852ea3b2a'), // 1. Mai 5dc14407535e330852ea2de6
            //         relationship: 'references'
            //     }
            //     EventSchema.findOneAndUpdate({ _id: e._id}, { $push: { themes: theme}}, (err, done) => {
            //         if(err) {
            //             console.log(err);
            //         }
            //         console.log(done.name + ' updated');
            //     });
            // }
        });
        console.log(`${count} events updated`);
    });
}